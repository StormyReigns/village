-- Suggesting a new Page or Block as a Draft (Matt, 2026-11-15; docs/workshop.md). Anyone signed in
-- can suggest one from the Workshop's "+" Page tab or Add Block. Others vote up or down, and a
-- moderator publishes or declines it, like any Draft. Publishing creates the Page (with its first
-- Block) or the Block. Moderators can still add one directly, as today.
--
-- Run order: after 20261120000000_remove_requests.sql, 20261120120000_bring_back_entries.sql and
-- 20261121000000_tier_choices.sql. Safe to run twice. This replaces ship_draft with a copy of the
-- one in 20261120000000 plus the new part, so if 20261120000000 is ever run again after this one,
-- run this one again too (otherwise Page and Block Drafts can't be published; nothing else breaks).
--
-- What it changes:
-- 1. Drafts get two more actions: 'add_page' (a new Page with its first Block) and 'add_block' (a
--    Block on a Page that exists). Neither names an entry or joins a batch.
-- 2. ship_draft: publishing one of them creates the Page and/or Block. Everything comes from what a
--    player typed, so it's all checked here: lengths, the Block type (only the ones Add Block
--    offers), symbols (letters and digits only), the color, and what a Tier list ranks or a Planner
--    picks from (real Blocks of the right type, in this game). Keys are made here and never clash,
--    with each other or with the app's own routes (a Page called "Tiers" gets the key tiers-page).
--    The Draft's block_key becomes the new Block's key, so its chat note finds the Page.
-- 3. Nothing else: the chat note already reads "<title> is now in the app.", and Discord already
--    skips Drafts that aren't edits.
--
-- The Draft's content (written by src/app/g/[game]/workshop/AddBlock.tsx):
--   { "name": <Block name>, "sections": [], "categories": {},
--     "page":    { "title", "short", "icon", "tint" },                  -- add_page only
--     "pageKey": <an existing Page's key>,                              -- add_block only
--     "block":   { "title", "type", "icon", "intro", "byRoute", "filters",
--                  "ranks",                                             -- Tier list: the Block it ranks
--                  "roster", "classes", "size" } }                      -- Planner

-- 1. The actions ---------------------------------------------------------------------------------
alter table public.drafts add column if not exists action text not null default 'edit';

alter table public.drafts drop constraint if exists drafts_action_check;
alter table public.drafts add constraint drafts_action_check
  check (action in ('edit', 'remove', 'add_page', 'add_block')
         and (action = 'edit' or batch_id is null)
         and (action <> 'remove' or card_id is not null)
         and (action not in ('add_page', 'add_block') or card_id is null));

