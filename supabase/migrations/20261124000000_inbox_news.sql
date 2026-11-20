-- More news for your inbox (docs/inbox.md). Safe to run twice. Run it on its own: nothing in
-- seed-app.sql depends on it, and it depends only on migrations already run.
--
-- New kinds of inbox items, all written by the database (players still can't write to the inbox):
--   draft_published / draft_declined  one of your own Drafts (not part of a batch) was decided
--                                     by someone else; declines carry the reason
--   mention                           someone @mentioned you in a chat message (<@id>, src/lib/refs.ts)
--   draft_activity                    replies, or "Seems wrong" votes, on a Draft of yours that is
--                                     still waiting. One item per Draft: while it's unread, new
--                                     activity counts up on it and moves it to the top
--   title_up                          your title moved up: tenure (active weeks) or role (harvests)
--   badge_up                          a game badge got its color, or a new leaf
--
-- Titles and badges use the same steps as src/lib/ranks.ts (keep the two in step). Which steps
-- someone has already been told about is kept in inbox_marks, so clearing your inbox never
-- sends the same news twice. Everyone's current standing is marked at the bottom of this file
-- without sending anything, so only steps reached from now on make news.
--
-- Every trigger here is wrapped: a note that fails is skipped, and never blocks a publish, a
-- vote or a message.

-- Indexes for "what did this person do this week" ------------------------------------------------
create index if not exists chat_author_idx  on public.chat_messages (author_id, created_at);
create index if not exists drafts_author_idx on public.drafts (author_id, created_at);
create index if not exists votes_voter_idx  on public.draft_votes (voter_id, created_at);
create index if not exists inbox_draft_activity_idx on public.inbox (profile_id, (payload ->> 'draft'))
  where type = 'draft_activity' and read_at is null;

-- Steps already announced: 'role:Builder', 'keeper:1', 'tenure:Settled', 'badge:<game>:<leaves>' --
create table if not exists public.inbox_marks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mark       text not null check (char_length(mark) <= 120),
  created_at timestamptz not null default now(),
  primary key (profile_id, mark)
);
alter table public.inbox_marks enable row level security;  -- no policies: only the functions below
revoke all on public.inbox_marks from anon, authenticated;

-- 1. Your Draft was decided ----------------------------------------------------------------------
create or replace function public.inbox_draft_decided() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ename text; bkey text; btype text; slug text; pkey text;
  gone boolean := (to_jsonb(new) ->> 'action') = 'remove';
begin
  if new.status is not distinct from old.status or new.status not in ('stable', 'declined') then return new; end if;
  -- Deciding your own Draft isn't news to you.
  if new.decided_by is not distinct from new.author_id then return new; end if;
  begin
    if new.status = 'stable' and new.card_id is not null and not gone then
      select cd.block_key, cd.slug, b.page_key, b.type, rev.content ->> 'name' into bkey, slug, pkey, btype, ename
      from public.cards cd
      left join public.game_blocks b on b.game_id = cd.game_id and b.block_key = cd.block_key
      left join public.card_pointers p on p.card_id = cd.id and p.channel = 'stable'
      left join public.card_revisions rev on rev.id = p.revision_id
      where cd.id = new.card_id;
    end if;
    insert into public.inbox (profile_id, game_id, type, payload)
    values (new.author_id, new.game_id,
      case when new.status = 'stable' then 'draft_published' else 'draft_declined' end,
      jsonb_strip_nulls(jsonb_build_object(
        'draft', new.id, 'title', left(new.title, 120), 'by', new.decided_by,
        'removed', case when gone then true end,
        'reason', case when new.status = 'declined' then left(trim(new.decline_reason), 300) end,
        'card', new.card_id, 'entry', left(ename, 80), 'block', bkey, 'blockType', btype, 'slug', slug, 'page', pkey)));
  exception when others then
    null;
  end;
  return new;
end $$;
revoke execute on function public.inbox_draft_decided() from public, anon, authenticated;

-- Batch rows are left out: the batch sends one note of its own (batch_notes).
drop trigger if exists drafts_inbox_decided on public.drafts;
create trigger drafts_inbox_decided after update of status on public.drafts
  for each row when (new.batch_id is null) execute function public.inbox_draft_decided();

