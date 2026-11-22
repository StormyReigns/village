-- Launching a game, slice 3 of starting a game (docs/games.md; Matt, 2026-11-21). A game a Builder started is
-- unlisted ('draft', shown as "Not launched yet") until it launches for players: when 5 signed-in players vote
-- "I'd use this", or when a Village moderator launches it. Village moderators can also take down a game that
-- hasn't launched (spam, duplicates, games we shouldn't host).
--
-- Run order: after 20261201000000_start_game.sql (run 2026-11-22). Safe to run twice.
--
-- What it changes:
-- 1. games gains launched_at.
-- 2. game_votes: one "I'd use this" per player per game, only while it hasn't launched, never on a game you
--    started. Anyone can read them (the count shows). You can take yours back while it hasn't launched.
--    created_at is stamped by the database (a0_created_at_now), as for every player-written table.
-- 3. A vote that makes 5 launches the game: prelaunch if its date is still ahead, live if it's out. The trigger
--    can never fail the vote: if launching goes wrong, the vote still counts and a moderator can launch it.
-- 4. is_village_moderator(); launch_game(game) and take_down_game(game) for Village moderators only. Taking down
--    archives a game that hasn't launched (its moderators can still see it; nobody else can).

-- 1. When it launched -----------------------------------------------------------------------------------------
alter table public.games add column if not exists launched_at timestamptz;

-- 2. The votes ----------------------------------------------------------------------------------------------
create table if not exists public.game_votes (
  game_id    text not null references public.games (id) on delete cascade,
  voter_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, voter_id)
);
alter table public.game_votes enable row level security;

drop trigger if exists a0_created_at_now on public.game_votes;
create trigger a0_created_at_now before insert or update on public.game_votes for each row execute function public.created_at_now();

drop policy if exists "read game votes" on public.game_votes;
create policy "read game votes" on public.game_votes for select using (true);

drop policy if exists "vote for a game" on public.game_votes;
create policy "vote for a game" on public.game_votes for insert to authenticated
  with check (voter_id = auth.uid()
    and exists (select 1 from public.games g where g.id = game_id and g.status = 'draft' and g.created_by is distinct from auth.uid()));

drop policy if exists "take back a game vote" on public.game_votes;
create policy "take back a game vote" on public.game_votes for delete to authenticated
  using (voter_id = auth.uid() and exists (select 1 from public.games g where g.id = game_id and g.status = 'draft'));

-- 3. Five votes launch it ------------------------------------------------------------------------------------
create or replace function public.game_votes_launch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if (select count(*) from public.game_votes where game_id = new.game_id) >= 5 then
      update public.games
      set status = case when release_date is not null and release_date > current_date then 'prelaunch' else 'live' end,
          launched_at = now()
      where id = new.game_id and status = 'draft';
    end if;
  exception when others then
    null;  -- never fail the vote: a moderator can launch it instead
  end;
  return new;
end $$;

drop trigger if exists game_votes_launch on public.game_votes;
create trigger game_votes_launch after insert on public.game_votes for each row execute function public.game_votes_launch();

-- 4. Village moderators: launch now, or take it down ---------------------------------------------------------
create or replace function public.is_village_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators m where m.profile_id = auth.uid() and m.game_id is null)
$$;
grant execute on function public.is_village_moderator() to anon, authenticated;

create or replace function public.launch_game(gid text) returns text
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  if not public.is_village_moderator() then raise exception 'Only Village moderators can launch a game straight away.'; end if;
  update public.games
  set status = case when release_date is not null and release_date > current_date then 'prelaunch' else 'live' end,
      launched_at = now()
  where id = gid and status = 'draft'
  returning status into st;
  if st is null then raise exception 'That game isn''t waiting to launch.'; end if;
  return st;
end $$;

create or replace function public.take_down_game(gid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_village_moderator() then raise exception 'Only Village moderators can take a game down.'; end if;
  update public.games set status = 'archived' where id = gid and status = 'draft';
  if not found then raise exception 'Only a game that hasn''t launched can be taken down here.'; end if;
end $$;

revoke all on function public.launch_game(text) from public, anon;
revoke all on function public.take_down_game(text) from public, anon;
grant execute on function public.launch_game(text) to authenticated;
grant execute on function public.take_down_game(text) to authenticated;

-- What to read: votes can be cast, five launch a game, and the moderator tools are there.
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'game_votes') as votes_table,
  (select count(*) from pg_trigger where tgname = 'game_votes_launch') as five_votes_launch,
  has_function_privilege('authenticated', 'public.launch_game(text)', 'execute') as moderators_can_launch,
  (select count(*) from public.games where status = 'draft') as games_waiting;
