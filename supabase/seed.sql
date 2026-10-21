-- Starter data: the two launch games and their blocks.
-- Mirrors src/data/games.ts and the presets in src/lib/blocks.ts. Safe to run again: it
-- updates block names and order to match.

insert into public.games (id, title, platform, release_date, status, preset) values
  ('fortunes-weave',  'Fire Emblem: Fortune''s Weave',         'Nintendo Switch 2', '2026-09-17', 'live',      'tactics-rpg'),
  ('ocarina-of-time', 'The Legend of Zelda: Ocarina of Time',  'Nintendo Switch 2', '2026-11-05', 'prelaunch', 'action-adventure')
on conflict (id) do nothing;

insert into public.game_blocks (game_id, block_key, title, position) values
  ('fortunes-weave', 'progress', 'Story', 0),
  ('fortunes-weave', 'missables', 'Last chances', 1),
  ('fortunes-weave', 'people', 'Units', 2),
  ('fortunes-weave', 'builds', 'Classes', 3),
  ('fortunes-weave', 'places', 'Dungeons and places', 4),
  ('fortunes-weave', 'items', null, 5),
  ('fortunes-weave', 'foes', null, 6),
  ('fortunes-weave', 'howto', null, 7),
  ('fortunes-weave', 'mysteries', null, 8),
  ('ocarina-of-time', 'progress', 'Dungeons', 0),
  ('ocarina-of-time', 'collections', 'Hearts and Skulltulas', 1),
  ('ocarina-of-time', 'missables', null, 2),
  ('ocarina-of-time', 'items', null, 3),
  ('ocarina-of-time', 'places', null, 4),
  ('ocarina-of-time', 'foes', null, 5),
  ('ocarina-of-time', 'howto', null, 6),
  ('ocarina-of-time', 'mysteries', null, 7)
on conflict (game_id, block_key) do update set title = excluded.title, position = excluded.position;
