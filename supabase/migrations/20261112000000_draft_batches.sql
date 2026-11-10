-- Batches: rows pasted from a spreadsheet, reviewed together (docs/blocks/spreadsheets.md, level 2).
--
-- A batch is many ordinary Drafts in a folder. Each pasted row is one Draft (one entry, its own
-- "What changes" and history once published), so ship_draft, rollback and credit are unchanged.
-- The batch holds them together: the Block, a title, the source, who sent it.
--
--   draft_batches   the folder: game, Block, title, source, author, status, who decided
--   drafts.batch_id which batch a Draft belongs to (null for ordinary Drafts and set-aside rows)
--   batch_votes     "I can confirm" / "Seems wrong" once for the whole batch; batch_scores tallies
--
-- Players never write these tables directly. Everything goes through functions:
--   send_batch      makes the batch and its Drafts in one go (all or nothing), with the limits:
--                   up to 200 rows, 3 batches a day, and a batch counts as one Draft an hour
--   ship_batch      moderators publish every row through ship_draft, any time (Matt). A row whose
--                   entry changed since it was sent (someone else's fix was published first), a
--                   new row whose name now exists in the Block, or a row that fails to publish, is
--                   set aside as its own Draft, so nothing newer is overwritten without a look and
--                   one bad row never stops the rest
--   decline_batch   moderators decline it with a reason, which goes to the sender's inbox
--   withdraw_batch  the sender takes back a batch nobody has decided yet
--   set_aside_row   anyone signed in says "this row's off": it leaves the batch as its own Draft,
--                   and the reason is filed as a report so moderators see it
--
-- Publishing a batch makes one chat note and one Discord line, not one per row: the per-Draft
-- triggers skip Drafts that are in a batch. Drafts get their own rate limit (drafts_slow_down) so
-- batch rows don't count one by one; the shared slow_down is untouched.
--
-- Safe to run twice.

-- The folder -----------------------------------------------------------------------------------
create table if not exists public.draft_batches (
  id             uuid primary key default gen_random_uuid(),
  game_id        text not null references public.games (id) on delete cascade,
  block_key      text not null,
  title          text not null check (char_length(title) between 3 and 160),
  source         text not null check (char_length(source) between 3 and 300),
  author_id      uuid not null references public.profiles (id),
  status         text not null default 'open' check (status in ('open', 'stable', 'declined', 'removed')),
  decided_by     uuid references public.profiles (id),
  decided_at     timestamptz,
  decline_reason text check (char_length(decline_reason) <= 300),
  created_at     timestamptz not null default now()
);
create index if not exists draft_batches_game_idx on public.draft_batches (game_id, status, created_at desc);
create index if not exists draft_batches_author_idx on public.draft_batches (author_id, created_at desc);

alter table public.drafts add column if not exists batch_id uuid references public.draft_batches (id) on delete set null;
create index if not exists drafts_batch_idx on public.drafts (batch_id) where batch_id is not null;

create table if not exists public.batch_votes (
  batch_id   uuid not null references public.draft_batches (id) on delete cascade,
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (batch_id, voter_id)
);

alter table public.draft_batches enable row level security;
alter table public.batch_votes   enable row level security;

-- Anyone can read batches (moderators also see removed ones); nobody writes them by hand.
drop policy if exists "read batches" on public.draft_batches;
create policy "read batches" on public.draft_batches for select
  using (status <> 'removed' or public.is_moderator(game_id));

-- Votes, like Draft votes: public, your own, and never on your own batch.
drop policy if exists "read batch votes" on public.batch_votes;
create policy "read batch votes" on public.batch_votes for select using (true);
drop policy if exists "vote on batches" on public.batch_votes;
create policy "vote on batches" on public.batch_votes for insert
  with check (voter_id = auth.uid() and voter_id <> (select author_id from public.draft_batches b where b.id = batch_id));
drop policy if exists "change batch vote" on public.batch_votes;
create policy "change batch vote" on public.batch_votes for update using (voter_id = auth.uid()) with check (voter_id = auth.uid());
drop policy if exists "take back batch vote" on public.batch_votes;
create policy "take back batch vote" on public.batch_votes for delete using (voter_id = auth.uid());

-- Dated now, whatever a player sends (see 20261111130000_created_at_now.sql).
drop trigger if exists a0_created_at_now on public.batch_votes;
create trigger a0_created_at_now before insert or update on public.batch_votes
  for each row execute function public.created_at_now();
drop trigger if exists a0_created_at_now on public.draft_batches;
create trigger a0_created_at_now before insert or update on public.draft_batches
  for each row execute function public.created_at_now();

-- Tallies and Standouts for batches, from the same maths as Drafts. Runs as whoever reads it (like
-- draft_scores since 20261024120000); batches and their votes are readable anyway.
create or replace view public.batch_scores with (security_invoker = true) as
select b.id as batch_id,
       b.game_id,
       coalesce(v.ups, 0)   as ups,
       coalesce(v.downs, 0) as downs,
       public.wilson_lower(greatest(coalesce(v.ups, 0) - coalesce(v.downs, 0), 0), coalesce(v.ups, 0) + coalesce(v.downs, 0)) as standout
from public.draft_batches b
left join (select batch_id, count(*) filter (where value = 1) as ups, count(*) filter (where value = -1) as downs
           from public.batch_votes group by batch_id) v on v.batch_id = b.id
where b.status <> 'removed';
grant select on public.batch_scores to anon, authenticated;

-- Only the batch functions put a Draft in a batch -------------------------------------------------
-- A player sending a Draft straight to the table can't slip it into someone's batch.
create or replace function public.drafts_batch_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.batch_id is not null and current_user in ('anon', 'authenticated') then
    raise exception 'Rows join a batch only when it is sent.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists drafts_batch_guard on public.drafts;
create trigger drafts_batch_guard before insert on public.drafts
  for each row execute function public.drafts_batch_guard();

-- Drafts' own rate limit: 20 an hour, where a batch counts as one ------------------------------
create or replace function public.drafts_slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if new.batch_id is not null then return new; end if; -- send_batch checks batches itself
  select (select count(*) from public.drafts
          where author_id = new.author_id and batch_id is null and created_at > now() - interval '1 hour')
       + (select count(*) from public.draft_batches
          where author_id = new.author_id and created_at > now() - interval '1 hour')
  into recent;
  if recent >= 20 then
    raise exception 'Slow down a little: 20 Drafts an hour at most.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists drafts_slow_down on public.drafts;
create trigger drafts_slow_down before insert on public.drafts
  for each row execute function public.drafts_slow_down();

-- The per-Draft notes skip batch rows (the batch makes one note of its own) --------------------
drop trigger if exists drafts_chat_note on public.drafts;
create trigger drafts_chat_note after update of status on public.drafts
  for each row when (new.batch_id is null) execute function public.draft_chat_note();

do $$
begin
  if exists (select 1 from pg_proc where proname = 'discord_queue_published' and pronamespace = 'public'::regnamespace) then
    drop trigger if exists drafts_discord on public.drafts;
    create trigger drafts_discord after update of status on public.drafts
      for each row when (new.batch_id is null) execute function public.discord_queue_published();
  end if;
end $$;

-- Sending a batch ------------------------------------------------------------------------------
-- rows: [{ "content": {...entry...}, "card": "<card uuid>" or null, "revision": <base revision> or null,
--          "source": "<this row's own source>" or null }]
create or replace function public.send_batch(g text, block text, title text, source text, rows jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me    uuid := auth.uid();
  bid   uuid;
  r     jsonb;
  name  text;
  card  uuid;
  rev   bigint;
  did   uuid;
  n     int;
  cards uuid[] := '{}';
begin
  if me is null then raise exception 'Sign in to send a batch.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.game_blocks b where b.game_id = g and b.block_key = block) then
    raise exception 'That Block doesn''t exist.' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(source, ''))) < 3 then
    raise exception 'Say where the sheet is from, so it can be credited.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then
    raise exception 'There are no rows to send.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(rows) > 200 then
    raise exception 'A batch holds 200 rows at most. Send the rest as another batch.' using errcode = 'P0001';
  end if;

  select count(*) into n from public.draft_batches where author_id = me and created_at > now() - interval '1 day';
  if n >= 3 then raise exception 'Slow down a little: 3 batches a day at most.' using errcode = 'P0001'; end if;
  select (select count(*) from public.drafts where author_id = me and batch_id is null and created_at > now() - interval '1 hour')
       + (select count(*) from public.draft_batches where author_id = me and created_at > now() - interval '1 hour')
  into n;
  if n >= 20 then raise exception 'Slow down a little: 20 Drafts an hour at most.' using errcode = 'P0001'; end if;

  insert into public.draft_batches (game_id, block_key, title, source, author_id)
  values (g, block, left(trim(title), 160), left(trim(source), 300), me)
  returning id into bid;

  for r in select * from jsonb_array_elements(rows) loop
    if jsonb_typeof(r -> 'content') <> 'object' then
      raise exception 'A row is missing its content.' using errcode = 'P0001';
    end if;
    if octet_length((r -> 'content')::text) > 20000 then
      raise exception 'A row is too long to send.' using errcode = 'P0001';
    end if;
    name := trim(coalesce(r -> 'content' ->> 'name', ''));
    if char_length(name) not between 3 and 120 then
      raise exception 'Every row needs a name of 3 to 120 characters ("%").', left(name, 40) using errcode = 'P0001';
    end if;
    card := nullif(r ->> 'card', '')::uuid;
    rev := nullif(r ->> 'revision', '')::bigint;
    if card is not null then
      if not exists (select 1 from public.cards c where c.id = card and c.game_id = g and c.block_key = block) then
        raise exception '"%" points at an entry that isn''t in this Block.', left(name, 40) using errcode = 'P0001';
      end if;
      if rev is null or not exists (select 1 from public.card_revisions cr where cr.id = rev and cr.card_id = card) then
        raise exception '"%" needs the version it was based on.', left(name, 40) using errcode = 'P0001';
      end if;
      if card = any(cards) then
        raise exception 'Two rows change the same entry ("%").', left(name, 40) using errcode = 'P0001';
      end if;
      cards := cards || card;
    end if;

    insert into public.drafts (game_id, block_key, card_id, base_revision_id, kind, title, content, source, theory, author_id, status, batch_id)
    values (g, block, card, case when card is null then null else rev end, 'fact', name, r -> 'content',
            left(coalesce(nullif(trim(r ->> 'source'), ''), trim(source)), 300),
            coalesce(r -> 'content' ->> 'flag', '') = 'unconfirmed', me, 'open', bid)
    returning id into did;
    insert into public.draft_credits (draft_id, profile_id, role) values (did, me, 'author');
  end loop;
  return bid;
