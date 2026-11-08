-- Videos (docs/blocks/videos.md): YouTube videos on anything in a game's app, voted "This helped"
-- or "Didn't help" and sorted by Standouts. Safe to run twice.
--
-- Run after 20261108000000_questions.sql and 20261108120000_mysteries_to_questions.sql: the
-- reports part below names flags.question_id and reads public.questions.
--
--   videos: one list for every placement. Each video is about one thing: an entry (card_id),
--           or later a whole Block (block_key) or Page (page_key). One vote and ranking for all.
--   videos ── video_votes (one per player per video: +1 helped, -1 didn't help)
--   flags.video_id (a report about a video, handled on the Notice Board)
--
-- Only YouTube's video id and a start time are kept. The title and the channel (the credit) are
-- read from YouTube itself whenever a video shows (/api/video-info), never typed by whoever
-- added it, so the credit can't be faked and stays right if the creator renames it.
-- Village never hosts a video: it plays in YouTube's own player (youtube-nocookie.com).

-- Videos -----------------------------------------------------------------------------------
create table if not exists public.videos (
  id            uuid primary key default gen_random_uuid(),
  game_id       text not null references public.games (id) on delete cascade,  -- filled from the entry, if it's on one
  card_id       uuid references public.cards (id) on delete cascade,           -- an entry it's about
  block_key     text check (block_key ~ '^[a-z0-9-]{1,64}$'),                  -- or a whole Block (later)
  page_key      text check (page_key ~ '^[a-z0-9-]{2,48}$'),                   -- or a whole Page (later)
  youtube_id    text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  start_seconds int  not null default 0 check (start_seconds between 0 and 86400),
  added_by      uuid references public.profiles (id) on delete set null,
  status        text not null default 'live' check (status in ('live', 'removed')),
  removed_by    uuid references public.profiles (id) on delete set null,
  removed_at    timestamptz,
  created_at    timestamptz not null default now(),
  check (num_nonnulls(card_id, block_key, page_key) = 1),
  -- Once per place; a removed one can't simply be added back.
  unique (card_id, youtube_id),
  unique (game_id, block_key, youtube_id),
  unique (game_id, page_key, youtube_id)
);
create index if not exists videos_card_idx on public.videos (card_id) where status = 'live';
create index if not exists videos_game_idx on public.videos (game_id, status);
create index if not exists videos_place_idx on public.videos (game_id, page_key, block_key) where card_id is null and status = 'live';

-- The game comes from the entry, and a Block or Page must exist in that game's app. A new video
-- always starts live, so nobody can file a video under another game or add one already removed.
create or replace function public.video_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.card_id is not null then
    new.game_id := (select game_id from public.cards where id = new.card_id);
    if new.game_id is null then
      raise exception 'That entry isn''t in the app.' using errcode = 'P0001';
    end if;
  elsif new.block_key is not null then
    if not exists (select 1 from public.game_blocks where game_id = new.game_id and block_key = new.block_key) then
      raise exception 'That Block isn''t in the app.' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from public.app_pages where game_id = new.game_id and page_key = new.page_key) then
    raise exception 'That Page isn''t in the app.' using errcode = 'P0001';
  end if;
  new.status := 'live';
  new.removed_by := null;
  new.removed_at := null;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists videos_defaults on public.videos;
create trigger videos_defaults before insert on public.videos
  for each row execute function public.video_defaults();

-- Votes ------------------------------------------------------------------------------------
create table if not exists public.video_votes (
  video_id   uuid not null references public.videos (id) on delete cascade,
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (video_id, voter_id)
);

-- Who can do what ----------------------------------------------------------------------------
alter table public.videos enable row level security;
alter table public.video_votes enable row level security;

drop policy if exists "read live videos" on public.videos;
create policy "read live videos" on public.videos for select
  using (status = 'live' or added_by = auth.uid() or public.is_moderator(game_id));
drop policy if exists "add videos" on public.videos;
create policy "add videos" on public.videos for insert
  with check (auth.uid() is not null and added_by = auth.uid());
-- Removing goes through remove_video() below; nobody edits a video row directly.
revoke update, delete on public.videos from anon, authenticated;

