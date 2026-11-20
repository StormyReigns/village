-- Fortune's Weave · Last chances: Theodora's deadline for Talimun's Paralogue said "Ch 11, same
-- dates as Cai", which sends a player off to look up Cai's line. It now gives the dates themselves
-- (from the review of the second-playthrough planner, 2026-11-20).
--
-- Run order: just this. seed-app.sql already has the new line for fresh databases, and never
-- overwrites a card that exists.
-- Only changed while Theodora's line still reads exactly the starter text and no Draft is waiting
-- on the card, so a villager's own edit is never overwritten. Appends a revision and moves the
-- Stable pointer. Safe to run twice: the second run finds the new text and skips.

do $$
declare
  w record;
  rid bigint;
begin
  for w in
    select c.id as card_id, v.content
    from public.cards c
    join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
    join public.card_revisions v on v.id = p.revision_id
    where c.game_id = 'fortunes-weave' and c.block_key = 'last-chances'
      and c.slug = 'talimuns-paralogue-secret-of-the-vanished-carriage'
      and v.content #>> '{perRoute,theodora,0,text}' = 'Ch 11, same dates as Cai'
      and not exists (select 1 from public.drafts d where d.card_id = c.id and d.status in ('checking', 'open', 'approved', 'preview'))
  loop
    insert into public.card_revisions (card_id, content, summary)
    values (w.card_id, jsonb_set(w.content, '{perRoute,theodora,0,text}', to_jsonb('Ch 11, 9/17–9/22 and 10/1–10/12'::text)),
            'Theodora: the dates themselves, not "same dates as Cai"')
    returning id into rid;
    update public.card_pointers set revision_id = rid, updated_at = now() where card_id = w.card_id and channel = 'stable';
  end loop;
end $$;

-- What to read: Theodora's line (expected "Ch 11, 9/17–9/22 and 10/1–10/12").
select c.slug, v.content #>> '{perRoute,theodora,0,text}' as theodora_deadline
from public.cards c
join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
join public.card_revisions v on v.id = p.revision_id
where c.game_id = 'fortunes-weave' and c.slug = 'talimuns-paralogue-secret-of-the-vanished-carriage';