end $$;
revoke execute on function public.send_batch(text, text, text, text, jsonb) from public, anon;
grant execute on function public.send_batch(text, text, text, text, jsonb) to authenticated;

-- One note in the chat, one Discord line, one inbox note, for a decided batch -----------------
create or replace function public.batch_notes(b public.draft_batches, shipped int, aside int) returns void
language plpgsql security definer set search_path = public as $$
declare
  page text;
  who  text;
  href text;
  line text;
  gtitle text;
begin
  select page_key into page from public.game_blocks where game_id = b.game_id and block_key = b.block_key;
  select title into gtitle from public.games where id = b.game_id;
  -- Notes must never undo a decision: if writing one fails, it's skipped.
  begin
    insert into public.chat_messages (game_id, author_id, body, block_key, thread_key, kind, event)
    values (b.game_id, coalesce(b.decided_by, b.author_id),
      left(case when b.status = 'stable' then b.title || ' is now in the app.'
                else b.title || ' was declined' || coalesce(': ' || b.decline_reason, '.') end, 4000),
      page, 'block:' || b.block_key, 'system',
      jsonb_build_object('type', case when b.status = 'stable' then 'batch_published' else 'batch_declined' end,
        'batch', b.id, 'author', b.author_id, 'shipped', shipped, 'aside', aside, 'reason', b.decline_reason));
  exception when others then null;
  end;
  begin
    insert into public.inbox (profile_id, game_id, type, payload)
    values (b.author_id, b.game_id, case when b.status = 'stable' then 'batch_published' else 'batch_declined' end,
      jsonb_build_object('batch', b.id,
        'title', case when b.status = 'stable' then b.title || ' is in the ' || coalesce(gtitle, 'game') || ' app'
                      else b.title || ' wasn''t published' end,
        'body', case when b.status <> 'stable' then coalesce(b.decline_reason, '')
                     when aside > 0 then shipped || ' published. ' || aside || ' set aside as Drafts of their own, because those entries changed since you sent them or couldn''t be published.'
                     else 'Thanks for filling in ' || shipped || ' entries.' end,
        'href', '/g/' || b.game_id || '/workshop'));
  exception when others then null;
  end;
  -- Discord: one line for the batch, when the game's server takes "New in the app".
  if b.status = 'stable' and shipped > 0 then
    begin
      if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'discord_hooks')
         and exists (select 1 from public.discord_hooks h where h.game_id = b.game_id and h.status = 'ok' and 'published' = any(h.kinds)) then
        select coalesce(nullif(pr.display_name, ''), pr.username) into who from public.profiles pr where pr.id = b.author_id;
        href := public.village_url() || '/g/' || b.game_id || coalesce('/' || page || '/' || b.block_key, '');
        line := '• [' || public.discord_safe(b.title) || '](' || href || ') · found by ' || public.discord_safe(coalesce(who, 'a villager'), 40);
        insert into public.discord_outbox (game_id, kind, line, ref_id) values (b.game_id, 'published', line, b.id)
        on conflict do nothing;
      end if;
    exception when others then null;
    end;
  end if;