-- 2. Publishing ---------------------------------------------------------------------------------
-- Makes a key from a name: lowercase words joined by dashes, 2 to 40 characters.
create or replace function public.key_from(name text, fallback text) returns text
language sql immutable set search_path = public as $$
  select case when length(k) >= 2 then k else fallback end
  from (select left(trim(both '-' from regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g')), 40) as k) s
$$;

-- Creates the Page and/or Block a Draft suggests. Called by ship_draft only (it checks the
-- moderator and the Draft's status first).
create or replace function public.ship_structure(d public.drafts) returns void
language plpgsql security definer set search_path = public as $$
declare
  c        jsonb := d.content;
  b        jsonb := coalesce(d.content -> 'block', '{}'::jsonb);
  pg       jsonb := coalesce(d.content -> 'page', '{}'::jsonb);
  pkey     text;
  bkey     text;
  base     text;
  n        int;
  btitle   text := btrim(coalesce(b ->> 'title', ''));
  btype    text := b ->> 'type';
  bicon    text := coalesce(nullif(b ->> 'icon', ''), 'BookOpen');
  bintro   text := nullif(btrim(coalesce(b ->> 'intro', '')), '');
  ptitle   text := btrim(coalesce(pg ->> 'title', ''));
  pshort   text;
  picon    text := coalesce(nullif(pg ->> 'icon', ''), 'BookOpen');
  ptint    text := pg ->> 'tint';
  filt     text[];
  tiers    jsonb;
  plan     jsonb;
  size     int;
begin
  -- The Block: its name, type, symbol and line.
  if char_length(btitle) not between 1 and 60 then raise exception 'The Block needs a name of 60 characters or fewer.'; end if;
  if btype is null or btype not in ('characters', 'items', 'classes', 'guide', 'tierlist', 'planner', 'checklist', 'timeline') then
    raise exception 'That Block type can''t be added here.';
  end if;
  if bicon !~ '^[A-Za-z0-9]{1,40}$' then raise exception 'That symbol isn''t one of ours.'; end if;
  if char_length(coalesce(bintro, '')) > 200 then raise exception 'The Block''s line is longer than 200 characters.'; end if;
  select coalesce(array_agg(left(x, 40)), '{}') into filt
  from (select jsonb_array_elements_text(case when jsonb_typeof(b -> 'filters') = 'array' then b -> 'filters' else '[]'::jsonb end) as x limit 5) f;

  -- The Page: a new one, or one that's there.
  if d.action = 'add_page' then
    if char_length(ptitle) not between 1 and 40 then raise exception 'The Page needs a name of 40 characters or fewer.'; end if;
    if picon !~ '^[A-Za-z0-9]{1,40}$' then raise exception 'That symbol isn''t one of ours.'; end if;
    if ptint is null or ptint not in ('leaf', 'sky', 'berry', 'sun', 'plum', 'teal', 'indigo', 'slate') then raise exception 'That isn''t one of the Page colors.'; end if;
    pshort := left(coalesce(nullif(btrim(coalesce(pg ->> 'short', '')), ''), split_part(ptitle, ' ', 1)), 24);
    base := public.key_from(ptitle, 'new-page');
    -- The app's own routes beside Pages (src/app/g/[game]/, and RESERVED_PAGE_KEYS in src/lib/block-types.ts):
    -- a Page called "Tiers" at /g/<game>/tiers would open the tier list route instead.
    if base in ('workshop', 'plans', 'tiers', 'opengraph-image') then base := base || '-page'; end if;
    pkey := base; n := 1;
    while exists (select 1 from public.app_pages where game_id = d.game_id and page_key = pkey) loop
      n := n + 1; pkey := base || '-' || n;
    end loop;
    insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position)
    values (d.game_id, pkey, ptitle, pshort, picon, ptint, '',
            coalesce((select max(position) + 1 from public.app_pages where game_id = d.game_id), 0));
  else
    pkey := c ->> 'pageKey';
    if pkey is null or not exists (select 1 from public.app_pages where game_id = d.game_id and page_key = pkey) then
      raise exception 'The Page this Block was for isn''t in the app any more.';
    end if;
  end if;

  -- What a Tier list ranks: a Block with pieces, on the same Page. What a Planner picks from: a
  -- Characters Block in this game, and optionally a Classes Block. Built here, never copied.
  if btype = 'tierlist' then
    if not exists (select 1 from public.game_blocks where game_id = d.game_id and page_key = pkey
                   and block_key = b ->> 'ranks' and type in ('characters', 'items', 'classes')) then
      raise exception 'A Tier list ranks a Characters, Items or Classes Block on its own Page.';
    end if;
    tiers := jsonb_build_object('ranks', b ->> 'ranks', 'tiers',
      '[{"key":"s","label":"S"},{"key":"a","label":"A"},{"key":"b","label":"B"},{"key":"c","label":"C"},{"key":"d","label":"D"}]'::jsonb);
  elsif btype = 'planner' then
    if not exists (select 1 from public.game_blocks where game_id = d.game_id and block_key = b ->> 'roster' and type = 'characters') then
      raise exception 'A Planner picks its party from a Characters Block in this game.';
    end if;
    plan := jsonb_build_object('roster', b ->> 'roster');
    if nullif(b ->> 'classes', '') is not null then
      if not exists (select 1 from public.game_blocks where game_id = d.game_id and block_key = b ->> 'classes' and type = 'classes') then
        raise exception 'The class steps come from a Classes Block in this game.';
      end if;
      plan := plan || jsonb_build_object('classes', b ->> 'classes');
    end if;
    if jsonb_typeof(b -> 'size') = 'number' then
      -- Clamped before it becomes a whole number, so a huge one can't overflow.
      size := least(100, greatest(1, round((b ->> 'size')::numeric)))::int;
      plan := plan || jsonb_build_object('size', size);
    end if;
  end if;

  -- The Block's key: the one the Draft suggested if it fits and is free, else made from its name.
  base := case when d.block_key ~ '^[a-z0-9-]{2,48}$' then left(d.block_key, 40) else public.key_from(btitle, 'new-block') end;
  bkey := base; n := 1;
  while exists (select 1 from public.game_blocks where game_id = d.game_id and block_key = bkey) loop
    n := n + 1; bkey := base || '-' || n;
  end loop;

  insert into public.game_blocks (game_id, block_key, title, position, page_key, type, icon, intro, filters, by_route, tier_setup, plan_setup)
  values (d.game_id, bkey, btitle,
          coalesce((select max(position) + 1 from public.game_blocks where game_id = d.game_id), 0),
          pkey, btype, bicon, bintro, filt,
          coalesce(b ->> 'byRoute' = 'true', false) and btype not in ('guide', 'tierlist'),
          tiers, plan);

  update public.drafts
  set status = 'stable', block_key = bkey, decided_by = auth.uid(), decided_at = now(), decline_reason = null
  where id = d.id;
end $$;

revoke all on function public.ship_structure(public.drafts) from public, anon, authenticated;

create or replace function public.ship_draft(draft uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  d   public.drafts;
  cid uuid;
  rid bigint;
  base text;
  new_slug text;
  n   int := 1;
begin
  select * into d from public.drafts where id = draft for update;
  if d.id is null then raise exception 'That Draft no longer exists.'; end if;
  if not public.is_moderator(d.game_id) then raise exception 'Only moderators can publish Drafts.'; end if;
  if d.status not in ('checking', 'open', 'approved') then raise exception 'This Draft has already been decided.'; end if;

  -- A new Page or Block: it creates them, and has no entry.
  if d.action in ('add_page', 'add_block') then
    perform public.ship_structure(d);
    update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
    where draft_id = d.id and status = 'open';
    return null;
  end if;

  cid := d.card_id;
  if cid is not null then
    if not exists (select 1 from public.cards c where c.id = cid and c.game_id = d.game_id) then
      raise exception 'That entry isn''t in this game.';
    end if;
    -- Every entry in the app has a Stable version; one without has been removed.
    if not exists (select 1 from public.card_pointers p where p.card_id = cid and p.channel = 'stable') then
      raise exception 'That entry was removed from the app.';
    end if;
  end if;

  -- A removal: the entry leaves the app. Its versions stay, for bringing it back.
  if d.action = 'remove' then
    delete from public.card_pointers where card_id = cid;

    update public.drafts
    set status = 'stable', decided_by = auth.uid(), decided_at = now(), decline_reason = null
    where id = d.id;

    -- Fixes still waiting on it have nothing left to change. Batch rows are set aside by
    -- ship_batch itself when their batch is published.
    update public.drafts
    set status = 'declined', decided_by = auth.uid(), decided_at = now(),
        decline_reason = 'The entry was removed from the app.'
    where card_id = cid and id <> d.id and batch_id is null
      and status in ('checking', 'open', 'approved', 'preview');

    update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
    where draft_id = d.id and status = 'open';

    return null;
  end if;

  if cid is null then
    base := trim(both '-' from regexp_replace(lower(coalesce(d.content->>'name', d.title)), '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'entry'; end if;
    new_slug := base;
    while exists (select 1 from public.cards c where c.game_id = d.game_id and c.block_key = d.block_key and c.slug = new_slug) loop
      n := n + 1;
      new_slug := base || '-' || n;
    end loop;
    insert into public.cards (game_id, block_key, slug, position)
    values (d.game_id, d.block_key, new_slug,
            coalesce((select max(position) + 1 from public.cards c where c.game_id = d.game_id and c.block_key = d.block_key), 0))
    returning id into cid;
  end if;

  insert into public.card_revisions (card_id, content, summary, draft_id, created_by)
  values (cid, d.content, d.title, d.id, auth.uid())
  returning id into rid;

  insert into public.card_pointers (card_id, channel, revision_id, updated_by)
  values (cid, 'stable', rid, auth.uid())
  on conflict (card_id, channel) do update
    set revision_id = excluded.revision_id, updated_by = excluded.updated_by, updated_at = now();

  update public.drafts
  set status = 'stable', card_id = cid, decided_by = auth.uid(), decided_at = now(), decline_reason = null
  where id = d.id;

  update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
  where draft_id = d.id and status = 'open';

  return rid;
end $$;

-- What to read: the new actions are allowed, publishing knows them, and Discord still skips them.
select
  (select pg_get_constraintdef(oid) like '%add_page%' from pg_constraint where conname = 'drafts_action_check') as drafts_allow_pages_and_blocks,
  (select pg_get_functiondef('public.ship_draft(uuid)'::regprocedure) like '%ship_structure%') as publishing_creates_them,
  (select pg_get_functiondef('public.ship_draft(uuid)'::regprocedure) like '%action = ''remove''%') as removals_still_work,
  (select pg_get_triggerdef(oid) like '%action%' from pg_trigger where tgname = 'drafts_discord' limit 1) as discord_skips_them,
  (select count(*) from public.drafts where action in ('add_page', 'add_block')) as page_and_block_drafts;
