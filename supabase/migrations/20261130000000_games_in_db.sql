-- Games from the database, slice 1 of starting a game (docs/games.md; Matt, 2026-11-21). Until now a game's
-- short name, genre, color shade, cover, routes and the rest lived in src/data/games.ts; the games table had only
-- its id, title, platform, date and status. This adds the rest as columns and fills them in for Fortune's Weave
-- and Ocarina of Time, exactly as games.ts has them, so nothing changes for anyone. The site reads games from here
-- (src/lib/games-data.ts), falling back to games.ts for anything missing, so it works before and after this runs.
-- Slice 2 lets Builders start a game; slice 4 lets them change these as Drafts.
--
-- Run order: any time after 20261113000000_game_wiki.sql. Safe to run twice: it only fills a column that's still
-- empty, so a value someone has changed since is kept. After running, rebuild (an empty commit), since games are
-- cached for hours.
--
-- What it changes:
-- 1. games gains short_title, genre, shade, hue, cover, next, popularity, paths (routes) and moved_pages, each
--    checked: lengths, the shade and hue are ours, routes are a question and up to 8 options, moved pages a small
--    map of addresses.
-- 2. Fortune's Weave and Ocarina get their values from games.ts (only where still empty), and their title,
--    platform, date and status where the seed left them different (it mirrors games.ts, so normally nothing).
-- 3. Nothing else: reading games stays as it was ("read games": everyone, except games still being built, which
--    only their moderators see; nothing is 'draft' yet). Editing stays with each game's moderators.

-- 1. The columns ---------------------------------------------------------------------------------------------
alter table public.games add column if not exists short_title text;
alter table public.games add column if not exists genre       text;
alter table public.games add column if not exists shade       text;
alter table public.games add column if not exists hue         text;
alter table public.games add column if not exists cover       text;
alter table public.games add column if not exists next        text;
alter table public.games add column if not exists popularity  int;
alter table public.games add column if not exists paths       jsonb;
alter table public.games add column if not exists moved_pages jsonb;

-- Routes: { "question": text, "options": [ { "key", "label", "note" } ] }, 2 to 8 options with plain keys.
create or replace function public.game_paths_ok(p jsonb) returns boolean
language sql immutable set search_path = public as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and char_length(coalesce(p ->> 'question', '')) between 1 and 120
    and jsonb_typeof(p -> 'options') = 'array'
    and jsonb_array_length(p -> 'options') between 2 and 8
    and not exists (
      select 1 from jsonb_array_elements(p -> 'options') o
      where jsonb_typeof(o) <> 'object'
         or coalesce(o ->> 'key', '') !~ '^[a-z0-9-]{1,30}$'
         or char_length(coalesce(o ->> 'label', '')) not between 1 and 40
         or char_length(coalesce(o ->> 'note', '')) > 80))
$$;

-- Moved Pages: { "old-key": "new-key" }, 20 at most, plain keys both sides.
create or replace function public.game_moves_ok(m jsonb) returns boolean
language sql immutable set search_path = public as $$
  select m is null or (
    jsonb_typeof(m) = 'object'
    and (select count(*) from jsonb_each(m)) <= 20
    and not exists (select 1 from jsonb_each(m) e where e.key !~ '^[a-z0-9-]{1,48}$' or jsonb_typeof(e.value) <> 'string' or e.value #>> '{}' !~ '^[a-z0-9-]{1,48}$'))
$$;

do $$
begin
  alter table public.games drop constraint if exists games_details_ok;
  alter table public.games add constraint games_details_ok check (
    (short_title is null or char_length(short_title) between 1 and 40)
    and (genre is null or char_length(genre) between 1 and 40)
    and (shade is null or shade in ('standard', 'cozy', 'fantasy', 'shooter', 'openworld'))
    and (hue is null or hue in ('berry', 'sky', 'leaf', 'sun'))
    and (cover is null or (char_length(cover) <= 300 and cover !~ '^[a-z]+:'))
    and (next is null or char_length(next) <= 120)
    and (popularity is null or popularity between 0 and 100000)
    and public.game_paths_ok(paths)
    and public.game_moves_ok(moved_pages));
end $$;

-- 2. Fortune's Weave and Ocarina, as src/data/games.ts has them ------------------------------------------------
insert into public.games (id, title, platform, release_date, status, preset) values
  ('fortunes-weave',  'Fire Emblem: Fortune''s Weave',         'Nintendo Switch 2', '2026-09-17', 'live',      'tactics-rpg'),
  ('ocarina-of-time', 'The Legend of Zelda: Ocarina of Time',  'Nintendo Switch 2', '2026-11-05', 'prelaunch', 'action-adventure')
on conflict (id) do nothing;

update public.games set
  short_title = coalesce(short_title, 'Fortune''s Weave'),
  genre       = coalesce(genre, 'Tactics RPG'),
  shade       = coalesce(shade, 'fantasy'),
  hue         = coalesce(hue, 'berry'),
  next        = coalesce(next, 'Expansion Pass Wave 2 this holiday'),
  popularity  = coalesce(popularity, 1),
  paths       = coalesce(paths, '{"question": "Which Flame Lord are you playing?", "options": [
                  {"key": "cai", "label": "Cai", "note": "Ribeira Winds · Fox"},
                  {"key": "dietrich", "label": "Dietrich", "note": "House Lamine · Lion"},
                  {"key": "theodora", "label": "Theodora", "note": "Megaira''s Beacon · Wolf"},
                  {"key": "leda", "label": "Leda", "note": "Rose Tempest · Eagle"}]}'::jsonb),
  moved_pages = coalesce(moved_pages, '{"units-and-classes": "units"}'::jsonb)
where id = 'fortunes-weave';

update public.games set
  short_title = coalesce(short_title, 'Ocarina of Time'),
  genre       = coalesce(genre, 'Action-adventure'),
  shade       = coalesce(shade, 'fantasy'),
  hue         = coalesce(hue, 'leaf'),
  next        = coalesce(next, 'The Workshop is open: help build it before launch'),
  popularity  = coalesce(popularity, 2)
where id = 'ocarina-of-time';

-- What to read: every column is there, and both games are filled in.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'games'
     and column_name in ('short_title', 'genre', 'shade', 'hue', 'cover', 'next', 'popularity', 'paths', 'moved_pages')) as new_columns_of_9,
  (select count(*) from public.games where short_title is not null and genre is not null and shade is not null) as games_filled_in,
  (select jsonb_array_length(paths -> 'options') from public.games where id = 'fortunes-weave') as fortunes_weave_routes;
