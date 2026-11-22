-- Chat polls (docs/chat.md, Matt 2026-11-21): "Design A or Design B?" asked in the Workshop chat.
--
-- The question is the message's own words. `poll` holds 2 to 4 choices (a short label, and a
-- picture if the asker added one) and when it ends: 1 hour, 1 day or 3 days after posting, picked
-- by the asker. Votes are one per person per poll and named (like reactions); you can change yours
-- or take it back while the poll is open. The asker, or a moderator, can end it early with
-- close_poll. Counts show to everyone from the start.
--
-- Run order: any time after 20261101180000_chat_images_replies.sql (already run). Safe to run twice.
-- Until it's run, the chat works as before and the Poll button says the database needs an update.

-- The poll on a message ---------------------------------------------------------------------
-- { "options": [{ "label": "Head only", "image": { "path": "fw/<you>/<file>.webp", "w": 800, "h": 800 } },
--               { "label": "Shoulders" }],
--   "ends_at": "2026-11-22T16:12:00Z" }
alter table public.chat_messages add column if not exists poll jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_poll_check') then
    alter table public.chat_messages add constraint chat_messages_poll_check check (
      poll is null or (jsonb_typeof(poll -> 'options') = 'array'
        and jsonb_array_length(poll -> 'options') between 2 and 4
        and jsonb_typeof(poll -> 'ends_at') = 'string'));
  end if;
end $$;

-- What a player sends is checked and tidied here: a question to ask, short labels, pictures only
-- from the asker's own folder in chat-images, and an end between 1 minute and 3 days from now
-- (the time is set by the database, so a made-up date can't keep a poll open for ever).
-- Migrations and the SQL Editor (the database owner) are left alone.
create or replace function public.chat_poll_check() returns trigger
language plpgsql set search_path = public as $$
declare
  opt jsonb;
  lbl text;
  img jsonb;
  pth text;
  ends timestamptz;
  tidy jsonb := '[]'::jsonb;
begin
  if new.poll is null or current_user not in ('anon', 'authenticated') then return new; end if;
  if char_length(btrim(new.body)) = 0 then
    raise exception 'A poll needs a question.' using errcode = 'P0001';
  end if;
  for opt in select value from jsonb_array_elements(new.poll -> 'options') loop
    lbl := btrim(coalesce(opt ->> 'label', ''));
    if char_length(lbl) not between 1 and 80 then
      raise exception 'Each choice needs a short name (80 letters at most).' using errcode = 'P0001';
    end if;
    img := opt -> 'image';
    if img is not null and jsonb_typeof(img) <> 'null' then
      pth := img ->> 'path';
      if pth is null or pth like '%..%' or split_part(pth, '/', 1) is distinct from new.game_id
         or split_part(pth, '/', 2) <> new.author_id::text or split_part(pth, '/', 3) = '' then
        raise exception 'A choice''s picture has to be one you uploaded here.' using errcode = 'P0001';
      end if;
      tidy := tidy || jsonb_build_array(jsonb_build_object('label', lbl, 'image',
        jsonb_build_object('path', pth, 'w', coalesce((img ->> 'w')::int, 0), 'h', coalesce((img ->> 'h')::int, 0))));
    else
      tidy := tidy || jsonb_build_array(jsonb_build_object('label', lbl));
    end if;
  end loop;
  begin
    ends := (new.poll ->> 'ends_at')::timestamptz;
  exception when others then
    ends := now() + interval '1 day';
  end;
  ends := least(greatest(ends, now() + interval '1 minute'), now() + interval '3 days');
  new.poll := jsonb_build_object('options', tidy, 'ends_at', to_jsonb(ends));
  return new;
end $$;
drop trigger if exists chat_poll_check on public.chat_messages;
create trigger chat_poll_check before insert on public.chat_messages
  for each row execute function public.chat_poll_check();

-- Votes ---------------------------------------------------------------------------------------
create table if not exists public.chat_poll_votes (
  message_id bigint   not null references public.chat_messages (id) on delete cascade,
  profile_id uuid     not null references public.profiles (id) on delete cascade,
  choice     smallint not null check (choice between 0 and 3),
  game_id    text,  -- filled in from the message, for live updates per game
  created_at timestamptz not null default now(),
  voted_at   timestamptz not null default now(),  -- every vote or change, for the slow-down
  primary key (message_id, profile_id)
);
create index if not exists chat_poll_votes_game_idx on public.chat_poll_votes (game_id);

-- A vote (or a change of vote) only lands on an open poll, on a choice it has, on a message that
-- hasn't been removed. It also fills in the game, stamps the time, and keeps to 30 a minute.
create or replace function public.chat_poll_vote_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  msg record;
  recent int;
begin
  select game_id, poll, removed_at into msg from public.chat_messages where id = new.message_id;
  if msg.poll is null or msg.removed_at is not null then
    raise exception 'That poll isn''t here any more.' using errcode = 'P0001';
  end if;
  if (msg.poll ->> 'ends_at')::timestamptz <= now() then
    raise exception 'This poll has ended.' using errcode = 'P0001';
  end if;
  if new.choice >= jsonb_array_length(msg.poll -> 'options') then
    raise exception 'That choice isn''t in this poll.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (new.message_id <> old.message_id or new.profile_id <> old.profile_id) then
    raise exception 'A vote can only change its choice.' using errcode = 'P0001';
  end if;
  -- Flipping a vote back and forth isn't counted below (it's still one row), and each flip goes
  -- out live to everyone in the game, so a change waits a second after the last (hub, 2026-11-22).
  if tg_op = 'UPDATE' and old.voted_at > now() - interval '1 second' then
    raise exception 'Slow down a little.' using errcode = 'P0001';
  end if;
  select count(*) into recent from public.chat_poll_votes
  where profile_id = new.profile_id and voted_at > now() - interval '1 minute';
  if recent >= 30 then
    raise exception 'Slow down a little: 30 votes a minute at most.' using errcode = 'P0001';
  end if;
  new.game_id := msg.game_id;
  new.voted_at := now();
  return new;
