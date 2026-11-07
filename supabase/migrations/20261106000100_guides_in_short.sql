-- Guides (Block 3, docs/blocks/guides.md): every guide now opens with "In short", the gist in
-- two lines. Fortune's Weave's 5 starter guides get one, written from what their steps
-- already say (src/data/pages/fortunes-weave.ts, IN_SHORT). Revisions are append-only, so each
-- guide gets a new revision on Stable with the line added. Only guides whose Stable revision
-- is still exactly the starter content are touched, so a guide the community has edited is
-- left alone, and running this twice adds nothing the second time.
-- Run after 20261106000000_guide_pictures.sql and before seed-app.sql.

do $$
declare r jsonb; c record; rid bigint;
begin
  for r in select * from jsonb_array_elements($g$[{"slug":"recruit-a-unit","starter":{"name":"Recruit a unit","source":"Fortune's Weave Codex (Sept 18, 2026): Game8, RPG Site, Polygon, IGN, fan wikis","sections":[{"label":"Steps","text":"Give them any gift to form a bond. That unlocks the Recruit option\nRaise your Support with them and your Renown to the levels their card shows for your Flame Lord\nMeet any extra condition (a quest, an item, a payment)"},{"label":"Tip","text":"Recruiting later in Part I gives better starting levels and gear; earlier gives you more time to train them."}],"categories":{}},"short":"Give them a gift to unlock Recruit, then raise your Support with them and your Renown to what their card asks for your Flame Lord."},{"slug":"change-class","starter":{"name":"Change class","source":"Fortune's Weave Codex (Sept 18, 2026): Game8, RPG Site, Polygon, IGN, fan wikis","sections":[{"label":"Steps","text":"Buy the license from the License Vendor in Hightown\nTake the Certification Exam from the Exam Proctor next to him\nAim for a 75%+ pass chance"},{"label":"Tip","text":"The game autosaves before showing the result. Advanced classes unlocked on one route open on every route."}],"categories":{}},"short":"Buy the license in Hightown and pass the Certification Exam next to the vendor. Go in with a pass chance of 75% or more."},{"slug":"earn-temple-blessings","starter":{"name":"Earn Temple Blessings","source":"Fortune's Weave Codex (Sept 18, 2026): Game8, RPG Site, Polygon, IGN, fan wikis","sections":[{"label":"Steps","text":"Do Temple Service at Temple Row (up to 2 units, costs Motivation)\nServe on a god's holy day to fill the gauge faster (see the Calendar)\nEquip up to 4 Blessings"},{"label":"Tip","text":"Fortuna's Blessing rewinds turns: free on Normal, 5 Divine Sand on Hard."}],"categories":{}},"short":"Send up to two units to Temple Service at Temple Row, best on a god's holy day, then equip up to four Blessings."},{"slug":"carry-progress-between-routes","starter":{"name":"Carry progress between routes","source":"Fortune's Weave Codex (Sept 18, 2026): Game8, RPG Site, Polygon, IGN, fan wikis","sections":[{"label":"Steps","text":"Finish a route before starting the next\nYour map, finished subquests, Blessings, supports and Boons carry forward\nReplaying Chapter 12 updates the party that route takes into Part II"},{"label":"Tip","text":"Finished general subquests auto-complete on later routes and pay their rewards again."}],"categories":{}},"short":"Finish one route before starting the next: your map, finished subquests, Blessings, supports and Boons carry over."},{"slug":"find-dagsions-services","starter":{"name":"Find Dagsion's services","source":"Fortune's Weave Codex (Sept 18, 2026): Game8, RPG Site, Polygon, IGN, fan wikis","sections":[{"label":"Steps","text":"Hightown: classes and Smyrnos's Temple\nMidtown: Headhunter and fortune-telling\nLowtown: Tavern, Stable, trading\nTemple Row: Temple Service"},{"label":"Tip","text":"The Theater and Thermae raise Support; Inns serve meals and support conversations."}],"categories":{}},"short":"Classes and the temple are in Hightown, the Headhunter in Midtown, the Tavern, Stable and trading in Lowtown, and Temple Service on Temple Row."}]$g$::jsonb) loop
    select k.id, v.content into c
    from public.cards k
    join public.card_pointers p on p.card_id = k.id and p.channel = 'stable'
    join public.card_revisions v on v.id = p.revision_id
    where k.game_id = 'fortunes-weave' and k.block_key = 'how-to' and k.slug = r->>'slug';
    continue when c.id is null or c.content <> (r->'starter');
    insert into public.card_revisions (card_id, content, summary)
    values (c.id, c.content || jsonb_build_object('description', r->>'short'), 'Add In short')
    returning id into rid;
    update public.card_pointers set revision_id = rid, updated_at = now() where card_id = c.id and channel = 'stable';
  end loop;
end $$;

-- Guides with "In short" now (5 unless the community had already edited some).
select count(*) as guides_with_in_short
from public.cards k
join public.card_pointers p on p.card_id = k.id and p.channel = 'stable'
join public.card_revisions v on v.id = p.revision_id
where k.game_id = 'fortunes-weave' and k.block_key = 'how-to' and v.content ? 'description';
