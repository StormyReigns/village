-- The Staff room (Matt, 2026-11-22; docs/staff.md): one place for everyone who moderates. Three panels,
-- like the Workshop: tools, stats and links on the left, the staff chat in the middle, and a feed of what
-- happened across every game on the right. Open to every moderator (of any game) and the Founder.
--
-- Run order: any time after 20261204000000_game_settings.sql (already run). Safe to run twice.
-- Until it's run, /staff says the database needs an update; nothing else changes.
--
-- What it adds:
-- 1. is_staff(): a moderator of any game, or the Founder.
-- 2. staff_messages: the staff chat, readable and writable only by staff, with replies, 20 a minute,
--    and taking back your own message (staff_remove_message; a Village-wide moderator can take back any).
-- 3. staff_feed(before, lim): the site feed, read from what the database already records (no new logging):
--    entries published, declined, hidden, removed and brought back; chat messages hidden; reports and
--    flags coming in and being handled; games started and launched; a villager's first Draft.
-- 4. staff_stats(): the numbers for the left panel, and what's waiting in each game.
-- Nothing in the app's own tables changes.

-- 1. Who's staff ---------------------------------------------------------------------------------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.moderators m where m.profile_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_founder))
$$;
-- Visitors may call it too (it says false for them): the staff chat's read policy calls it, and a
-- visitor's query must come back empty rather than fail.
revoke execute on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- 2. The staff chat -------------------------------------------------------------------------------
create table if not exists public.staff_messages (
  id         bigint generated always as identity primary key,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  reply_to   bigint references public.staff_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id)
);
create index if not exists staff_messages_created_idx on public.staff_messages (created_at desc);

-- created_at is always the moment a row arrives (20261111130000); named to run before the check below.
drop trigger if exists a0_created_at_now on public.staff_messages;
create trigger a0_created_at_now before insert or update on public.staff_messages
  for each row execute function public.created_at_now();

-- A new message: not already taken back, and 20 a minute at most.
-- Not security definer: it has to see who is sending (a player, or the SQL Editor), and staff can read the rows it counts.
create or replace function public.staff_message_check() returns trigger
language plpgsql set search_path = public as $$
declare recent int;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  new.removed_at := null;
  new.removed_by := null;
  select count(*) into recent from public.staff_messages
  where author_id = new.author_id and created_at > now() - interval '1 minute';
  if recent >= 20 then
    raise exception 'Slow down a little: 20 messages a minute at most.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists staff_message_check on public.staff_messages;
create trigger staff_message_check before insert on public.staff_messages
  for each row execute function public.staff_message_check();

alter table public.staff_messages enable row level security;
drop policy if exists "staff read staff chat" on public.staff_messages;
create policy "staff read staff chat" on public.staff_messages for select using (public.is_staff());
drop policy if exists "staff write staff chat" on public.staff_messages;
create policy "staff write staff chat" on public.staff_messages for insert
  with check (public.is_staff() and author_id = auth.uid());
-- No update or delete policy: taking a message back goes through staff_remove_message.

create or replace function public.staff_remove_message(mid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare m public.staff_messages;
begin
  select * into m from public.staff_messages where id = mid;
  if m.id is null then raise exception 'That message isn''t here any more.' using errcode = 'P0001'; end if;
  if not public.is_staff() or (m.author_id <> auth.uid() and not public.is_moderator(null)) then
    raise exception 'Only the person who wrote it, or a Village-wide moderator, can take it back.' using errcode = 'P0001';
  end if;
  update public.staff_messages set removed_at = now(), removed_by = auth.uid() where id = mid and removed_at is null;
end $$;
revoke execute on function public.staff_remove_message(bigint) from public, anon;
grant execute on function public.staff_remove_message(bigint) to authenticated;

-- Live: new messages and take-backs reach everyone in the room (RLS still decides who receives them).
alter table public.staff_messages replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'staff_messages') then
    alter publication supabase_realtime add table public.staff_messages;
  end if;
end $$;

