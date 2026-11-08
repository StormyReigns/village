-- Questions (docs/blocks/questions.md), and an inbox for replies. Safe to run twice.
--
--   questions ─┬─ question_askers ("me too": everyone else who wants to know)
--              └─ drafts.question_id (a Draft that answers it by updating the app)
--   inbox: news for one person, written only by the database (a type plus a payload, so
--          later things like "your Draft shipped" can use it too)
--
-- A question closes one of two ways, each with a short reply to the asker:
--   * a Draft that names it ships: drafts_answer_question below (ship_draft is unchanged)
--   * a Builder links an entry that already has the answer: answer_question()
-- Either way the reply lands in the inbox of the asker and everyone who said "me too".

-- Questions -------------------------------------------------------------------------------
create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  game_id         text not null references public.games (id) on delete cascade,
  page_key        text check (page_key ~ '^[a-z0-9-]{2,48}$'),    -- the Page it's about
  card_id         uuid references public.cards (id) on delete set null,  -- the entry, when it's about one
  body            text not null check (char_length(body) between 3 and 300),
  spoiler         boolean not null default false,
  note            text check (char_length(note) <= 2000),          -- for Builders: what's known so far
  asked_by        uuid references public.profiles (id) on delete set null,  -- null: moved in from Mysteries
  status          text not null default 'open' check (status in ('open', 'answered', 'removed')),
  merged_into     uuid references public.questions (id) on delete set null,
  reply           text check (char_length(reply) <= 500),          -- what the asker reads
  answer_card_id  uuid references public.cards (id) on delete set null,  -- where the answer is
  answer_draft_id uuid references public.drafts (id) on delete set null, -- the Draft that answered it
  answered_by     uuid references public.profiles (id) on delete set null,
  answered_at     timestamptz,
  from_card_id    uuid unique references public.cards (id) on delete set null, -- the Mystery it came from
  created_at      timestamptz not null default now()
);
create index if not exists questions_game_idx on public.questions (game_id, status, created_at);

