-- The Mysteries Block becomes questions (docs/blocks/questions.md). Safe to run twice.
-- Run after 20261108000000_questions.sql.
--
-- Each Mystery entry (its Stable words) becomes a question on the Page the Block was on: its
-- name is the question, and what was known so far goes along as a note for Builders. Open
-- and Theory ones are open questions; any marked solved arrive answered, with what was known
-- as the reply. Nothing is deleted: the Block only leaves its Page, so its entries, their
-- revisions and any Drafts about them stay, and each question remembers the entry it came from.

insert into public.questions (game_id, page_key, body, spoiler, note, from_card_id, status, reply, answered_at, created_at)
select c.game_id,
       b.page_key,
       left(trim(r.content->>'name'), 300),
       coalesce((r.content->>'spoiler')::boolean, false),
       nullif(left(trim(concat_ws(' ',
         nullif(trim(r.content->>'description'), ''),
         case when r.content->'categories'->>'Status' = 'Theory' then '(Players had a theory, not confirmed yet.)' end)), 2000), ''),
       c.id,
       case when coalesce(r.content->'categories'->>'Status', 'Open') in ('Open', 'Theory') then 'open' else 'answered' end,
       case when coalesce(r.content->'categories'->>'Status', 'Open') in ('Open', 'Theory') then null
            else left(coalesce(nullif(trim(r.content->>'description'), ''), 'Solved.'), 500) end,
       case when coalesce(r.content->'categories'->>'Status', 'Open') in ('Open', 'Theory') then null else now() end,
       c.created_at
from public.cards c
join public.game_blocks b on b.game_id = c.game_id and b.block_key = c.block_key
join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'
join public.card_revisions r on r.id = p.revision_id
where c.block_key = 'mysteries' and b.page_key is not null
  and char_length(trim(r.content->>'name')) >= 3
on conflict (from_card_id) do nothing;

-- The Block leaves the app: off its Page (kept, with its history) when it has entries, gone
-- when it never had any.
update public.game_blocks b set page_key = null
where b.block_key = 'mysteries'
  and exists (select 1 from public.cards c where c.game_id = b.game_id and c.block_key = b.block_key);
delete from public.game_blocks b
where b.block_key = 'mysteries'
  and not exists (select 1 from public.cards c where c.game_id = b.game_id and c.block_key = b.block_key);
