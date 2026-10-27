-- A symbol for each filter value of a Collection Block, shown inside its entries' pieces
-- instead of initials: e.g. each faction in Units gets its own symbol. Our own simple
-- icons, never game art. Safe to run twice.

alter table public.game_blocks add column if not exists symbols jsonb;