-- "Me too": one row per person per question. The game is filled in for live updates.
create table if not exists public.question_askers (
  question_id uuid not null references public.questions (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  game_id     text,
  created_at  timestamptz not null default now(),
  primary key (question_id, profile_id)
);
create index if not exists question_askers_game_idx on public.question_askers (game_id);

create or replace function public.question_asker_game() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.game_id := (select game_id from public.questions where id = new.question_id);
  return new;
end $$;
drop trigger if exists question_askers_game on public.question_askers;
create trigger question_askers_game before insert on public.question_askers
  for each row execute function public.question_asker_game();

-- The inbox -------------------------------------------------------------------------------
create table if not exists public.inbox (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game_id    text references public.games (id) on delete cascade,
  type       text not null check (type ~ '^[a-z_]{2,40}$'),   -- e.g. 'question_answered'
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists inbox_profile_idx on public.inbox (profile_id, created_at desc);

-- Drafts can answer a question ----------------------------------------------------------------
alter table public.drafts add column if not exists question_id uuid references public.questions (id) on delete set null;
alter table public.drafts add column if not exists reply text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'drafts_reply_length') then
    alter table public.drafts add constraint drafts_reply_length check (char_length(reply) <= 500);
  end if;
end $$;
create index if not exists drafts_question_idx on public.drafts (question_id) where question_id is not null;

-- Who can do what ---------------------------------------------------------------------------
alter table public.questions       enable row level security;
alter table public.question_askers enable row level security;
alter table public.inbox           enable row level security;

drop policy if exists "read questions" on public.questions;
create policy "read questions" on public.questions for select
  using (status <> 'removed' or public.is_moderator(game_id));
-- Anyone signed in asks, as themselves, an open question with no answer attached.
drop policy if exists "ask" on public.questions;
create policy "ask" on public.questions for insert with check (
  asked_by = auth.uid() and status = 'open' and merged_into is null and note is null and from_card_id is null
  and reply is null and answer_card_id is null and answer_draft_id is null and answered_by is null and answered_at is null);
-- Moderators remove, reopen and tidy. Answering goes through answer_question() or a Draft.
drop policy if exists "mods handle questions" on public.questions;
create policy "mods handle questions" on public.questions for update
  using (public.is_moderator(game_id)) with check (public.is_moderator(game_id));

drop policy if exists "read me toos" on public.question_askers;
create policy "read me toos" on public.question_askers for select using (true);
drop policy if exists "me too" on public.question_askers;
create policy "me too" on public.question_askers for insert with check (
  profile_id = auth.uid()
  and exists (select 1 from public.questions q where q.id = question_id and q.status = 'open'
              and q.asked_by is distinct from auth.uid()));
drop policy if exists "not me" on public.question_askers;
create policy "not me" on public.question_askers for delete using (profile_id = auth.uid());

-- Your inbox is yours alone. Nobody writes to it by hand; you can only mark things read.
drop policy if exists "read own inbox" on public.inbox;
create policy "read own inbox" on public.inbox for select using (profile_id = auth.uid());
drop policy if exists "mark own inbox" on public.inbox;
create policy "mark own inbox" on public.inbox for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "clear own inbox" on public.inbox;
create policy "clear own inbox" on public.inbox for delete using (profile_id = auth.uid());
revoke insert, update on public.inbox from anon, authenticated;
grant update (read_at) on public.inbox to authenticated;

-- Rate limits: questions and "me too"s have their own, kept apart from slow_down() ------------
create or replace function public.questions_slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.questions
  where asked_by = new.asked_by and created_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'Slow down a little: 10 questions an hour at most.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists questions_slow_down on public.questions;
create trigger questions_slow_down before insert on public.questions
  for each row execute function public.questions_slow_down();

create or replace function public.me_too_slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.question_askers
  where profile_id = new.profile_id and created_at > now() - interval '1 hour';
  if recent >= 60 then
    raise exception 'Slow down a little: 60 "me too"s an hour at most.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists question_askers_slow_down on public.question_askers;
create trigger question_askers_slow_down before insert on public.question_askers
  for each row execute function public.me_too_slow_down();

-- Sending the reply -----------------------------------------------------------------------------
-- One inbox item for the asker and each "me too", leaving out whoever answered. The payload
-- stays small: ids, a short excerpt of the reply, and where the entry is, for the link. The
-- question's own words aren't copied: the inbox reads them from the question, so a question
-- removed later doesn't linger in anyone's inbox. Only the database calls this (from the
-- trigger and answer_question below), never a villager.
create or replace function public.send_question_reply(q uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.questions;
  c record;
  n int;
begin
  select * into r from public.questions where id = q;
  if r.id is null or r.status <> 'answered' then return 0; end if;
  select cd.block_key, cd.slug, b.page_key, b.type, rev.content->>'name' as name into c
  from public.cards cd
  left join public.game_blocks b on b.game_id = cd.game_id and b.block_key = cd.block_key
  left join public.card_pointers p on p.card_id = cd.id and p.channel = 'stable'
  left join public.card_revisions rev on rev.id = p.revision_id
  where cd.id = r.answer_card_id;
  insert into public.inbox (profile_id, game_id, type, payload)
  select w.who, r.game_id, 'question_answered', jsonb_strip_nulls(jsonb_build_object(
    'question', r.id, 'reply', left(r.reply, 140), 'by', r.answered_by, 'draft', r.answer_draft_id,
    'card', r.answer_card_id, 'entry', left(c.name, 80), 'block', c.block_key, 'blockType', c.type, 'slug', c.slug, 'page', c.page_key))
  from (select r.asked_by as who union select a.profile_id from public.question_askers a where a.question_id = r.id) w
  where w.who is not null and w.who is distinct from r.answered_by;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.send_question_reply(uuid) from public, anon, authenticated;

-- Answer 1: a Draft that carries the question ships ----------------------------------------------
-- In the style of drafts_chat_note: fires only on a real change to 'stable', and is wrapped so
-- it can never undo a publish. The first Draft to ship answers it; later ones change nothing.
create or replace function public.draft_answers_question() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.question_id is null or new.status is not distinct from old.status or new.status <> 'stable' then return new; end if;
  begin
    update public.questions
    set status = 'answered',
        reply = coalesce(nullif(trim(new.reply), ''), 'Updated ' || new.title),
        answer_card_id = new.card_id, answer_draft_id = new.id,
        answered_by = new.author_id, answered_at = now()
    where id = new.question_id and status = 'open';
    if found then perform public.send_question_reply(new.question_id); end if;
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists drafts_answer_question on public.drafts;
create trigger drafts_answer_question after update of status on public.drafts
  for each row execute function public.draft_answers_question();

-- Answer 2: "It's already there" ----------------------------------------------------------------
-- Anyone signed in links the entry that answers it and writes the reply. Nothing in the app
-- changes, so the question closes straight away. Moderators can reopen one that missed.
create or replace function public.answer_question(q uuid, card uuid, reply text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.questions;
  recent int;
  words text := trim(coalesce(reply, ''));
begin
  if auth.uid() is null then raise exception 'Sign in to answer.'; end if;
  select * into r from public.questions where id = q for update;
  if r.id is null or r.status = 'removed' then raise exception 'That question is gone.'; end if;
  if r.status <> 'open' then raise exception 'That question has already been answered.'; end if;
  -- The entry must be in this game's app now: on Stable, in a Block that's on a Page.
  if not exists (
    select 1 from public.cards cd
    join public.card_pointers p on p.card_id = cd.id and p.channel = 'stable'
    join public.game_blocks b on b.game_id = cd.game_id and b.block_key = cd.block_key and b.page_key is not null
    where cd.id = card and cd.game_id = r.game_id) then
    raise exception 'Pick an entry that''s in the app.';
  end if;
  if char_length(words) < 3 then raise exception 'Write a short reply for the asker.'; end if;
  if char_length(words) > 500 then raise exception 'Keep the reply short: 500 characters at most.'; end if;
  select count(*) into recent from public.questions
  where answered_by = auth.uid() and answered_at > now() - interval '1 hour';
  if recent >= 20 then
    raise exception 'Slow down a little: 20 answers an hour at most.' using errcode = 'P0001';
  end if;
  update public.questions
  set status = 'answered', reply = words, answer_card_id = card, answer_draft_id = null,
      answered_by = auth.uid(), answered_at = now()
  where id = q;
  perform public.send_question_reply(q);
end $$;

-- "That didn't answer it": the asker or a moderator opens it again and the answer is cleared.
-- (The reply already sent stays in inboxes; a better answer will send a new one.)
create or replace function public.reopen_question(q uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.questions;
begin
  select * into r from public.questions where id = q for update;
  if r.id is null or r.status = 'removed' then raise exception 'That question is gone.'; end if;
  if r.status <> 'answered' then raise exception 'That question is still open.'; end if;
  if auth.uid() is null or (r.asked_by is distinct from auth.uid() and not public.is_moderator(r.game_id)) then
    raise exception 'Only the asker or a moderator can reopen a question.';
  end if;
  update public.questions
  set status = 'open', reply = null, answer_card_id = null, answer_draft_id = null, answered_by = null, answered_at = null
  where id = q;
end $$;

-- Moderators: fold a duplicate into another question. Its asker and "me too"s move across,
-- so the answer reaches them too.
create or replace function public.merge_question(dup uuid, into_q uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.questions;
  t public.questions;
begin
  select * into d from public.questions where id = dup for update;
  select * into t from public.questions where id = into_q for update;
  if d.id is null or t.id is null or d.id = t.id or d.game_id <> t.game_id then raise exception 'Pick two questions from the same game.'; end if;
  if not public.is_moderator(d.game_id) then raise exception 'Only moderators can merge questions.'; end if;
  insert into public.question_askers (question_id, profile_id, game_id)
  select t.id, w.who, t.game_id
  from (select d.asked_by as who union select a.profile_id from public.question_askers a where a.question_id = d.id) w
  where w.who is not null and w.who is distinct from t.asked_by
  on conflict do nothing;
  update public.questions set status = 'removed', merged_into = t.id where id = d.id;
end $$;

-- Reports: questions can be reported like messages and Drafts ---------------------------------
alter table public.flags add column if not exists question_id uuid references public.questions (id) on delete cascade;
do $$
declare old_check text;
begin
  -- The old "a message or a Draft" check has no name of its own; find it by what it says.
  for old_check in
    select conname from pg_constraint
    where conrelid = 'public.flags'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%message_id IS NULL%draft_id IS NULL%'
      and pg_get_constraintdef(oid) not ilike '%question_id%'
  loop
    execute format('alter table public.flags drop constraint %I', old_check);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'flags_one_target') then
    alter table public.flags add constraint flags_one_target check (num_nonnulls(message_id, draft_id, question_id) = 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'flags_reporter_id_question_id_key') then
    alter table public.flags add constraint flags_reporter_id_question_id_key unique (reporter_id, question_id);
  end if;
end $$;

create or replace function public.flag_game() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.game_id := coalesce(
    (select game_id from public.chat_messages where id = new.message_id),
    (select game_id from public.drafts where id = new.draft_id),
    (select game_id from public.questions where id = new.question_id));
  return new;
end $$;

-- Live updates: new questions and "me too"s for everyone, inbox items for their owner ------------
alter table public.question_askers replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'questions') then
      alter publication supabase_realtime add table public.questions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'question_askers') then
      alter publication supabase_realtime add table public.question_askers;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'inbox') then
      alter publication supabase_realtime add table public.inbox;
    end if;
  end if;
end $$;