end $$;
revoke execute on function public.batch_notes(public.draft_batches, int, int) from public, anon, authenticated;

-- Publishing a batch (moderators, any time) -------------------------------------------------------
create or replace function public.ship_batch(batch uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b       public.draft_batches;
  d       public.drafts;
  cur     bigint;
  shipped int := 0;
  aside   int := 0;
begin
  select * into b from public.draft_batches where id = batch for update;
  if b.id is null then raise exception 'That batch no longer exists.' using errcode = 'P0001'; end if;
  if auth.uid() is null or not public.is_moderator(b.game_id) then
    raise exception 'Only this game''s moderators can publish a batch.' using errcode = 'P0001';
  end if;
  if b.status <> 'open' then raise exception 'This batch has already been decided.' using errcode = 'P0001'; end if;

  for d in select * from public.drafts where batch_id = batch and status in ('checking', 'open', 'approved') order by created_at, id loop
    if d.card_id is not null then
      select revision_id into cur from public.card_pointers where card_id = d.card_id and channel = 'stable';
      if cur is distinct from d.base_revision_id then
        update public.drafts set batch_id = null where id = d.id;
        aside := aside + 1;
        continue;
      end if;
    elsif exists (
      select 1 from public.cards c
      join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
      join public.card_revisions r on r.id = p.revision_id
      where c.game_id = d.game_id and c.block_key = d.block_key
        and lower(trim(r.content ->> 'name')) = lower(trim(d.content ->> 'name'))) then
      update public.drafts set batch_id = null where id = d.id;
      aside := aside + 1;
      continue;
    end if;
    -- One row that can't be published (an odd value, a clash) is set aside as its own Draft,
    -- and the rest still publish.
    begin
      perform public.ship_draft(d.id);
      shipped := shipped + 1;
    exception when others then
      update public.drafts set batch_id = null where id = d.id;
      aside := aside + 1;
    end;
  end loop;

  update public.draft_batches set status = 'stable', decided_by = auth.uid(), decided_at = now(), decline_reason = null
  where id = batch returning * into b;
  perform public.batch_notes(b, shipped, aside);
  return jsonb_build_object('shipped', shipped, 'aside', aside);
end $$;
revoke execute on function public.ship_batch(uuid) from public, anon;
grant execute on function public.ship_batch(uuid) to authenticated;

-- Declining a batch (moderators), with a reason for the sender ----------------------------------
create or replace function public.decline_batch(batch uuid, reason text) returns void
language plpgsql security definer set search_path = public as $$
declare b public.draft_batches;
begin
  select * into b from public.draft_batches where id = batch for update;
  if b.id is null then raise exception 'That batch no longer exists.' using errcode = 'P0001'; end if;
  if auth.uid() is null or not public.is_moderator(b.game_id) then
    raise exception 'Only this game''s moderators can decline a batch.' using errcode = 'P0001';
  end if;
  if b.status <> 'open' then raise exception 'This batch has already been decided.' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(reason, ''))) < 3 then
    raise exception 'Say in a few words why, so they know what to fix.' using errcode = 'P0001';
  end if;
  update public.drafts set status = 'declined', decided_by = auth.uid(), decided_at = now(), decline_reason = left(trim(reason), 300)
  where batch_id = batch and status in ('checking', 'open', 'approved');
  update public.draft_batches set status = 'declined', decided_by = auth.uid(), decided_at = now(), decline_reason = left(trim(reason), 300)
  where id = batch returning * into b;
  perform public.batch_notes(b, 0, 0);
