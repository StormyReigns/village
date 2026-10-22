-- Village: the game app moves into the database, as Pages made of Blocks.
--   * app_pages: a game's Pages (topics), in order, each with a color
--   * game_blocks gain a Page and their preset settings (type, look, filters, ...)
--   * cards are the entries; each keeps its place in its Block
--   * ship_draft(): a moderator publishes a Draft into the app in one step
--   * existing Drafts and chat move from the old block names to the new ones

-- Pages ---------------------------------------------------------------------
create table if not exists public.app_pages (
  game_id  text not null references public.games (id) on delete cascade,
  page_key text not null check (page_key ~ '^[a-z0-9-]{2,48}$'),
  title    text not null,
  short    text not null,                       -- one word for the phone's bottom bar
  icon     text not null default 'BookOpen',
  tint     text not null default 'leaf' check (tint in ('leaf', 'sky', 'berry', 'sun', 'plum', 'teal')),
  blurb    text not null default '',
  position int  not null default 0,
  primary key (game_id, page_key)
);

alter table public.app_pages enable row level security;
drop policy if exists "read pages" on public.app_pages;
create policy "read pages" on public.app_pages for select using (true);
drop policy if exists "mods edit pages" on public.app_pages;
create policy "mods edit pages" on public.app_pages for all
  using (public.is_moderator(game_id)) with check (public.is_moderator(game_id));

-- Blocks: which Page, and their preset settings ----------------------------------
alter table public.game_blocks
  add column if not exists page_key  text,
  add column if not exists type      text not null default 'collection'
    check (type in ('collection', 'guide', 'checklist', 'timeline')),
  add column if not exists look      text check (look in ('portraits', 'slots', 'rows')),
  add column if not exists icon      text not null default 'BookOpen',
  add column if not exists intro     text,
  add column if not exists filters   text[] not null default '{}',
  add column if not exists by_route  boolean not null default false,
  add column if not exists stat_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_blocks_page_fk') then
    alter table public.game_blocks add constraint game_blocks_page_fk
      foreign key (game_id, page_key) references public.app_pages (game_id, page_key) on delete cascade;
  end if;
end $$;

-- Entries (cards): an order within the Block, and names unique per Block ---------------
alter table public.cards add column if not exists position int not null default 0;
alter table public.cards drop constraint if exists cards_game_id_slug_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_block_slug_key') then
    alter table public.cards add constraint cards_block_slug_key unique (game_id, block_key, slug);
  end if;
end $$;

-- Old block names become the new ones -------------------------------------------
update public.drafts set block_key = case block_key
  when 'progress' then 'story' when 'missables' then 'last-chances' when 'people' then 'units'
  when 'builds' then 'classes' when 'places' then 'dungeons-and-places' when 'howto' then 'how-to'
  when 'collections' then 'collectibles' else block_key end;

-- Chat is now tagged with a Page rather than a Block.
update public.chat_messages set block_key = case block_key
  when 'progress' then 'story' when 'missables' then 'last-chances' when 'people' then 'units-and-classes'
  when 'builds' then 'units-and-classes' when 'places' then 'world' when 'foes' then 'world'
  when 'howto' then 'guides' when 'mysteries' then 'guides' when 'collections' then 'collectibles'
  else block_key end
where block_key is not null;

-- Drafts written in the old card shape become entries: a name, a description, sections.
update public.drafts d set content = jsonb_strip_nulls(jsonb_build_object(
    'name', d.title,
    'description', coalesce(d.content->>'summary', d.content->>'how', d.content->>'known', d.content->>'why',
                            d.content->>'tips', d.content->>'unlock', d.content->>'use', ''),
    'order', case when d.content->>'order' ~ '^\d+$' then (d.content->>'order')::int end,
    'sections', '[]'::jsonb,
    'categories', '{}'::jsonb))
where not (d.content ? 'sections');

-- Publishing ----------------------------------------------------------------------
-- A moderator publishes a Draft: it becomes a new revision of its entry (or a new
-- entry), and the Stable pointer moves to it. Earlier revisions stay, for rollback.
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

  cid := d.card_id;
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