-- 2. Activity on a Draft of yours: one item per Draft, counted up while unread --------------------
create or replace function public.inbox_draft_activity(who uuid, draft uuid, g text, title text, what text, msg bigint, by_who uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  existing bigint;
  r int := case when what = 'reply' then 1 else 0 end;
  d int := case when what = 'doubt' then 1 else 0 end;
begin
  select id into existing from public.inbox
  where profile_id = who and type = 'draft_activity' and read_at is null and payload ->> 'draft' = draft::text
  order by created_at desc limit 1;
  if existing is null then
    insert into public.inbox (profile_id, game_id, type, payload)
    values (who, g, 'draft_activity', jsonb_strip_nulls(jsonb_build_object(
      'draft', draft, 'title', left(title, 120), 'replies', r, 'doubts', d, 'message', msg, 'by', by_who)));
  else
    update public.inbox
    set created_at = now(),
        payload = payload
          || jsonb_build_object('replies', coalesce((payload ->> 'replies')::int, 0) + r,
                                'doubts',  coalesce((payload ->> 'doubts')::int, 0) + d)
          || case when msg is not null then jsonb_build_object('message', msg, 'by', by_who) else '{}'::jsonb end
    where id = existing;
  end if;
end $$;
revoke execute on function public.inbox_draft_activity(uuid, uuid, text, text, text, bigint, uuid) from public, anon, authenticated;

-- 3. Titles and badges ---------------------------------------------------------------------------
-- Works out someone's standing and sends news for each step not marked yet. With quiet = true it
-- only marks (used once below, so steps reached before today don't make news). g = a game whose
-- badge may have changed, or null.
create or replace function public.inbox_title_check(who uuid, g text, quiet boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  harvests int; weeks int; in_game int;
  role text; tenure text; stars int; leaves int;
  told_role boolean := false;
  n int;
begin
  select count(*) into harvests from public.drafts where author_id = who and status = 'stable';
  select count(distinct wk) into weeks from (
    select date_trunc('week', created_at at time zone 'UTC') as wk from public.drafts where author_id = who
    union select date_trunc('week', created_at at time zone 'UTC') from public.draft_votes where voter_id = who
    union select date_trunc('week', created_at at time zone 'UTC') from public.chat_messages where author_id = who and removed_at is null
  ) t;
  -- src/lib/ranks.ts: ROLE 1 / 5 / 15 / 40, a Keeper star every 25 from 65; TENURE 4 / 26 / 52.
  role := case when harvests >= 40 then 'Keeper' when harvests >= 15 then 'Architect'
               when harvests >= 5 then 'Artisan' when harvests >= 1 then 'Builder' end;
  stars := case when harvests >= 65 then (harvests - 40) / 25 else 0 end;
  tenure := case when weeks >= 52 then 'Elder' when weeks >= 26 then 'Seasoned' when weeks >= 4 then 'Settled' end;

  if role is not null then
    insert into public.inbox_marks (profile_id, mark) values (who, 'role:' || role) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 and not quiet then
      told_role := true;
      insert into public.inbox (profile_id, game_id, type, payload)
      values (who, g, 'title_up', jsonb_build_object('part', 'role', 'step', role, 'harvests', harvests,
        'tenure', coalesce(tenure, 'New'), 'role', role));
    end if;
  end if;
  if stars > 0 then
    insert into public.inbox_marks (profile_id, mark) values (who, 'keeper:' || stars) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 and not quiet then
      insert into public.inbox (profile_id, game_id, type, payload)
      values (who, g, 'title_up', jsonb_build_object('part', 'star', 'step', 'Keeper', 'stars', stars, 'harvests', harvests,
        'tenure', coalesce(tenure, 'New'), 'role', role));
    end if;
  end if;
  if tenure is not null then
    insert into public.inbox_marks (profile_id, mark) values (who, 'tenure:' || tenure) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 and not quiet then
      insert into public.inbox (profile_id, game_id, type, payload)
      values (who, null, 'title_up', jsonb_build_object('part', 'tenure', 'step', tenure, 'weeks', weeks,
        'tenure', tenure, 'role', coalesce(role, 'Villager')));
    end if;
  end if;

  -- A game badge: colored at 1 harvest in that game, then leaves at 1 / 5 / 15 / 40.
  if g is not null then
    select count(*) into in_game from public.drafts where author_id = who and game_id = g and status = 'stable';
    leaves := (case when in_game >= 1 then 1 else 0 end) + (case when in_game >= 5 then 1 else 0 end)
            + (case when in_game >= 15 then 1 else 0 end) + (case when in_game >= 40 then 1 else 0 end);
    if leaves > 0 then
      insert into public.inbox_marks (profile_id, mark) values (who, 'badge:' || g || ':' || leaves) on conflict do nothing;
      get diagnostics n = row_count;
      -- A very first harvest is already news as a role ("You're a Builder"); the badge rides along.
      if n > 0 and not quiet and not told_role then
        insert into public.inbox (profile_id, game_id, type, payload)
        values (who, g, 'badge_up', jsonb_build_object('leaves', leaves, 'harvests', in_game));
      end if;
    end if;
  end if;
end $$;
revoke execute on function public.inbox_title_check(uuid, text, boolean) from public, anon, authenticated;

-- Tenure moves only in a new week, so it's checked on someone's first chat, vote or Draft of the
-- week (Monday to Sunday, in UTC, as in activeWeeks).
create or replace function public.inbox_week_check(who uuid, at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare wk timestamptz := date_trunc('week', at at time zone 'UTC') at time zone 'UTC';
begin
  if exists (select 1 from public.chat_messages where author_id = who and created_at >= wk and created_at < at)
     or exists (select 1 from public.drafts where author_id = who and created_at >= wk and created_at < at)
     or exists (select 1 from public.draft_votes where voter_id = who and created_at >= wk and created_at < at) then
    return;
  end if;
  perform public.inbox_title_check(who, null, false);
end $$;
revoke execute on function public.inbox_week_check(uuid, timestamptz) from public, anon, authenticated;

-- 4. Triggers ------------------------------------------------------------------------------------

-- A chat message: @mentions, replies on waiting Drafts, and the week check.
create or replace function public.inbox_chat_news() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mentioned uuid[];
  tdraft text := case when new.thread_key like 'draft:%' then substr(new.thread_key, 7) end;
  tcard text := case when new.thread_key like 'card:%' then substr(new.thread_key, 6) end;
  d record;
begin
  if new.kind is distinct from 'chat' then return new; end if;
  begin
    select coalesce(array_agg(distinct p.id), '{}') into mentioned
    from regexp_matches(new.body, '<@([0-9a-fA-F-]{36})>', 'g') as m(arr)
    join public.profiles p on p.id::text = lower(m.arr[1])
    where p.id <> new.author_id;
    mentioned := mentioned[1:20];

    insert into public.inbox (profile_id, game_id, type, payload)
    select x, new.game_id, 'mention', jsonb_strip_nulls(jsonb_build_object(
      'message', new.id, 'by', new.author_id, 'thread', new.thread_key, 'spoiler', case when new.spoiler then true end))
    from unnest(mentioned) as x;

    -- A message in a waiting Draft's thread (or its entry's) is a reply for the Draft's author,
    -- unless it mentioned them, which already told them.
    for d in
      select dr.id, dr.author_id, dr.title, dr.game_id from public.drafts dr
      where dr.status in ('checking', 'open', 'approved', 'preview')
        and dr.author_id <> new.author_id
        and not (dr.author_id = any (mentioned))
        and (dr.id = new.linked_draft_id or dr.id::text = tdraft or dr.card_id::text = tcard)
      limit 10
    loop
      perform public.inbox_draft_activity(d.author_id, d.id, d.game_id, d.title, 'reply', new.id, new.author_id);
    end loop;

    perform public.inbox_week_check(new.author_id, new.created_at);
  exception when others then
    null;
  end;
  return new;
end $$;
revoke execute on function public.inbox_chat_news() from public, anon, authenticated;

drop trigger if exists chat_inbox_news on public.chat_messages;
create trigger chat_inbox_news after insert on public.chat_messages
  for each row execute function public.inbox_chat_news();

-- A vote: "Seems wrong" on a waiting fact Draft tells its author (no name, no running total of
-- the other votes), and the week check.
create or replace function public.inbox_vote_news() returns trigger
language plpgsql security definer set search_path = public as $$
declare d public.drafts;
begin
  begin
    if new.value = -1 and (tg_op = 'INSERT' or old.value is distinct from -1) then
      select * into d from public.drafts where id = new.draft_id;
      if d.id is not null and d.kind = 'fact' and d.status in ('checking', 'open', 'approved', 'preview')
         and d.author_id <> new.voter_id and (to_jsonb(d) ->> 'action') is distinct from 'remove' then
        perform public.inbox_draft_activity(d.author_id, d.id, d.game_id, d.title, 'doubt', null, null);
      end if;
    end if;
    if tg_op = 'INSERT' then perform public.inbox_week_check(new.voter_id, new.created_at); end if;
  exception when others then
    null;
  end;
  return new;
end $$;
revoke execute on function public.inbox_vote_news() from public, anon, authenticated;

drop trigger if exists votes_inbox_news on public.draft_votes;
create trigger votes_inbox_news after insert or update of value on public.draft_votes
  for each row execute function public.inbox_vote_news();

-- A Draft posted (the week check) or reaching the app (role and badge; batch rows included).
create or replace function public.inbox_draft_news() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform public.inbox_week_check(new.author_id, new.created_at);
    elsif new.status = 'stable' and old.status is distinct from 'stable' then
      perform public.inbox_title_check(new.author_id, new.game_id, false);
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;
revoke execute on function public.inbox_draft_news() from public, anon, authenticated;

drop trigger if exists drafts_inbox_news on public.drafts;
create trigger drafts_inbox_news after insert or update of status on public.drafts
  for each row execute function public.inbox_draft_news();

-- Live updates: activity counting up on an item is an update, so the bell hears those too. -------
-- (The inbox is already in supabase_realtime from 20261108000000.)

-- 5. Mark everyone's current standing, without sending anything ----------------------------------
do $$
declare pr record; gm record;
begin
  for pr in select id from public.profiles loop
    perform public.inbox_title_check(pr.id, null, true);
    for gm in select distinct game_id from public.drafts where author_id = pr.id and status = 'stable' loop
      perform public.inbox_title_check(pr.id, gm.game_id, true);
    end loop;
  end loop;
end $$;

-- What to read: every trigger is in place, and current standings are marked.
select
  (select count(*) from pg_trigger where tgname in ('drafts_inbox_decided', 'chat_inbox_news', 'votes_inbox_news', 'drafts_inbox_news')) as triggers_in_place_of_4,
  (select count(*) from public.inbox_marks) as standings_marked,
  (select count(distinct profile_id) from public.inbox_marks) as villagers_with_a_step;
