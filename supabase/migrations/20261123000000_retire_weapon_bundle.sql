-- Fortune's Weave · Weapons and magic: the starter card "Chosen Sword, Chosen Lance, Royal Sword,
-- Breidablik" is four weapons in one entry, and since the item research (2026-11-15) each of the
-- four has its own entry. So (docs/blocks/items.md):
-- 1. The four get the bundle's one extra fact in "Where to get it": they arrive by themselves in
--    Part I, Chapter 4, on every route, as an update 1.01 bonus, one copy per route.
-- 2. The bundle leaves the app the way a published removal does: its Stable and Preview
--    pointers go, and every version of it is kept (bringing it back needs SQL, since there is
--    no removal Draft to bring it back from).
--
-- Run order: just this. seed-app.sql no longer has the bundle, and never re-adds a card that
-- exists. Safe to run twice: done steps find nothing left to do.
-- Only touched where nobody has: a weapon with one revision (as the seed made it), the bundle
-- still under its starter name with no version from a Draft or a person, and nothing with a
-- Draft waiting. If the bundle was edited, it stays (the final select says "true"): remove it
-- in the Workshop with "Ask to remove" instead.

do $$
declare
  w record;
  cur jsonb;
  rid bigint;
  where_text constant text := E'Arrives on its own in Part I, Chapter 4, on every route\nA free bonus from update 1.01; each route gets its own copy';
begin
  -- 1. The four weapons.
  for w in
    select c.id as card_id, p.revision_id
    from public.cards c
    join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
    where c.game_id = 'fortunes-weave' and c.block_key = 'weapons-and-magic'
      and c.slug in ('breidablik', 'chosen-lance', 'chosen-sword', 'royal-sword')
      and (select count(*) from public.card_revisions x where x.card_id = c.id) = 1
      and not exists (select 1 from public.drafts d where d.card_id = c.id and d.status in ('checking', 'open', 'approved', 'preview'))
  loop
    select content into cur from public.card_revisions where id = w.revision_id;
    insert into public.card_revisions (card_id, content, summary)
    values (
      w.card_id,
      cur || jsonb_build_object('sections', (
        select coalesce(jsonb_agg(case when s->>'label' = 'Where to get it' then jsonb_build_object('label', 'Where to get it', 'text', where_text) else s end order by ord), '[]'::jsonb)
        from jsonb_array_elements(coalesce(cur->'sections', '[]'::jsonb)) with ordinality as t (s, ord)
      )),
      'Where to get it: from the update 1.01 bundle entry'
    )
    returning id into rid;
    update public.card_pointers set revision_id = rid, updated_at = now() where card_id = w.card_id and channel = 'stable';
  end loop;

  -- 2. The bundle leaves the app (only once the four are there to replace it).
  if (select count(*) from public.cards c join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
      where c.game_id = 'fortunes-weave' and c.block_key = 'weapons-and-magic'
        and c.slug in ('breidablik', 'chosen-lance', 'chosen-sword', 'royal-sword')) = 4 then
    delete from public.card_pointers p
    using public.cards c, public.card_revisions v
    where p.card_id = c.id and c.game_id = 'fortunes-weave' and c.block_key = 'weapons-and-magic'
      and c.slug = 'chosen-sword-chosen-lance-royal-sword-breidablik'
      and v.card_id = c.id and v.id = (select x.revision_id from public.card_pointers x where x.card_id = c.id and x.channel = 'stable')
      and v.content->>'name' = 'Chosen Sword, Chosen Lance, Royal Sword, Breidablik'
      -- Untouched by players: every version came from the seed or a migration (the bundle has
      -- two, "Starter content" and October's "Moved to Weapons and magic"), none from a Draft.
      and not exists (select 1 from public.card_revisions x where x.card_id = c.id and (x.draft_id is not null or x.created_by is not null))
      and not exists (select 1 from public.drafts d where d.card_id = c.id and d.status in ('checking', 'open', 'approved', 'preview'));
  end if;
end $$;

-- What to read: the bundle should no longer be in the app (false), and the four should each say
-- where they come from.
select 'bundle still in the app' as what,
  exists (select 1 from public.cards c join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
    where c.game_id = 'fortunes-weave' and c.slug = 'chosen-sword-chosen-lance-royal-sword-breidablik')::text as answer
union all
select c.slug, (select s->>'text' from jsonb_array_elements(v.content->'sections') s where s->>'label' = 'Where to get it')
from public.cards c
join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
join public.card_revisions v on v.id = p.revision_id
where c.game_id = 'fortunes-weave' and c.block_key = 'weapons-and-magic' and c.slug in ('breidablik', 'chosen-lance', 'chosen-sword', 'royal-sword');
