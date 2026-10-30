-- The Characters Block: profiles laid out by fields the builders choose.
--
-- A Characters Block lists its fields in order (name, kind, on or off, spoiler...), and
-- each entry keeps its values the way every entry already does: tags as categories, the
-- rest as sections under the field's key, description and stats as themselves. So the
-- Workshop's Drafts, votes and history work unchanged. Safe to run twice.

alter table public.game_blocks add column if not exists fields jsonb;

alter table public.game_blocks drop constraint if exists game_blocks_type_check;
alter table public.game_blocks add constraint game_blocks_type_check
  check (type in ('collection', 'guide', 'checklist', 'timeline', 'characters'));
