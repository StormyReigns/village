-- Village: moderator tools.
--   * villagers can report a chat message or a Draft; reports wait on the Notice Board
--   * removals record who removed what, so they can be undone
--   * reports have a rate limit like chat and Drafts

-- Who removed a chat message (removed_at already says when) ----------------------
alter table public.chat_messages add column if not exists removed_by uuid references public.profiles (id);

-- Reports from villagers --------------------------------------------------------
-- One row per person per thing reported. The game is filled in from the thing
-- itself, so a report always reaches that game's moderators.
create table if not exists public.flags (
  id          bigint generated always as identity primary key,
  game_id     text references public.games (id) on delete cascade,
  message_id  bigint references public.chat_messages (id) on delete cascade,
  draft_id    uuid references public.drafts (id) on delete cascade,
  reason      text not null check (reason in ('spam', 'rude', 'spoiler', 'wrong', 'other')),
  note        text check (char_length(note) <= 500),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  handled_by  uuid references public.profiles (id),
  handled_at  timestamptz,
  created_at  timestamptz not null default now(),
  check ((message_id is null) <> (draft_id is null)),
  unique (reporter_id, message_id),
  unique (reporter_id, draft_id)
);
create index if not exists flags_open_idx on public.flags (game_id, status);

create or replace function public.flag_game() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.game_id := coalesce(
    (select game_id from public.chat_messages where id = new.message_id),
    (select game_id from public.drafts where id = new.draft_id));
  return new;
end $$;

drop trigger if exists flags_game on public.flags;
create trigger flags_game before insert on public.flags
  for each row execute function public.flag_game();

alter table public.flags enable row level security;
drop policy if exists "report things" on public.flags;
create policy "report things" on public.flags for insert
  with check (reporter_id = auth.uid() and status = 'open' and handled_by is null);
drop policy if exists "read flags" on public.flags;
create policy "read flags" on public.flags for select
  using (reporter_id = auth.uid() or public.is_moderator(game_id));
drop policy if exists "mods handle flags" on public.flags;
create policy "mods handle flags" on public.flags for update
  using (public.is_moderator(game_id)) with check (public.is_moderator(game_id));

-- Rate limits, now covering reports too ------------------------------------------
create or replace function public.slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if tg_table_name = 'chat_messages' then
    select count(*) into recent from public.chat_messages
    where author_id = new.author_id and created_at > now() - interval '1 minute';
    if recent >= 10 then
      raise exception 'Slow down a little: 10 messages a minute at most.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'drafts' then
    select count(*) into recent from public.drafts
    where author_id = new.author_id and created_at > now() - interval '1 hour';
    if recent >= 20 then
      raise exception 'Slow down a little: 20 Drafts an hour at most.' using errcode = 'P0001';
    end if;
  else
    select count(*) into recent from public.flags
    where reporter_id = new.reporter_id and created_at > now() - interval '1 hour';
    if recent >= 20 then
      raise exception 'Slow down a little: 20 reports an hour at most.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists flags_slow_down on public.flags;
create trigger flags_slow_down before insert on public.flags
  for each row execute function public.slow_down();

-- Moderators see new reports arrive live ------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'flags') then
    alter publication supabase_realtime add table public.flags;
  end if;
end $$;
