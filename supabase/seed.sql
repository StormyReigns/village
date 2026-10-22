-- Starter data: the two launch games. Mirrors src/data/games.ts. Safe to run again.
-- Their Pages, Blocks and starter entries are in seed-app.sql (npm run db:seed-app).

insert into public.games (id, title, platform, release_date, status, preset) values
  ('fortunes-weave',  'Fire Emblem: Fortune''s Weave',         'Nintendo Switch 2', '2026-09-17', 'live',      'tactics-rpg'),
  ('ocarina-of-time', 'The Legend of Zelda: Ocarina of Time',  'Nintendo Switch 2', '2026-11-05', 'prelaunch', 'action-adventure')
on conflict (id) do nothing;

