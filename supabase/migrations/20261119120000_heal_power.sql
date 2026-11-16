-- Fortune's Weave · Weapons and magic: the five healing spells (Heal, Laia, Physic, Recover,
-- Fortify) came in with their healing power in the Might box, as Game8 lists it, so Recover
-- ranked third-strongest of all weapons. Each gets a new revision with no numbers and its heal
-- power in the "What it does" text instead (docs/blocks/items.md).
--
-- Run order: just this. seed-app.sql already has the fixed versions for fresh databases.
-- Only entries nobody has touched since the seed added them (one revision) and with no Draft
-- waiting are changed. Safe to run twice: the second run finds two revisions and skips.

do $$
declare
  w record;
  cur jsonb;
  rid bigint;
begin
  for w in
    select v.slug, v.effect, c.id as card_id, p.revision_id
    from (values
      ('heal', 'Restores HP to an ally next to you, with a heal power of 10. 10 uses.'),
      ('laia', 'Restores HP to an ally, with a heal power of 3, and now and then 100 HP more. 15 uses.'),
      ('physic', 'Restores HP to an ally far away, with a heal power of 8. Range 1–10. 5 uses.'),
      ('recover', 'Restores HP to an ally next to you, with a heal power of 30. 5 uses.'),
      ('fortify', 'Restores HP to every ally in range, with a heal power of 20. Range 1–5. 2 uses.')
    ) as v (slug, effect)
    join public.cards c on c.game_id = 'fortunes-weave' and c.block_key = 'weapons-and-magic' and c.slug = v.slug
    join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
    where (select count(*) from public.card_revisions x where x.card_id = c.id) = 1
      and not exists (select 1 from public.drafts d where d.card_id = c.id and d.status in ('checking', 'open', 'approved', 'preview'))
  loop
    select content into cur from public.card_revisions where id = w.revision_id;
    continue when not (cur ? 'stats');
    insert into public.card_revisions (card_id, content, summary)
    values (
      w.card_id,
      (cur - 'stats') || jsonb_build_object('sections', (
        select coalesce(jsonb_agg(case when s->>'label' = 'Effect' then jsonb_build_object('label', 'Effect', 'text', w.effect) else s end order by ord), '[]'::jsonb)
        from jsonb_array_elements(coalesce(cur->'sections', '[]'::jsonb)) with ordinality as t (s, ord)
      )),
      'Heal power moved from Might into the text'
    )
    returning id into rid;
    update public.card_pointers set revision_id = rid, updated_at = now() where card_id = w.card_id and channel = 'stable';
  end loop;
end $$;

-- What to read: each healing spell, whether it still has numbers (false expected), and its text.
select c.slug, v.content ? 'stats' as still_has_numbers,
  (select s->>'text' from jsonb_array_elements(v.content->'sections') s where s->>'label' = 'Effect') as what_it_does
from public.cards c
join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
join public.card_revisions v on v.id = p.revision_id
where c.game_id = 'fortunes-weave' and c.block_key = 'weapons-and-magic' and c.slug in ('heal', 'laia', 'physic', 'recover', 'fortify')
order by c.slug;
