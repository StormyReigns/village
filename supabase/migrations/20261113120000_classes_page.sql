-- Classes gets a Page of its own, and "Units and classes" becomes "Units" (Matt, 2026-11-11).
--
--   * Pages can be indigo, the seventh Page color (Classes).
--   * Fortune's Weave's Page "units-and-classes" becomes "units". Its Blocks, questions, Page
--     videos and Workshop chat move with it.
--   * A new Page "classes" (indigo, right after Units) takes the Classes Block. Questions and chat
--     about Classes go with it.
--   * Old links keep working: the site sends /units-and-classes to /units, and class entries to
--     the Classes Page (src/data/games.ts, movedPages).
--
-- Run this, then supabase/seed-app.sql (it matches the same Pages). Safe to run twice.

-- The seventh Page color -------------------------------------------------------------------------
alter table public.app_pages drop constraint if exists app_pages_tint_check;
alter table public.app_pages add constraint app_pages_tint_check
  check (tint in ('leaf', 'sky', 'berry', 'sun', 'plum', 'teal', 'indigo'));

do $$
declare
  g   text := 'fortunes-weave';
  pos int;
begin
  -- 1. "units-and-classes" becomes "units". A Page's key can't simply be renamed (Blocks point at
  --    it), so the new Page is made, everything moves over, and the old one goes.
  if exists (select 1 from public.app_pages where game_id = g and page_key = 'units-and-classes') then
    insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position)
    select game_id, 'units', 'Units', short, icon, tint,
           'Who can join your army, how to recruit them, and who''s worth a spot.', position
    from public.app_pages where game_id = g and page_key = 'units-and-classes'
    on conflict (game_id, page_key) do nothing;

    update public.game_blocks set page_key = 'units' where game_id = g and page_key = 'units-and-classes';
    update public.questions   set page_key = 'units' where game_id = g and page_key = 'units-and-classes';
    update public.videos      set page_key = 'units' where game_id = g and page_key = 'units-and-classes';
    -- The Workshop's chat files messages under a Page (chat_messages.block_key holds the Page).
    update public.chat_messages set block_key = 'units' where game_id = g and block_key = 'units-and-classes';

    delete from public.app_pages where game_id = g and page_key = 'units-and-classes';
  end if;

  -- 2. The Classes Page, right after Units (only where the game's Pages exist; on a new database
  --    seed-app.sql makes them all).
  if exists (select 1 from public.app_pages where game_id = g and page_key = 'units')
     and not exists (select 1 from public.app_pages where game_id = g and page_key = 'classes') then
    select position into pos from public.app_pages where game_id = g and page_key = 'units';
    pos := coalesce(pos, 0);
    update public.app_pages set position = position + 1 where game_id = g and position > pos;
    insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position)
    values (g, 'classes', 'Classes', 'Classes', 'Shield', 'indigo', 'Every class, its tier, and how to reach it.', pos + 1);
  end if;

  -- 3. The Classes Block moves there, with what's about it.
  update public.game_blocks set page_key = 'classes'
  where game_id = g and block_key = 'classes' and page_key is distinct from 'classes';

  update public.questions q set page_key = 'classes'
  where q.game_id = g and q.page_key is distinct from 'classes'
    and exists (select 1 from public.cards c where c.id = q.card_id and c.block_key = 'classes');

  update public.chat_messages m set block_key = 'classes'
  where m.game_id = g and m.block_key is distinct from 'classes' and (
       m.thread_key = 'block:classes'
    or m.thread_key like 'entry:classes.%'
    or exists (select 1 from public.cards c where m.thread_key = 'card:' || c.id::text and c.block_key = 'classes')
    or exists (select 1 from public.drafts d where (m.thread_key = 'draft:' || d.id::text or m.linked_draft_id = d.id) and d.block_key = 'classes'));
end $$;

-- What it looks like now.
select page_key, title, tint, position,
       (select string_agg(b.block_key, ', ' order by b.position) from public.game_blocks b
        where b.game_id = p.game_id and b.page_key = p.page_key) as blocks
from public.app_pages p where game_id = 'fortunes-weave' order by position;