-- 3. The site feed --------------------------------------------------------------------------------
-- One row per thing that happened, newest first, before `before`. `kind` says what it was:
--   published, removed, restored            (changes in the apps)
--   declined, hidden, chat_hidden, report_handled   (moderator actions)
--   report, flag                            (new reports)
--   game_started, game_launched, first_draft (new games and Builders)
-- `who` is the person who did it; ids let the page link to the thing itself.
drop function if exists public.staff_feed(timestamptz, int);
create function public.staff_feed(before timestamptz default null, lim int default 60)
returns table (at timestamptz, kind text, game_id text, who uuid, who_name text, title text, detail text,
               draft_id uuid, card_id uuid, block_key text, message_id bigint, ref_id bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  b timestamptz := coalesce(before, now() + interval '1 minute');
  n int := least(greatest(coalesce(lim, 60), 1), 200);
begin
  if not public.is_staff() then
    raise exception 'The Staff room is for moderators.' using errcode = 'P0001';
  end if;
  return query
  with ev as (
    -- Drafts decided: published (or removed), declined, hidden.
    (select d.decided_at as at,
            case when d.status = 'stable' and d.action = 'remove' then 'removed'
                 when d.status = 'stable' then 'published'
                 when d.status = 'declined' then 'declined' else 'hidden' end as kind,
            d.game_id, d.decided_by as who, d.title, d.decline_reason as detail,
            d.id as draft_id, d.card_id, d.block_key, null::bigint as message_id, null::bigint as ref_id
     from public.drafts d
     where d.decided_at is not null and d.decided_at < b and d.status in ('stable', 'declined', 'removed') and d.batch_id is null
     order by d.decided_at desc limit n)
    union all
    -- Entries brought back (restore_entry writes a note with restored: true).
    (select c.created_at, 'restored', c.game_id, c.author_id, c.body, null, c.linked_draft_id, null::uuid, c.block_key, c.id, null::bigint
     from public.chat_messages c
     where c.kind = 'system' and c.event ->> 'restored' = 'true' and c.created_at < b
     order by c.created_at desc limit n)
    union all
    -- Chat messages hidden by a moderator.
    (select c.removed_at, 'chat_hidden', c.game_id, c.removed_by, left(c.body, 140), null, null::uuid, null::uuid, c.block_key, c.id, null::bigint
     from public.chat_messages c
     where c.removed_at is not null and c.removed_at < b and c.removed_by is not null and c.removed_by <> c.author_id
     order by c.removed_at desc limit n)
    union all
    -- Flags: coming in, and handled.
    (select f.created_at, 'flag', f.game_id, f.reporter_id, f.reason, left(f.note, 140), f.draft_id, null::uuid, null::text, f.message_id, f.id
     from public.flags f where f.created_at < b order by f.created_at desc limit n)
    union all
    (select f.handled_at, 'report_handled', f.game_id, f.handled_by, f.reason, f.status, f.draft_id, null::uuid, null::text, f.message_id, f.id
     from public.flags f where f.handled_at is not null and f.handled_at < b order by f.handled_at desc limit n)
    union all
    -- "Was this right?" reports from the app (signed-out ones have no reporter).
    (select r.created_at, 'report', r.game_id, r.reporter_id, r.kind, left(r.body, 140), r.draft_id, r.card_id, null::text, null::bigint, r.id
     from public.reports r where r.created_at < b order by r.created_at desc limit n)
    union all
    -- Games started and launched.
    (select g.created_at, 'game_started', g.id, g.created_by, g.title, null, null::uuid, null::uuid, null::text, null::bigint, null::bigint
     from public.games g where g.created_by is not null and g.created_at < b order by g.created_at desc limit n)
    union all
    (select g.launched_at, 'game_launched', g.id, null::uuid, g.title, null, null::uuid, null::uuid, null::text, null::bigint, null::bigint
     from public.games g where g.launched_at is not null and g.launched_at < b order by g.launched_at desc limit n)
    union all
    -- A villager's first Draft anywhere.
    (select f.created_at, 'first_draft', f.game_id, f.author_id, f.title, null, f.id, f.card_id, f.block_key, null::bigint, null::bigint
     from (select distinct on (d.author_id) d.* from public.drafts d order by d.author_id, d.created_at) f
     where f.created_at < b order by f.created_at desc limit n)
  )
  select ev.at, ev.kind, ev.game_id, ev.who, coalesce(nullif(p.display_name, ''), p.username), ev.title, ev.detail,
         ev.draft_id, ev.card_id, ev.block_key, ev.message_id, ev.ref_id
  from ev left join public.profiles p on p.id = ev.who
  order by ev.at desc
  limit n;
end $$;
revoke execute on function public.staff_feed(timestamptz, int) from public, anon;
grant execute on function public.staff_feed(timestamptz, int) to authenticated;

-- 4. The numbers ----------------------------------------------------------------------------------
create or replace function public.staff_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'The Staff room is for moderators.' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'villagers', (select count(*) from public.profiles),
    'new_this_week', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_this_week', (select count(distinct a) from (
        select author_id as a from public.chat_messages where created_at > now() - interval '7 days' and kind = 'chat'
        union select author_id from public.drafts where created_at > now() - interval '7 days') s),
    'games_live', (select count(*) from public.games where status <> 'draft'),
    'games_building', (select count(*) from public.games where status = 'draft'),
    'published_this_week', (select count(*) from public.drafts where status = 'stable' and decided_at > now() - interval '7 days'),
    'games', coalesce((select jsonb_agg(jsonb_build_object(
        'id', g.id, 'title', g.title, 'status', g.status,
        'mine', public.is_moderator(g.id),
        'waiting', (select count(*) from public.drafts d where d.game_id = g.id and d.status in ('checking', 'open', 'approved') and d.batch_id is null),
        'flags', (select count(*) from public.flags f where f.game_id = g.id and f.status = 'open'),
        'notices', (select count(*) from public.reports r where r.game_id = g.id and r.status = 'notice'))
        order by g.title) from public.games g), '[]'::jsonb));
end $$;
revoke execute on function public.staff_stats() from public, anon;
grant execute on function public.staff_stats() to authenticated;

-- What to read in the SQL Editor (it only shows the last result).
select
  (select count(*) from pg_tables where tablename = 'staff_messages') = 1 as staff_chat_table,
  (select count(*) from pg_proc where proname in ('is_staff', 'staff_feed', 'staff_stats', 'staff_remove_message')) = 4 as staff_functions,
  (select count(*) from public.moderators) + (select count(*) from public.profiles where is_founder) as people_who_can_open_it;
