-- The Items Block (Block 2): tiles with basic stats, laid out by fields the builders choose,
-- the same way Characters are. Entries keep their values as they always have (tags as
-- categories, the rest as sections under the field's key), so Drafts, votes and history work
-- unchanged. Run this before seed-app.sql, which switches Fortune's Weave's Items and
-- Weapons and magic to the new type. Safe to run twice.

alter table public.game_blocks drop constraint if exists game_blocks_type_check;
alter table public.game_blocks add constraint game_blocks_type_check
  check (type in ('collection', 'guide', 'checklist', 'timeline', 'characters', 'items'));