-- Your own votes only; the totals come from video_tallies(), so who voted how stays private.
-- Nobody votes on a video they added, like authors don't vote on their own Drafts.
drop policy if exists "read own video votes" on public.video_votes;
create policy "read own video votes" on public.video_votes for select using (voter_id = auth.uid());
drop policy if exists "vote on videos" on public.video_votes;
create policy "vote on videos" on public.video_votes for insert
  with check (voter_id = auth.uid() and exists (
    select 1 from public.videos v where v.id = video_id and v.status = 'live' and v.added_by is distinct from auth.uid()));
drop policy if exists "change own video vote" on public.video_votes;
create policy "change own video vote" on public.video_votes for update
  using (voter_id = auth.uid())
  with check (voter_id = auth.uid() and exists (
    select 1 from public.videos v where v.id = video_id and v.status = 'live' and v.added_by is distinct from auth.uid()));
drop policy if exists "take back own video vote" on public.video_votes;
create policy "take back own video vote" on public.video_votes for delete using (voter_id = auth.uid());

-- Totals for the videos asked about, wherever they show (the app hides them below 5 votes, like
-- other opinion votes).
create or replace function public.video_tallies(ids uuid[])
returns table (video_id uuid, helped int, not_helped int)
language sql stable security definer set search_path = public as $$
  select v.id,
         count(vv.value) filter (where vv.value = 1)::int,
         count(vv.value) filter (where vv.value = -1)::int
  from public.videos v
  left join public.video_votes vv on vv.video_id = v.id
  where v.id = any(ids[1:500]) and v.status = 'live'
  group by v.id
$$;
grant execute on function public.video_tallies(uuid[]) to anon, authenticated;

-- Taking a video down: whoever added it, or a moderator of its game. Its reports close too.
-- (flags.video_id is added further down; plpgsql only looks for it when this runs.)
create or replace function public.remove_video(v uuid) returns void
language plpgsql security definer set search_path = public as $$
declare vid public.videos;
begin
  select * into vid from public.videos where id = v;
  if vid.id is null then raise exception 'That video isn''t here.' using errcode = 'P0001'; end if;
  if not (vid.added_by = auth.uid() or public.is_moderator(vid.game_id)) then
    raise exception 'Only whoever added it or a moderator can take it down.' using errcode = 'P0001';
  end if;
  update public.videos set status = 'removed', removed_by = auth.uid(), removed_at = now() where id = v;
  update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
  where video_id = v and status = 'open';
end $$;
grant execute on function public.remove_video(uuid) to authenticated;

-- Rate limits: their own, kept apart from slow_down() -------------------------------------------
create or replace function public.videos_slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.videos
  where added_by = new.added_by and created_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'Slow down a little: 10 videos an hour at most.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists videos_slow_down on public.videos;
create trigger videos_slow_down before insert on public.videos
  for each row execute function public.videos_slow_down();

create or replace function public.video_votes_slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.video_votes
  where voter_id = new.voter_id and created_at > now() - interval '1 hour';
  if recent >= 120 then
    raise exception 'Slow down a little: 120 video votes an hour at most.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists video_votes_slow_down on public.video_votes;
create trigger video_votes_slow_down before insert on public.video_votes
  for each row execute function public.video_votes_slow_down();

-- Reports: a flag can point at a video ------------------------------------------------------------
alter table public.flags add column if not exists video_id uuid references public.videos (id) on delete cascade;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'flags_one_target') then
    alter table public.flags drop constraint flags_one_target;
  end if;
  alter table public.flags add constraint flags_one_target
    check (num_nonnulls(message_id, draft_id, question_id, video_id) = 1);
  if not exists (select 1 from pg_constraint where conname = 'flags_reporter_id_video_id_key') then
    alter table public.flags add constraint flags_reporter_id_video_id_key unique (reporter_id, video_id);
  end if;
end $$;

create or replace function public.flag_game() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.game_id := coalesce(
    (select game_id from public.chat_messages where id = new.message_id),
    (select game_id from public.drafts where id = new.draft_id),
    (select game_id from public.questions where id = new.question_id),
    (select game_id from public.videos where id = new.video_id));
  return new;
end $$;