end $$;
revoke execute on function public.decline_batch(uuid, text) from public, anon;
grant execute on function public.decline_batch(uuid, text) to authenticated;

-- The sender takes back an undecided batch -------------------------------------------------------
create or replace function public.withdraw_batch(batch uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.draft_batches;
begin
  select * into b from public.draft_batches where id = batch for update;
  if b.id is null or b.author_id is distinct from auth.uid() then
    raise exception 'Only the person who sent a batch can take it back.' using errcode = 'P0001';
  end if;
  if b.status <> 'open' then raise exception 'This batch has already been decided.' using errcode = 'P0001'; end if;
  update public.drafts set status = 'removed' where batch_id = batch and status in ('checking', 'open', 'approved');
  update public.draft_batches set status = 'removed' where id = batch;
end $$;
revoke execute on function public.withdraw_batch(uuid) from public, anon;
grant execute on function public.withdraw_batch(uuid) to authenticated;

-- "This row's off": it leaves the batch as a Draft of its own, and the reason goes to moderators --
create or replace function public.set_aside_row(draft uuid, note text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.drafts; b public.draft_batches; who text;
begin
  if auth.uid() is null then raise exception 'Sign in to set a row aside.' using errcode = 'P0001'; end if;
  select * into d from public.drafts where id = draft for update;
  if d.id is null or d.batch_id is null then raise exception 'That row isn''t in a batch.' using errcode = 'P0001'; end if;
  select * into b from public.draft_batches where id = d.batch_id;
  if b.status <> 'open' then raise exception 'This batch has already been decided.' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(note, ''))) < 3 then
    raise exception 'Say in a few words what''s off, so it can be fixed.' using errcode = 'P0001';
  end if;
  -- Filed as a report, which also keeps the reports' own limit (20 an hour) and one per person.
  insert into public.flags (draft_id, reason, note, reporter_id) values (d.id, 'wrong', left(trim(note), 500), auth.uid());
  update public.drafts set batch_id = null where id = d.id;
  if auth.uid() is distinct from b.author_id then
    select coalesce(nullif(pr.display_name, ''), pr.username) into who from public.profiles pr where pr.id = auth.uid();
    begin
      insert into public.inbox (profile_id, game_id, type, payload)
      values (b.author_id, b.game_id, 'batch_row_aside', jsonb_build_object('batch', b.id, 'draft', d.id,
        'title', coalesce(who, 'Someone') || ' set aside ' || d.title || ' from ' || b.title,
        'body', left(trim(note), 300), 'href', '/g/' || b.game_id || '/workshop'));
    exception when others then null;
    end;
  end if;
end $$;
revoke execute on function public.set_aside_row(uuid, text) from public, anon;
grant execute on function public.set_aside_row(uuid, text) to authenticated;
