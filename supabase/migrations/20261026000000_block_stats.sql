-- Stats for Collection Blocks, and a "table" look that shows them as a heatmap.
--
-- A Block lists its stats (name, and whether higher or lower is better), and each entry
-- carries its numbers in its content ({ "stats": { "might": 14, ... } }). The heatmap is
-- just a way of showing them, so a fix to one number updates every view. Safe to run twice.

alter table public.game_blocks add column if not exists stats jsonb;

alter table public.game_blocks drop constraint if exists game_blocks_look_check;
alter table public.game_blocks add constraint game_blocks_look_check
  check (look in ('portraits', 'slots', 'rows', 'map', 'table'));
