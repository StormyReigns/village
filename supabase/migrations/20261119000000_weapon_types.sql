-- Fortune's Weave · Weapons and magic: each weapon gets its type (Sword, Spear, Axe, Bow,
-- Gauntlet, Black Magic, White Magic, as the game names them, from Game8's list of all
-- weapons and spells), and each type a symbol, so every weapon's piece shows a sword, a bow,
-- a wand... instead of initials (docs/blocks/items.md).
--
-- Run order: just this. seed-app.sql has the same setup, so running it before or after is
-- fine. Safe to run twice: a weapon that already has a type, or was renamed, is left alone.
--
-- What it changes:
-- 1. The Block's setup: a "Weapon type" tag after Rank (only if the Block has no field by
--    that key), and the type symbols (any symbol already set for a value is kept).
-- 2. Each weapon still named as it started, with no type yet and no Draft waiting on it:
--    a new revision with its type and the source added, and the Stable pointer moved to it.
--    The bundle "Chosen Sword, Chosen Lance, Royal Sword, Breidablik" has no one type and is
--    left out.

do $$
declare
  w record;
  cur jsonb;
  rid bigint;
  src constant text := 'Weapon types: Game8''s list of all weapons and spells in Fortune''s Weave (game8.co, Nov 2026).';
begin
  if not exists (select 1 from public.game_blocks where game_id = 'fortunes-weave' and block_key = 'weapons-and-magic') then
    return;
  end if;

  update public.game_blocks
  set fields = case
        when fields is null or exists (select 1 from jsonb_array_elements(fields) f where f->>'key' = 'Weapon type') then fields
        else jsonb_insert(fields, '{1}', '{"key": "Weapon type", "label": "Weapon type", "kind": "tag"}'::jsonb)
      end,
      symbols = '{"Sword": "Sword", "Spear": "Spear", "Axe": "Axe", "Bow": "BowArrow", "Gauntlet": "HandFist", "Black Magic": "WandSparkles", "White Magic": "Sun"}'::jsonb
        || coalesce(symbols, '{}'::jsonb)
  where game_id = 'fortunes-weave' and block_key = 'weapons-and-magic';

  for w in
    select v.slug, v.name, v.kind, c.id as card_id, p.revision_id
    from (values
      ('answerer', 'Answerer', 'Sword'),
      ('levin-sword-plus-1', 'Levin Sword +1', 'Sword'),
      ('levin-sword-plus-3', 'Levin Sword +3', 'Sword'),
      ('salamander-plus-5', 'Salamander +5', 'Gauntlet'),
      ('blizzard', 'Blizzard', 'Black Magic'),
      ('fire', 'Fire', 'Black Magic'),
      ('thunder', 'Thunder', 'Black Magic'),
      ('wind', 'Wind', 'Black Magic'),
      ('miasma', 'Miasma', 'Black Magic'),
      ('nosferatu', 'Nosferatu', 'White Magic'),
      ('earths-jaws', 'Earth''s Jaws', 'Black Magic'),
      ('mire', 'Mire', 'Black Magic'),
      ('seraphim', 'Seraphim', 'White Magic'),
      ('sword-of-judgment', 'Sword of Judgment', 'Black Magic'),
      ('swarm', 'Swarm', 'Black Magic'),
      ('bolganone', 'Bolganone', 'Black Magic'),
      ('cutting-gale', 'Cutting Gale', 'Black Magic'),
      ('death', 'Death', 'Black Magic'),
      ('glass-wheel', 'Glass Wheel', 'Black Magic'),
      ('ice-blade', 'Ice Blade', 'Black Magic'),
      ('starlight', 'Starlight', 'White Magic'),
      ('thoron', 'Thoron', 'Black Magic'),
      ('luna', 'Luna', 'Black Magic'),
      ('banshee', 'Banshee', 'Black Magic'),
      ('aura', 'Aura', 'White Magic'),
      ('bolting', 'Bolting', 'Black Magic'),
      ('dark-spikes', 'Dark Spikes', 'Black Magic'),
      ('excalibur', 'Excalibur', 'Black Magic'),
      ('sagittae', 'Sagittae', 'Black Magic'),
      ('agneas-arrow', 'Agnea''s Arrow', 'Black Magic'),
      ('fimbulvetr-night', 'Fimbulvetr Night', 'Black Magic')
    ) as v (slug, name, kind)
    join public.cards c on c.game_id = 'fortunes-weave' and c.block_key = 'weapons-and-magic' and c.slug = v.slug
    join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
    where not exists (select 1 from public.drafts d where d.card_id = c.id and d.status in ('checking', 'open', 'approved', 'preview'))
  loop
    select content into cur from public.card_revisions where id = w.revision_id;
    continue when (cur->>'name') is distinct from w.name or coalesce((cur->'categories') ? 'Weapon type', false);
    insert into public.card_revisions (card_id, content, summary)
    values (
      w.card_id,
      jsonb_set(cur, '{categories}', coalesce(cur->'categories', '{}'::jsonb) || jsonb_build_object('Weapon type', w.kind))
        || jsonb_build_object('source', case
             when coalesce(cur->>'source', '') like '%Game8%' then cur->>'source'
             else trim(coalesce(cur->>'source', '') || ' ' || src) end),
      'Added its weapon type'
    )
    returning id into rid;
    update public.card_pointers set revision_id = rid, updated_at = now() where card_id = w.card_id and channel = 'stable';
  end loop;
end $$;

-- What to read: how many weapons now have a type (31 of 32 expected; the bundle has none),
-- and any still without one besides the bundle (renamed, or a Draft was waiting).
select
  count(*) filter (where v.content->'categories' ? 'Weapon type') as weapons_with_a_type,
  count(*) as weapons,
  coalesce(string_agg(v.content->>'name', ', ') filter (where not v.content->'categories' ? 'Weapon type'
    and c.slug <> 'chosen-sword-chosen-lance-royal-sword-breidablik'), 'none') as left_without_a_type,
  (select symbols ? 'Black Magic' from public.game_blocks where game_id = 'fortunes-weave' and block_key = 'weapons-and-magic') as symbols_set
from public.cards c
join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
join public.card_revisions v on v.id = p.revision_id
where c.game_id = 'fortunes-weave' and c.block_key = 'weapons-and-magic';
