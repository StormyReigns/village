-- A new look for Collection Blocks: "map". Entries are grouped by the Block's first filter
-- (for places, their Region) and drawn as a map of region tiles that fill in as players
-- mark places cleared. Fortune's Weave's "Dungeons and places" switches to it. Safe to
-- run twice.

alter table public.game_blocks drop constraint if exists game_blocks_look_check;
alter table public.game_blocks add constraint game_blocks_look_check
  check (look in ('portraits', 'slots', 'rows', 'map'));

update public.game_blocks set look = 'map'
where game_id = 'fortunes-weave' and block_key = 'dungeons-and-places';
