-- Tier lists (docs/blocks/tier-lists.md): a Tier list Block ranks the pieces of another Block on
-- its Page (Units, say) into tiers the builders name (S, A, B, C, D by default). Every signed-in
-- player keeps one list per Tier list Block; the community tier for each entry is the median of
-- everyone's lists, worked out in the app from tier_tallies(). Lists are anonymous unless their
-- maker shares one; a placed piece can carry a one-line reason, shown without a name. Safe to run twice.
--
-- Run after 20261108180000_videos.sql (the reports part rebuilds flags_one_target with video_id) and
-- 20261108200000_video_removal_window.sql.
--
--   game_blocks.type 'tierlist', game_blocks.tier_setup (what it ranks, the tiers, optional limits)
--   tier_lists ── tier_placements (one per piece placed: its tier, its order in the row, a reason)
--   flags.tier_placement_id (a report about a reason, handled on the Notice Board)

-- The Block ----------------------------------------------------------------------------------
alter table public.game_blocks drop constraint if exists game_blocks_type_check;
alter table public.game_blocks add constraint game_blocks_type_check
  check (type in ('collection', 'guide', 'checklist', 'timeline', 'characters', 'items', 'tierlist'));

-- { "ranks": "units", "tiers": [{ "key": "s", "label": "S" }, ...],
--   "routes": ["theodora"], "tag": { "key": "Group", "values": ["Fiery Mane"] } }
-- Keys never change, so renaming a tier keeps every list. routes and tag are optional limits.
alter table public.game_blocks add column if not exists tier_setup jsonb;

-- Lists ----------------------------------------------------------------------------------------
create table if not exists public.tier_lists (
  id           uuid primary key default gen_random_uuid(),
  game_id      text not null,
  block_key    text not null,                                          -- the Tier list Block
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  shared       boolean not null default false,                         -- readable by its link
  game_version text check (char_length(game_version) <= 32),           -- the patch it was made on (later)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (game_id, block_key, profile_id),
  foreign key (game_id, block_key) references public.game_blocks (game_id, block_key) on delete cascade
);
create index if not exists tier_lists_block_idx on public.tier_lists (game_id, block_key);

create table if not exists public.tier_placements (
  id         uuid primary key default gen_random_uuid(),               -- so a report can point at a reason
  list_id    uuid not null references public.tier_lists (id) on delete cascade,
  card_id    uuid not null references public.cards (id) on delete cascade,
  tier_key   text not null check (tier_key ~ '^[a-z0-9-]{1,24}$'),
  position   int  not null default 0 check (position between 0 and 1000),
  reason     text check (char_length(reason) between 1 and 140),
  unique (list_id, card_id)
);
-- A reason a moderator took down, kept so the same words can't come back with the next autosave.
alter table public.tier_placements add column if not exists removed_reason text;
create index if not exists tier_placements_card_idx on public.tier_placements (card_id);

alter table public.tier_lists enable row level security;
alter table public.tier_placements enable row level security;

-- Your own list, or one its maker shared. Everything else is only ever seen as totals.
drop policy if exists "read own or shared tier lists" on public.tier_lists;
create policy "read own or shared tier lists" on public.tier_lists for select
  using (profile_id = auth.uid() or shared);
drop policy if exists "read own or shared placements" on public.tier_placements;
create policy "read own or shared placements" on public.tier_placements for select
  using (exists (select 1 from public.tier_lists l where l.id = list_id and (l.profile_id = auth.uid() or l.shared)));
-- A game's moderators can read placements (not who made the list), so a reported reason shows on
-- the Notice Board.
drop policy if exists "moderators read placements" on public.tier_placements;
create policy "moderators read placements" on public.tier_placements for select
  using (exists (select 1 from public.tier_lists l where l.id = list_id and public.is_moderator(l.game_id)));
-- Saving goes through save_tier_list() and share_tier_list(), which check every piece and tier.
revoke insert, update, delete on public.tier_lists from anon, authenticated;
revoke insert, update, delete on public.tier_placements from anon, authenticated;
drop policy if exists "delete own tier list" on public.tier_lists;
create policy "delete own tier list" on public.tier_lists for delete using (profile_id = auth.uid());
grant delete on public.tier_lists to authenticated;

-- A small log for the save rate limit in save_tier_list(), an hour deep (kept apart, so saving
-- never rewrites old rows). Nobody reads it directly.
create table if not exists public.tier_list_saves (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  saved_at   timestamptz not null default now()
);
create index if not exists tier_list_saves_idx on public.tier_list_saves (profile_id, saved_at);
alter table public.tier_list_saves enable row level security;
revoke all on public.tier_list_saves from anon, authenticated;