end $$;
drop trigger if exists chat_poll_vote_check on public.chat_poll_votes;
create trigger chat_poll_vote_check before insert or update on public.chat_poll_votes
  for each row execute function public.chat_poll_vote_check();

-- created_at is always the moment a player's row arrives (as for every player-written table,
-- 20261111130000). Named to run before the check above.
drop trigger if exists a0_created_at_now on public.chat_poll_votes;
create trigger a0_created_at_now before insert or update on public.chat_poll_votes
  for each row execute function public.created_at_now();

alter table public.chat_poll_votes enable row level security;
drop policy if exists "read poll votes" on public.chat_poll_votes;
create policy "read poll votes" on public.chat_poll_votes for select using (true);
drop policy if exists "vote in polls" on public.chat_poll_votes;
create policy "vote in polls" on public.chat_poll_votes for insert with check (profile_id = auth.uid());
drop policy if exists "change poll vote" on public.chat_poll_votes;
create policy "change poll vote" on public.chat_poll_votes for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
-- Taking a vote back only while the poll is open, so a result can't change after it ends.
drop policy if exists "take back poll vote" on public.chat_poll_votes;
create policy "take back poll vote" on public.chat_poll_votes for delete using (
  profile_id = auth.uid()
  and exists (select 1 from public.chat_messages m
              where m.id = chat_poll_votes.message_id and m.poll is not null and (m.poll ->> 'ends_at')::timestamptz > now()));

-- Ending a poll early: the asker or a moderator. It just moves the end to now.
create or replace function public.close_poll(mid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare msg record;
begin
  select game_id, author_id, poll into msg from public.chat_messages where id = mid;
  if msg.poll is null then
    raise exception 'That poll isn''t here any more.' using errcode = 'P0001';
  end if;
  if auth.uid() is null or (msg.author_id <> auth.uid() and not public.is_moderator(msg.game_id)) then
    raise exception 'Only the person who asked (or a moderator) can end this poll.' using errcode = 'P0001';
  end if;
  if (msg.poll ->> 'ends_at')::timestamptz > now() then
    update public.chat_messages set poll = jsonb_set(poll, '{ends_at}', to_jsonb(now())) where id = mid;
  end if;
end $$;

-- Live updates: votes come, change and go for everyone in the game ---------------------------
alter table public.chat_poll_votes replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_poll_votes') then
    alter publication supabase_realtime add table public.chat_poll_votes;
  end if;
end $$;

-- What to read in the SQL Editor after running this (it only shows the last result).
select
  (select count(*) from information_schema.columns where table_name = 'chat_messages' and column_name = 'poll') = 1 as poll_column,
  (select count(*) from pg_tables where tablename = 'chat_poll_votes') = 1 as votes_table,
  (select count(*) from pg_proc where proname = 'close_poll') = 1 as close_poll_function;
