-- Fortune's Weave: move the two weapon entries that started in Items (the update 1.01
-- bonus weapons, and Answerer) into "Weapons and magic", so every weapon is in one place
-- and Items loses its one-entry weapon categories. Run after seed-app.sql has added that
-- Block. The seed also adds a fresh starter copy of each to that Block; the copy goes, and
-- the original moves over with its history, plus a new revision. Safe to rerun.

do $$
declare r record; rid bigint;
begin
  if not exists (select 1 from public.game_blocks where game_id = 'fortunes-weave' and block_key = 'weapons-and-magic') then
    return;
  end if;
  for r in
    select c.id, c.slug, c.position, v.content
    from public.cards c
    join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
    join public.card_revisions v on v.id = p.revision_id
    where c.game_id = 'fortunes-weave' and c.block_key = 'items'
      and v.content->'categories'->>'Type' in ('Weapons (update 1.01)', 'Sword')
  loop
    -- The seed's fresh copy, only if nobody has edited it yet.
    delete from public.cards d
    where d.game_id = 'fortunes-weave' and d.block_key = 'weapons-and-magic' and d.slug = r.slug
      and (select count(*) from public.card_revisions x where x.card_id = d.id) = 1;
    continue when exists (select 1 from public.cards d where d.game_id = 'fortunes-weave' and d.block_key = 'weapons-and-magic' and d.slug = r.slug);
    insert into public.card_revisions (card_id, content, summary)
    values (
      r.id,
      jsonb_set(r.content, '{categories}', '{"Rank": "Unlisted"}'::jsonb)
        || case when r.content->'categories'->>'Type' = 'Weapons (update 1.01)'
             then jsonb_build_object('sections', coalesce(r.content->'sections', '[]'::jsonb) || '[{"label": "Note", "text": "Added in update 1.01."}]'::jsonb)
             else '{}'::jsonb end,
      'Moved to Weapons and magic'
    )
    returning id into rid;
    update public.cards set block_key = 'weapons-and-magic', position = 1000 + r.position where id = r.id;
    update public.card_pointers set revision_id = rid, updated_at = now() where card_id = r.id and channel = 'stable';
  end loop;
end $$;