-- Saving: the whole list at once, replacing what was there.
-- pieces: [{ "card": "<uuid>", "tier": "s", "reason": "Carries the early maps" }, ...] in row order.
-- Only pieces of the Block it ranks and only its tiers. (The optional route and group limits are
-- applied by the app; a piece outside them only adds a count nobody is shown.)
create or replace function public.save_tier_list(g text, b text, pieces jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  setup jsonb;
  list uuid;
  recent int;
  bad int;
begin
  if me is null then raise exception 'Sign in to save your list.' using errcode = 'P0001'; end if;
  select tier_setup into setup from public.game_blocks where game_id = g and block_key = b and type = 'tierlist';
  if setup is null then raise exception 'That tier list isn''t in the app.' using errcode = 'P0001'; end if;
  if jsonb_typeof(pieces) is distinct from 'array' then
    raise exception 'That isn''t a list.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(pieces) > 500 then
    raise exception 'That list is too long.' using errcode = 'P0001';
  end if;
  -- Every card must look like an id before anything reads it as one.
  if exists (select 1 from jsonb_array_elements(pieces) p
             where coalesce(p->>'card', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Something in that list isn''t in this tier list.' using errcode = 'P0001';
  end if;

  select count(*) into bad
  from jsonb_array_elements(pieces) p
  left join public.cards c on c.id = (p->>'card')::uuid and c.game_id = g and c.block_key = setup->>'ranks'
  where c.id is null
     or not exists (select 1 from jsonb_array_elements(setup->'tiers') t where t->>'key' = p->>'tier')
     or char_length(coalesce(p->>'reason', '')) > 140;
  if bad > 0 then raise exception 'Something in that list isn''t in this tier list.' using errcode = 'P0001'; end if;
  if (select count(distinct p->>'card') from jsonb_array_elements(pieces) p) <> jsonb_array_length(pieces) then
    raise exception 'A piece is in that list twice.' using errcode = 'P0001';
  end if;

  select id into list from public.tier_lists where game_id = g and block_key = b and profile_id = me;
  if list is null then
    insert into public.tier_lists (game_id, block_key, profile_id) values (g, b, me) returning id into list;
  else
    -- Saved as a player goes, so the limit is generous: about one save every 6 seconds for an hour.
    select count(*) into recent from public.tier_list_saves where profile_id = me and saved_at > now() - interval '1 hour';
    if recent >= 600 then raise exception 'Slow down a little: your list will save in a while.' using errcode = 'P0001'; end if;
    update public.tier_lists set updated_at = now() where id = list;
  end if;
  delete from public.tier_list_saves where profile_id = me and saved_at < now() - interval '1 hour';
  insert into public.tier_list_saves (profile_id) values (me);

  -- Keep the rows (and their ids, which reports point at) for pieces still on the list.
  delete from public.tier_placements tp where tp.list_id = list
    and not exists (select 1 from jsonb_array_elements(pieces) p where (p->>'card')::uuid = tp.card_id);
  insert into public.tier_placements (list_id, card_id, tier_key, position, reason)
  select list, (p->>'card')::uuid, p->>'tier', (o - 1)::int, nullif(btrim(p->>'reason'), '')
  from jsonb_array_elements(pieces) with ordinality as x(p, o)
  on conflict (list_id, card_id) do update
    set tier_key = excluded.tier_key, position = excluded.position,
        -- A reason a moderator removed doesn't come back when the device sends it again; new words do.
        reason = case when excluded.reason is not distinct from tier_placements.removed_reason then null else excluded.reason end;
  return list;
end $$;
grant execute on function public.save_tier_list(text, text, jsonb) to authenticated;
revoke execute on function public.save_tier_list(text, text, jsonb) from anon;

-- Sharing: makes your list readable by its link (with your name on it), or private again.
create or replace function public.share_tier_list(g text, b text, on_off boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare list uuid;
begin
  update public.tier_lists set shared = on_off
  where game_id = g and block_key = b and profile_id = auth.uid() returning id into list;
  if list is null then raise exception 'Save your list first.' using errcode = 'P0001'; end if;
  return list;
end $$;
grant execute on function public.share_tier_list(text, text, boolean) to authenticated;
revoke execute on function public.share_tier_list(text, text, boolean) from anon;

-- The community tier --------------------------------------------------------------------------
-- How many lists put each piece in each tier. Who ranked what stays private. The median and the
-- "5 lists" rule are worked out in the app (src/lib/tiers.ts) from these counts.
create or replace function public.tier_tallies(g text, b text)
returns table (card_id uuid, tier_key text, lists int)
language sql stable security definer set search_path = public as $$
  select tp.card_id, tp.tier_key, count(*)::int
  from public.tier_lists l
  join public.tier_placements tp on tp.list_id = l.id
  where l.game_id = g and l.block_key = b
  group by tp.card_id, tp.tier_key
$$;
grant execute on function public.tier_tallies(text, text) to anon, authenticated;

-- How many lists have at least one piece placed, for "From 23 lists".
create or replace function public.tier_list_count(g text, b text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.tier_lists l
  where l.game_id = g and l.block_key = b and exists (select 1 from public.tier_placements tp where tp.list_id = l.id)
$$;
grant execute on function public.tier_list_count(text, text) to anon, authenticated;

-- Every tier list that ranks this entry, with its counts, for the pill on the entry's card.
create or replace function public.entry_tiers(c uuid)
returns table (game_id text, block_key text, page_key text, title text, tier_setup jsonb, tier_key text, lists int)
language sql stable security definer set search_path = public as $$
  select gb.game_id, gb.block_key, gb.page_key, coalesce(gb.title, gb.block_key), gb.tier_setup, tp.tier_key, count(tp.id)::int
  from public.cards card
  join public.game_blocks gb on gb.game_id = card.game_id and gb.type = 'tierlist' and gb.tier_setup->>'ranks' = card.block_key
  left join public.tier_lists l on l.game_id = gb.game_id and l.block_key = gb.block_key
  left join public.tier_placements tp on tp.list_id = l.id and tp.card_id = card.id
  where card.id = c
  group by gb.game_id, gb.block_key, gb.page_key, gb.title, gb.tier_setup, tp.tier_key
$$;
grant execute on function public.entry_tiers(uuid) to anon, authenticated;

-- Reasons for one piece, newest first, without names. A reason a moderator removed is gone.
create or replace function public.tier_reasons(g text, b text, c uuid)
returns table (id uuid, tier_key text, reason text, updated_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select tp.id, tp.tier_key, tp.reason, l.updated_at, l.profile_id = auth.uid()
  from public.tier_lists l
  join public.tier_placements tp on tp.list_id = l.id
  where l.game_id = g and l.block_key = b and tp.card_id = c and tp.reason is not null
  order by l.updated_at desc
  limit 30
$$;
grant execute on function public.tier_reasons(text, text, uuid) to anon, authenticated;

-- Taking a reason down: a moderator of its game (or the player, by editing their list). Its
-- reports close too. The placement itself stays, so the list still counts.
create or replace function public.remove_tier_reason(p uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  select l.game_id into g from public.tier_placements tp join public.tier_lists l on l.id = tp.list_id where tp.id = p;
  if g is null then raise exception 'That reason isn''t here.' using errcode = 'P0001'; end if;
  if not public.is_moderator(g) then raise exception 'Only a moderator can take it down.' using errcode = 'P0001'; end if;
  update public.tier_placements set removed_reason = coalesce(reason, removed_reason), reason = null where id = p;
  update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
  where tier_placement_id = p and status = 'open';
end $$;
grant execute on function public.remove_tier_reason(uuid) to authenticated;

-- Reports: a flag can point at a reason --------------------------------------------------------
alter table public.flags add column if not exists tier_placement_id uuid references public.tier_placements (id) on delete cascade;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'flags_one_target') then
    alter table public.flags drop constraint flags_one_target;
  end if;
  alter table public.flags add constraint flags_one_target
    check (num_nonnulls(message_id, draft_id, question_id, video_id, tier_placement_id) = 1);
  if not exists (select 1 from pg_constraint where conname = 'flags_reporter_id_tier_placement_id_key') then
    alter table public.flags add constraint flags_reporter_id_tier_placement_id_key unique (reporter_id, tier_placement_id);
  end if;
end $$;

create or replace function public.flag_game() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.game_id := coalesce(
    (select game_id from public.chat_messages where id = new.message_id),
    (select game_id from public.drafts where id = new.draft_id),
    (select game_id from public.questions where id = new.question_id),
    (select game_id from public.videos where id = new.video_id),
    (select l.game_id from public.tier_placements tp join public.tier_lists l on l.id = tp.list_id where tp.id = new.tier_placement_id));
  return new;
end $$;
