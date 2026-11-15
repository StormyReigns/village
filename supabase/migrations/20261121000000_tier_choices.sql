-- Tags get a list of choices (Matt, 2026-11-15). Builders make the list in Set up ("Make a list"),
-- each choice with optional info, and whoever adds or fixes an entry picks one. On a Classes Block
-- the band tag's list is the ladder: the bands in its order, each headed by its info.
--
-- The list lives in the Block's setup (game_blocks.fields, a `choices` array on the tag), which
-- moderators already save from Set up, so the only change here is Fortune's Weave's data: its five
-- tier cards (Beginner classes ... Divine classes) were removed on 2026-11-15, and what they said
-- (what each tier takes, and a line about it) moves into the Tier tag's list. It's read from each
-- card's newest version, so community edits to them carry over.
--
-- Run order: just this (no other migration needed first). Safe to run twice: a Tier tag that
-- already has a list is left alone. If the tier cards were never removed, this still works; the
-- ladder then uses the list and the cards stay as they are.

update public.game_blocks gb
set fields = (
  select jsonb_agg(case when f ->> 'key' = 'Tier' then f || jsonb_build_object('choices', tiers.list) else f end order by n)
  from jsonb_array_elements(gb.fields) with ordinality as t(f, n)
)
from (
  select jsonb_agg(
           jsonb_strip_nulls(jsonb_build_object(
             'name', r.content -> 'categories' ->> 'Tier',
             'about', nullif(concat_ws(E'\n', nullif(trim(needs.text), ''), nullif(trim(r.content ->> 'description'), '')), '')))
           order by coalesce((r.content ->> 'order')::int, 99), r.content ->> 'name') as list
  from public.cards c
  cross join lateral (
    select v.content from public.card_revisions v where v.card_id = c.id order by v.id desc limit 1
  ) r
  left join lateral (
    select s ->> 'text' as text from jsonb_array_elements(coalesce(r.content -> 'sections', '[]'::jsonb)) s
    where s ->> 'label' = 'How to unlock' limit 1
  ) needs on true
  where c.game_id = 'fortunes-weave' and c.block_key = 'classes'
    and coalesce((r.content ->> 'header')::boolean, false)
    and coalesce(r.content -> 'categories' ->> 'Tier', '') <> ''
) tiers
where gb.game_id = 'fortunes-weave' and gb.block_key = 'classes'
  and tiers.list is not null
  and jsonb_typeof(gb.fields) = 'array'
  and exists (select 1 from jsonb_array_elements(gb.fields) f where f ->> 'key' = 'Tier' and not (f ? 'choices'));

-- What to read: the tiers in ladder order (Beginner, Specialty, Advanced, Master, Divine expected),
-- and the first line of each, what the tier takes.
select
  (select string_agg(ch ->> 'name', ', ' order by m)
     from public.game_blocks gb2, jsonb_array_elements(gb2.fields) f, jsonb_array_elements(f -> 'choices') with ordinality as x(ch, m)
     where gb2.game_id = 'fortunes-weave' and gb2.block_key = 'classes' and f ->> 'key' = 'Tier') as tier_choices,
  (select string_agg(split_part(ch ->> 'about', E'\n', 1), ' | ' order by m)
     from public.game_blocks gb2, jsonb_array_elements(gb2.fields) f, jsonb_array_elements(f -> 'choices') with ordinality as x(ch, m)
     where gb2.game_id = 'fortunes-weave' and gb2.block_key = 'classes' and f ->> 'key' = 'Tier') as what_each_takes;
