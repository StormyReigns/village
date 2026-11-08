-- Tier lists, part 2 (docs/blocks/tier-lists.md, Matt 2026-11-08): your list counts only when you
-- submit it, and you can keep unique lists of your own. Run after 20261109000000_tier_lists.sql.
-- Safe to run twice.
--
--   tier_lists.kind:
--     'main'      your working list for the Block's reason ("MVP"), one per player per Block.
--                 Private unless you share its link. Saved as you go.
--     'submitted' the copy the community counts, one per player per Block. Written only by
--                 submit_tier_list(), which copies your main list as it is now; later edits count
--                 once you submit again. withdraw_tier_list() takes it back.
--     'unique'    a list of your own with its own title ("Hottest"), built from scratch, as many
--                 as 20 per Block. Never counted; shareable.
--   Totals, the "From N lists" count, the card pill and reasons read only submitted copies.

-- Kinds and titles ------------------------------------------------------------------------------
alter table public.tier_lists add column if not exists kind text not null default 'main';
alter table public.tier_lists add column if not exists title text;
alter table public.tier_lists add column if not exists submitted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tier_lists_kind_check') then
    alter table public.tier_lists add constraint tier_lists_kind_check check (kind in ('main', 'submitted', 'unique'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tier_lists_title_check') then
    -- Only a unique list has a title of its own; the others use the Block's reason.
    alter table public.tier_lists add constraint tier_lists_title_check
      check ((kind = 'unique') = (title is not null) and (title is null or char_length(title) between 1 and 40));
  end if;
  -- One list per player per Block was the rule; now it's one main and one submitted copy.
  if exists (select 1 from pg_constraint where conname = 'tier_lists_game_id_block_key_profile_id_key') then
    alter table public.tier_lists drop constraint tier_lists_game_id_block_key_profile_id_key;
  end if;
end $$;
create unique index if not exists tier_lists_one_main on public.tier_lists (game_id, block_key, profile_id) where kind = 'main';
create unique index if not exists tier_lists_one_submitted on public.tier_lists (game_id, block_key, profile_id) where kind = 'submitted';

-- Lists made before this counted straight away, so each gets a submitted copy and keeps counting.
do $$
declare r record; copy uuid;
begin
  for r in select l.* from public.tier_lists l
           where l.kind = 'main'
             and not exists (select 1 from public.tier_lists s where s.kind = 'submitted' and s.game_id = l.game_id and s.block_key = l.block_key and s.profile_id = l.profile_id)
             and exists (select 1 from public.tier_placements tp where tp.list_id = l.id)
  loop
    insert into public.tier_lists (game_id, block_key, profile_id, kind, submitted_at, updated_at)
    values (r.game_id, r.block_key, r.profile_id, 'submitted', r.updated_at, r.updated_at) returning id into copy;
    insert into public.tier_placements (list_id, card_id, tier_key, position, reason)
    select copy, card_id, tier_key, position, reason from public.tier_placements where list_id = r.id;
  end loop;
end $$;

-- Checking a list before it's saved ----------------------------------------------------------------
-- The Block's setup, after checking every piece: only the ranked Block's cards, only its tiers,
-- each card once, reasons of 140 characters at most. Used by saving.
create or replace function public.tier_check(g text, b text, pieces jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare setup jsonb; bad int;
begin
  select tier_setup into setup from public.game_blocks where game_id = g and block_key = b and type = 'tierlist';
  if setup is null then raise exception 'That tier list isn''t in the app.' using errcode = 'P0001'; end if;
  if jsonb_typeof(pieces) is distinct from 'array' then raise exception 'That isn''t a list.' using errcode = 'P0001'; end if;
  if jsonb_array_length(pieces) > 500 then raise exception 'That list is too long.' using errcode = 'P0001'; end if;
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
  return setup;
end $$;
revoke execute on function public.tier_check(text, text, jsonb) from public, anon, authenticated;

-- The save rate limit, shared by saving and submitting: about one every 6 seconds for an hour.
create or replace function public.tier_slow_down(me uuid) returns void
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.tier_list_saves where profile_id = me and saved_at > now() - interval '1 hour';
  if recent >= 600 then raise exception 'Slow down a little: your list will save in a while.' using errcode = 'P0001'; end if;
  delete from public.tier_list_saves where profile_id = me and saved_at < now() - interval '1 hour';
  insert into public.tier_list_saves (profile_id) values (me);
end $$;
revoke execute on function public.tier_slow_down(uuid) from public, anon, authenticated;

-- Reasons a moderator took down, kept per player and piece (the hub, 2026-11-08), so the same words
-- can't come back on any of that player's lists: not by withdrawing and resubmitting, not by taking
-- the piece off and putting it back, not on a unique list they share. Nobody reads it directly.
create table if not exists public.tier_removed_reasons (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  card_id    uuid not null references public.cards (id) on delete cascade,
  reason     text not null,
  removed_at timestamptz not null default now(),
  primary key (profile_id, card_id, reason)
);
alter table public.tier_removed_reasons enable row level security;
revoke all on public.tier_removed_reasons from public, anon, authenticated;

-- Removals made before this table (kept on the placement row) move into it.
insert into public.tier_removed_reasons (profile_id, card_id, reason)
select l.profile_id, tp.card_id, tp.removed_reason
from public.tier_placements tp join public.tier_lists l on l.id = tp.list_id
where tp.removed_reason is not null
on conflict do nothing;

-- Taking a reason down: a moderator of its game. The words are remembered for that player and
-- piece; the placement stays, so the list still counts; its reports close.
create or replace function public.remove_tier_reason(p uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g text; owner uuid; card uuid; words text;
begin
  select l.game_id, l.profile_id, tp.card_id, tp.reason into g, owner, card, words
  from public.tier_placements tp join public.tier_lists l on l.id = tp.list_id where tp.id = p;
  if g is null then raise exception 'That reason isn''t here.' using errcode = 'P0001'; end if;
  if not public.is_moderator(g) then raise exception 'Only a moderator can take it down.' using errcode = 'P0001'; end if;
  if words is not null then
    insert into public.tier_removed_reasons (profile_id, card_id, reason) values (owner, card, btrim(words)) on conflict do nothing;
    -- Gone everywhere for that player and piece at once (this row included), so a shared list's
    -- link stops showing the words before the player next saves.
    update public.tier_placements tp set removed_reason = coalesce(tp.reason, tp.removed_reason), reason = null
    from public.tier_lists l
    where tp.list_id = l.id and l.profile_id = owner and tp.card_id = card and btrim(tp.reason) = btrim(words);
  end if;
  update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
  where tier_placement_id = p and status = 'open';
end $$;
grant execute on function public.remove_tier_reason(uuid) to authenticated;

-- Writes a list's placements, keeping the rows (and their ids, which reports point at) for pieces
-- still on it. Words a moderator took down from this player for a piece are dropped, on new rows
-- and changed ones alike.
create or replace function public.tier_write(list uuid, pieces jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select profile_id into owner from public.tier_lists where id = list;
  delete from public.tier_placements tp where tp.list_id = list
    and not exists (select 1 from jsonb_array_elements(pieces) p where (p->>'card')::uuid = tp.card_id);
  insert into public.tier_placements (list_id, card_id, tier_key, position, reason)
  select list, (p->>'card')::uuid, p->>'tier', (o - 1)::int,
         case when exists (select 1 from public.tier_removed_reasons r
                           where r.profile_id = owner and r.card_id = (p->>'card')::uuid and r.reason = btrim(p->>'reason'))
              then null else nullif(btrim(p->>'reason'), '') end
  from jsonb_array_elements(pieces) with ordinality as x(p, o)
  on conflict (list_id, card_id) do update
    set tier_key = excluded.tier_key, position = excluded.position, reason = excluded.reason;
end $$;
revoke execute on function public.tier_write(uuid, jsonb) from public, anon, authenticated;

-- Saving --------------------------------------------------------------------------------------------
-- Saves your main list (l omitted) or one of your unique lists (l), the whole list at once.
-- pieces: [{ "card": "<uuid>", "tier": "s", "reason": "Carries the early maps" }, ...] in row order.
drop function if exists public.save_tier_list(text, text, jsonb);
create or replace function public.save_tier_list(g text, b text, pieces jsonb, l uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); list uuid;
begin
  if me is null then raise exception 'Sign in to save your list.' using errcode = 'P0001'; end if;
  perform public.tier_check(g, b, pieces);
  if l is null then
    select id into list from public.tier_lists where game_id = g and block_key = b and profile_id = me and kind = 'main';
    if list is null then
      insert into public.tier_lists (game_id, block_key, profile_id, kind) values (g, b, me, 'main') returning id into list;
    end if;
  else
    select id into list from public.tier_lists where id = l and game_id = g and block_key = b and profile_id = me and kind = 'unique';
    if list is null then raise exception 'That list isn''t yours.' using errcode = 'P0001'; end if;
  end if;
  perform public.tier_slow_down(me);
  update public.tier_lists set updated_at = now() where id = list;
  perform public.tier_write(list, pieces);
  return list;
end $$;
grant execute on function public.save_tier_list(text, text, jsonb, uuid) to authenticated;
revoke execute on function public.save_tier_list(text, text, jsonb, uuid) from anon;

-- Submitting: the community counts a copy of your main list as it is now. Submit again to update it.
create or replace function public.submit_tier_list(g text, b text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); main uuid; copy uuid; pieces jsonb;
begin
  if me is null then raise exception 'Sign in to submit your list.' using errcode = 'P0001'; end if;
  select id into main from public.tier_lists where game_id = g and block_key = b and profile_id = me and kind = 'main';
  select coalesce(jsonb_agg(jsonb_build_object('card', card_id, 'tier', tier_key, 'reason', reason) order by position), '[]'::jsonb)
    into pieces from public.tier_placements where list_id = main;
  if main is null or jsonb_array_length(pieces) = 0 then
    raise exception 'Place a piece in your list first.' using errcode = 'P0001';
  end if;
  perform public.tier_check(g, b, pieces);
  perform public.tier_slow_down(me);
  select id into copy from public.tier_lists where game_id = g and block_key = b and profile_id = me and kind = 'submitted';
  if copy is null then
    insert into public.tier_lists (game_id, block_key, profile_id, kind, submitted_at) values (g, b, me, 'submitted', now()) returning id into copy;
  else
    update public.tier_lists set submitted_at = now(), updated_at = now() where id = copy;
  end if;
  perform public.tier_write(copy, pieces);
  return copy;
end $$;
grant execute on function public.submit_tier_list(text, text) to authenticated;
revoke execute on function public.submit_tier_list(text, text) from anon;

-- Withdrawing: your list stops counting. Your main list stays as it is.
create or replace function public.withdraw_tier_list(g text, b text) returns void
language sql security definer set search_path = public as $$
  delete from public.tier_lists where game_id = g and block_key = b and profile_id = auth.uid() and kind = 'submitted'
$$;
grant execute on function public.withdraw_tier_list(text, text) to authenticated;
revoke execute on function public.withdraw_tier_list(text, text) from anon;

-- Unique lists: start one with a title (empty, built from scratch), rename it; deleting is the
-- existing "delete own tier list" rule.
create or replace function public.create_unique_tier_list(g text, b text, t text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); list uuid; name text := btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'));
begin
  if me is null then raise exception 'Sign in to make a list of your own.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.game_blocks where game_id = g and block_key = b and type = 'tierlist') then
    raise exception 'That tier list isn''t in the app.' using errcode = 'P0001';
  end if;
  if char_length(name) not between 1 and 40 then raise exception 'Give it a title of up to 40 characters.' using errcode = 'P0001'; end if;
  if (select count(*) from public.tier_lists where game_id = g and block_key = b and profile_id = me and kind = 'unique') >= 20 then
    raise exception 'That''s 20 lists here already. Delete one to start another.' using errcode = 'P0001';
  end if;
  perform public.tier_slow_down(me);
  insert into public.tier_lists (game_id, block_key, profile_id, kind, title) values (g, b, me, 'unique', name) returning id into list;
  return list;
end $$;
grant execute on function public.create_unique_tier_list(text, text, text) to authenticated;
revoke execute on function public.create_unique_tier_list(text, text, text) from anon;

create or replace function public.rename_unique_tier_list(l uuid, t text) returns void
language plpgsql security definer set search_path = public as $$
declare name text := btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'));
begin
  if char_length(name) not between 1 and 40 then raise exception 'Give it a title of up to 40 characters.' using errcode = 'P0001'; end if;
  update public.tier_lists set title = name, updated_at = now() where id = l and profile_id = auth.uid() and kind = 'unique';
  if not found then raise exception 'That list isn''t yours.' using errcode = 'P0001'; end if;
end $$;
grant execute on function public.rename_unique_tier_list(uuid, text) to authenticated;
revoke execute on function public.rename_unique_tier_list(uuid, text) from anon;

-- Sharing: any of your lists by its id (a main or unique list; the submitted copy is the
-- community's, not a link of its own). The link shows your name; turning it off hides it again.
-- The old way (by game and Block) stays as a thin wrapper that shares your main list, so the live
-- site keeps working in the minutes between running this and the new code going live.
create or replace function public.share_tier_list(g text, b text, on_off boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare list uuid;
begin
  update public.tier_lists set shared = on_off
  where game_id = g and block_key = b and profile_id = auth.uid() and kind = 'main' returning id into list;
  if list is null then raise exception 'Save your list first.' using errcode = 'P0001'; end if;
  return list;
end $$;
create or replace function public.share_tier_list(l uuid, on_off boolean) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  update public.tier_lists set shared = on_off where id = l and profile_id = auth.uid() and kind in ('main', 'unique');
  if not found then raise exception 'Save your list first.' using errcode = 'P0001'; end if;
  return l;
end $$;
grant execute on function public.share_tier_list(uuid, boolean) to authenticated;
revoke execute on function public.share_tier_list(uuid, boolean) from anon;

-- The community reads only submitted copies ----------------------------------------------------------
create or replace function public.tier_tallies(g text, b text)
returns table (card_id uuid, tier_key text, lists int)
language sql stable security definer set search_path = public as $$
  select tp.card_id, tp.tier_key, count(*)::int
  from public.tier_lists l
  join public.tier_placements tp on tp.list_id = l.id
  where l.game_id = g and l.block_key = b and l.kind = 'submitted'
  group by tp.card_id, tp.tier_key
$$;

create or replace function public.tier_list_count(g text, b text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.tier_lists l
  where l.game_id = g and l.block_key = b and l.kind = 'submitted'
    and exists (select 1 from public.tier_placements tp where tp.list_id = l.id)
$$;

create or replace function public.entry_tiers(c uuid)
returns table (game_id text, block_key text, page_key text, title text, tier_setup jsonb, tier_key text, lists int)
language sql stable security definer set search_path = public as $$
  select gb.game_id, gb.block_key, gb.page_key, coalesce(gb.title, gb.block_key), gb.tier_setup, tp.tier_key, count(tp.id)::int
  from public.cards card
  join public.game_blocks gb on gb.game_id = card.game_id and gb.type = 'tierlist' and gb.tier_setup->>'ranks' = card.block_key
  left join public.tier_lists l on l.game_id = gb.game_id and l.block_key = gb.block_key and l.kind = 'submitted'
  left join public.tier_placements tp on tp.list_id = l.id and tp.card_id = card.id
  where card.id = c
  group by gb.game_id, gb.block_key, gb.page_key, gb.title, gb.tier_setup, tp.tier_key
$$;

create or replace function public.tier_reasons(g text, b text, c uuid)
returns table (id uuid, tier_key text, reason text, updated_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select tp.id, tp.tier_key, tp.reason, l.updated_at, l.profile_id = auth.uid()
  from public.tier_lists l
  join public.tier_placements tp on tp.list_id = l.id
  where l.game_id = g and l.block_key = b and l.kind = 'submitted' and tp.card_id = c and tp.reason is not null
  order by l.updated_at desc
  limit 30
$$;
