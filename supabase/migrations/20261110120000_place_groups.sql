-- World (docs/blocks/world.md): places get a Group, a kind of place (Cave, Fort, Town...), one
-- each and separate from their Region (Matt, 2026-11-09). The map filters by groups, and a
-- group's symbol sits inside its pins.
--
--   * Places Blocks ask for a Group: Fortune's Weave · Dungeons and places and Ocarina of Time ·
--     Places get the "Group" filter (Region stays first, so the region tiles are unchanged), and
--     Ocarina's Places become a map like Fortune's Weave's.
--   * Fortune's Weave's 28 places get a Group, read only from their names (…Cave → Cave, …Fort
--     → Fort...). Beast's Path and Dragonbone Tangle stay without one rather than a guess.
--     Revisions are append-only, so each place gets a new revision on Stable with its Group
--     added. A place that already has a Group is left alone, so nothing the community chose is
--     overwritten, and running this twice adds nothing the second time. Open Drafts for those places
--     (pins placed before this ran) get the Group too, so shipping one doesn't take it away.
--
-- Safe to run twice. seed-app.sql has the same filters and look, so either order works.

update public.game_blocks set filters = array['Region', 'Group']
where game_id = 'fortunes-weave' and block_key = 'dungeons-and-places' and not ('Group' = any (filters));

update public.game_blocks set look = 'map', filters = array['Region', 'Group']
where game_id = 'ocarina-of-time' and block_key = 'places' and (look is distinct from 'map' or not ('Group' = any (filters)));

do $$
declare r record; c record; rid bigint;
begin
  for r in select * from jsonb_each_text($g${"dagsion":"Town","niraga-mine":"Mine","collapsed-fort":"Fort","heretics-cave":"Cave","galen-fort-ruins":"Fort","rubess-forest":"Forest","nowahs-cave":"Cave","shadowy-cave":"Cave","corroios-fort-ruins":"Fort","hundred-hole-cave":"Cave","masked-woods":"Forest","coris-mine":"Mine","fort-hayn":"Fort","dione-fort":"Fort","valhalla-mine":"Mine","cindered-road-cave":"Cave","cave-behind-the-falls":"Cave","cougar-woodlands":"Forest","sand-shadow-fort":"Fort","enno-isle":"Island","stoppered-shrine":"Shrine","aditis-cave":"Cave","nemea-cavern":"Cave","uncharted-isle":"Island","iapetus-cavern":"Cave","giants-print-fort":"Fort"}$g$::jsonb) loop
    select k.id, v.content into c
    from public.cards k
    join public.card_pointers p on p.card_id = k.id and p.channel = 'stable'
    join public.card_revisions v on v.id = p.revision_id
    where k.game_id = 'fortunes-weave' and k.block_key = 'dungeons-and-places' and k.slug = r.key;
    -- Matched by the card's slug, its fixed key (a name can be renamed in the Workshop).
    continue when c.id is null or c.content->'categories'->>'Group' is not null;
    insert into public.card_revisions (card_id, content, summary)
    values (c.id, jsonb_set(c.content, '{categories}', coalesce(c.content->'categories', '{}'::jsonb) || jsonb_build_object('Group', r.value)), 'Add Group')
    returning id into rid;
    update public.card_pointers set revision_id = rid, updated_at = now() where card_id = c.id and channel = 'stable';
    -- A Draft replaces a place's whole content when it ships, so open Drafts for this place (pins
    -- placed before this ran, and any on Preview) get the Group too, or shipping one would take it
    -- away again. Their
    -- base revision stays the one they were written against: ship_draft doesn't read it, and
    -- "What changes" then lists the Group as one of the Draft's changes, which it now is.
    update public.drafts
    set content = jsonb_set(content, '{categories}', coalesce(content->'categories', '{}'::jsonb) || jsonb_build_object('Group', r.value))
    where card_id = c.id and status in ('checking', 'open', 'approved', 'preview') and content->'categories'->>'Group' is null;
  end loop;
end $$;

-- Fortune's Weave places with a Group now (26 unless the community had already set some).
select count(*) as places_with_a_group
from public.cards k
join public.card_pointers p on p.card_id = k.id and p.channel = 'stable'
join public.card_revisions v on v.id = p.revision_id
where k.game_id = 'fortunes-weave' and k.block_key = 'dungeons-and-places' and v.content->'categories' ? 'Group';
