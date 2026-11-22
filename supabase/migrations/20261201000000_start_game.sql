-- Starting a game, slice 2 (docs/games.md; Matt, 2026-11-21). Anyone signed in can start a game that isn't in
-- Village yet. Its Workshop opens straight away for Builders, and its starter becomes its first moderator (for that
-- game only). It isn't listed for players until it launches (slice 3: 5 votes, or a Village moderator's approval).
--
-- Run order: after 20261130000000_games_in_db.sql (run 2026-11-21). Safe to run twice.
--
-- What it changes:
-- 1. games gains created_by (who started it). A game being built keeps the table's existing status 'draft'.
-- 2. Reading games: everyone can read a game being built (it's unlisted, not secret: its Workshop and app home
--    work by their address). Archived games stay for their moderators only. The site keeps games being built off
--    the front page and out of search itself (src/lib/game-row.ts).
-- 3. start_game(title, short_title, platform, release_date, genre, shade): signed in; every box checked (lengths,
--    a date between 1970 and ten years from now, the shade one of ours); the game's address is made from its short
--    name and never clashes; a near-duplicate of a game already here is refused (same letters and digits as its
--    title or short name); one new game per person per day (Village moderators are exempt). It makes the game
--    and makes its starter its moderator, and returns the address.

-- 1. Who started it -----------------------------------------------------------------------------------------
alter table public.games add column if not exists created_by uuid references public.profiles (id) on delete set null;

-- 2. Reading games being built ------------------------------------------------------------------------------
drop policy if exists "read games" on public.games;
create policy "read games" on public.games for select using (status <> 'archived' or public.is_moderator(id));

-- 3. Starting one -------------------------------------------------------------------------------------------
-- A title's letters and digits only, for spotting the same game twice ("Hollow Spire" and "hollow-spire!").
create or replace function public.game_name_key(t text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '', 'g')
$$;

create or replace function public.start_game(p_title text, p_short text, p_platform text, p_release date, p_genre text, p_shade text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_short text := btrim(regexp_replace(coalesce(nullif(btrim(p_short), ''), p_title, ''), '\s+', ' ', 'g'));
  plat   text := btrim(regexp_replace(coalesce(p_platform, ''), '\s+', ' ', 'g'));
  v_genre text := btrim(regexp_replace(coalesce(p_genre, ''), '\s+', ' ', 'g'));
  base   text;
  gid    text;
  n      int := 1;
  dup    text;
begin
  if uid is null then raise exception 'Sign in to start a game.'; end if;
  if char_length(v_title) not between 2 and 120 then raise exception 'The game needs its name, 2 to 120 characters.'; end if;
  if char_length(v_short) not between 1 and 40 then raise exception 'The short name is 40 characters at most.'; end if;
  if char_length(plat) not between 1 and 80 then raise exception 'Say what it''s played on, 80 characters at most.'; end if;
  if char_length(v_genre) not between 1 and 40 then raise exception 'Say what kind of game it is, 40 characters at most.'; end if;
  if p_release is null or p_release < date '1970-01-01' or p_release > (current_date + interval '10 years')::date then
    raise exception 'The release date needs to be a real one (a guess is fine).';
  end if;
  if coalesce(p_shade, '') not in ('standard', 'cozy', 'fantasy', 'shooter', 'openworld') then raise exception 'Pick the look closest to the game.'; end if;

  -- The same game twice: same letters and digits as a title or short name already here (any status).
  select g.title into dup from public.games g
  where public.game_name_key(g.title) in (public.game_name_key(v_title), public.game_name_key(v_short))
     or public.game_name_key(g.short_title) in (public.game_name_key(v_title), public.game_name_key(v_short))
  limit 1;
  if dup is not null then raise exception '% is already in Village. Help build it there.', dup; end if;

  -- One new game a day each, so nobody can fill the village with empty games.
  if not exists (select 1 from public.moderators m where m.profile_id = uid and m.game_id is null)
     and exists (select 1 from public.games g where g.created_by = uid and g.created_at > now() - interval '1 day') then
    raise exception 'You started a game today. You can start another tomorrow.';
  end if;

  -- Its address, from the short name: lowercase words joined by dashes, never clashing.
  base := left(trim(both '-' from regexp_replace(lower(v_short), '[^a-z0-9]+', '-', 'g')), 40);
  if char_length(base) < 2 then base := left(trim(both '-' from regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g')), 40); end if;
  if char_length(base) < 2 then base := 'game'; end if;
  gid := base;
  while exists (select 1 from public.games where id = gid) loop
    n := n + 1; gid := base || '-' || n;
  end loop;

  insert into public.games (id, title, short_title, platform, release_date, status, preset, genre, shade, hue, popularity, created_by)
  values (gid, v_title, v_short, plat, p_release, 'draft', 'custom', v_genre, p_shade,
          case p_shade when 'cozy' then 'sun' when 'shooter' then 'sky' when 'openworld' then 'leaf' when 'fantasy' then 'berry' else 'sky' end,
          1000, uid);
  insert into public.moderators (profile_id, game_id) values (uid, gid) on conflict do nothing;
  return gid;
end $$;

revoke all on function public.start_game(text, text, text, date, text, text) from public, anon;
grant execute on function public.start_game(text, text, text, date, text, text) to authenticated;

-- What to read: games being built can be read, and start_game is there for people signed in.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'games' and column_name = 'created_by') as created_by_column,
  (select qual from pg_policies where schemaname = 'public' and tablename = 'games' and policyname = 'read games') as who_reads_games,
  has_function_privilege('authenticated', 'public.start_game(text, text, text, date, text, text)', 'execute') as signed_in_can_start,
  (select count(*) from public.games where status = 'draft') as games_being_built;
