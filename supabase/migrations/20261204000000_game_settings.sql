-- Game settings as Drafts, slice 4 of starting a game (docs/games.md; Matt, 2026-11-21). A game's name, short
-- name, platform, release date, kind, look, cover and routes could only be changed in code (or by a moderator in
-- the database). Now anyone signed in can suggest them from the game's Workshop as a Draft; others vote up or
-- down, and the game's moderators publish it, like a Block's setup. Moderators can also save them directly.
-- (The game's wiki already has its own editor: src/components/wiki/WikiCheck.tsx.)
--
-- Run order: after 20261203000000_game_launch.sql (run 2026-11-22). Safe to run twice. This replaces ship_draft
-- with a copy of the one in 20261127000000 plus the new part, so if 20261127000000 is ever run again after this
-- one, run this one again too (otherwise game settings Drafts can't be published; nothing else breaks).
--
-- What it changes:
-- 1. Drafts get one more action, 'game': its block_key is '@game' (no Block), and it names no entry and joins no batch.
-- 2. ship_game: each setting is checked (lengths, a real date, the look one of ours, routes as a question and
--    2 to 8 options that keep every route the game already has, so nothing that differs by route loses its
--    route), the name mustn't be another game's, and a cover is only a picture uploaded for this game by the
--    Draft's author or a moderator. The Draft carries the settings as they were when sent ("before"); if any it
--    changes have changed since, publishing refuses rather than overwrite them.
-- 3. Nothing else: the chat note reads "New settings for Spire is now in the app.", and Discord skips Drafts
--    that aren't edits.
--
-- The Draft's content (written by src/app/g/[game]/workshop/GameSettings.tsx):
--   { "name": <title>, "sections": [], "categories": {},
--     "game":   any of { "title", "shortTitle", "platform", "releaseDate", "genre", "shade", "cover", "paths" },
--     "before": the same keys as the game's row had them when the Draft was sent }

-- 1. The action ----------------------------------------------------------------------------------------------
alter table public.drafts drop constraint if exists drafts_action_check;
alter table public.drafts add constraint drafts_action_check
  check (action in ('edit', 'remove', 'add_page', 'add_block', 'setup', 'game')
         and (action = 'edit' or batch_id is null)
         and (action <> 'remove' or card_id is not null)
         and (action not in ('add_page', 'add_block', 'setup', 'game') or card_id is null)
         and (action <> 'game' or block_key = '@game'));

-- 2. Publishing ----------------------------------------------------------------------------------------------
create or replace function public.ship_game(d public.drafts) returns void
language plpgsql security definer set search_path = public as $$
declare
  s       jsonb := d.content -> 'game';
  bef     jsonb := coalesce(d.content -> 'before', '{}'::jsonb);
  g       public.games;
  cur     jsonb;
  k       text;
  v_title text;
  v_short text;
  v_plat  text;
  v_genre text;
  v_date  date;
  v_cover text;
  uuid_re text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  dup     text;
begin
  select * into g from public.games where id = d.game_id for update;
  if g.id is null then raise exception 'That game isn''t in Village any more.'; end if;
  if s is null or jsonb_typeof(s) <> 'object' or s = '{}'::jsonb then raise exception 'This Draft has no settings in it.'; end if;
  if exists (select 1 from jsonb_object_keys(s) x where x not in ('title', 'shortTitle', 'platform', 'releaseDate', 'genre', 'shade', 'cover', 'paths')) then
    raise exception 'That setting can''t be changed here.';
  end if;
  if octet_length(d.content::text) > 20000 then raise exception 'Those settings are too big to send.'; end if;

  -- Nothing it changes may have changed since it was sent.
  cur := jsonb_build_object('title', g.title, 'shortTitle', g.short_title, 'platform', g.platform, 'releaseDate', g.release_date::text,
                            'genre', g.genre, 'shade', g.shade, 'cover', g.cover, 'paths', g.paths);
  for k in select jsonb_object_keys(s) loop
    if coalesce(bef -> k, 'null'::jsonb) is distinct from coalesce(cur -> k, 'null'::jsonb) then
      raise exception 'The settings of % changed since this was sent. Open them and send yours again.', coalesce(g.short_title, g.title);
    end if;
  end loop;

  v_title := case when s ? 'title' then btrim(regexp_replace(coalesce(s ->> 'title', ''), '\s+', ' ', 'g')) else g.title end;
  v_short := case when s ? 'shortTitle' then btrim(regexp_replace(coalesce(s ->> 'shortTitle', ''), '\s+', ' ', 'g')) else g.short_title end;
  v_plat  := case when s ? 'platform' then btrim(regexp_replace(coalesce(s ->> 'platform', ''), '\s+', ' ', 'g')) else g.platform end;
  v_genre := case when s ? 'genre' then btrim(regexp_replace(coalesce(s ->> 'genre', ''), '\s+', ' ', 'g')) else g.genre end;
  if char_length(coalesce(v_title, '')) not between 2 and 120 then raise exception 'The game needs its name, 2 to 120 characters.'; end if;
  if s ? 'shortTitle' and char_length(v_short) not between 1 and 40 then raise exception 'The short name is 1 to 40 characters.'; end if;
  if s ? 'platform' and char_length(v_plat) not between 1 and 80 then raise exception 'Say what it''s played on, 80 characters at most.'; end if;
  if s ? 'genre' and char_length(v_genre) not between 1 and 40 then raise exception 'Say what kind of game it is, 40 characters at most.'; end if;
  if s ? 'releaseDate' then
    begin v_date := (s ->> 'releaseDate')::date; exception when others then v_date := null; end;
    if v_date is null or v_date < date '1970-01-01' or v_date > (current_date + interval '10 years')::date then
      raise exception 'The release date needs to be a real one (a guess is fine).';
    end if;
  end if;
  if s ? 'shade' and coalesce(s ->> 'shade', '') not in ('standard', 'cozy', 'fantasy', 'shooter', 'openworld') then
    raise exception 'Pick the look closest to the game.';
  end if;

  -- A new name mustn't be another game's.
  if s ? 'title' or s ? 'shortTitle' then
    select o.title into dup from public.games o
    where o.id <> g.id and (public.game_name_key(o.title) in (public.game_name_key(v_title), public.game_name_key(v_short))
       or public.game_name_key(o.short_title) in (public.game_name_key(v_title), public.game_name_key(v_short)))
    limit 1;
    if dup is not null then raise exception '% is another game in Village. Pick a name that''s this game''s own.', dup; end if;
  end if;

  -- A cover: one of our uploads for this game, by the Draft's author or one of its moderators; or none.
  if s ? 'cover' then
    v_cover := nullif(s ->> 'cover', '');
    if v_cover is not null then
      if v_cover !~ ('^' || regexp_replace(g.id, '[^a-z0-9-]', '', 'g') || '/' || uuid_re || '/' || uuid_re || '\.(webp|jpg|gif|png)$') then
        raise exception 'That cover isn''t one of ours.';
      end if;
      if split_part(v_cover, '/', 2) <> d.author_id::text and not exists (
           select 1 from public.moderators m where m.profile_id::text = split_part(v_cover, '/', 2) and (m.game_id = g.id or m.game_id is null)) then
        raise exception 'That cover was uploaded by someone else.';
      end if;
    end if;
  end if;

  -- Routes: a question and 2 to 8 options, keeping every route the game already has.
  if s ? 'paths' then
    if jsonb_typeof(s -> 'paths') = 'null' then
      if g.paths is not null then raise exception 'A game''s routes can''t be taken away here: entries depend on them.'; end if;
    else
      if not public.game_paths_ok(s -> 'paths') then raise exception 'Routes need a question and 2 to 8 choices, each with a name.'; end if;
      if g.paths is not null and exists (
           select 1 from jsonb_array_elements(g.paths -> 'options') o
           where not exists (select 1 from jsonb_array_elements(s -> 'paths' -> 'options') n where n ->> 'key' = o ->> 'key')) then
        raise exception 'Every route the game already has stays: entries depend on them. Rename one instead.';
      end if;
    end if;
  end if;

  update public.games set
    title        = v_title,
    short_title  = case when s ? 'shortTitle' then v_short else short_title end,
    platform     = case when s ? 'platform' then v_plat else platform end,
    genre        = case when s ? 'genre' then v_genre else genre end,
    release_date = case when s ? 'releaseDate' then v_date else release_date end,
    shade        = case when s ? 'shade' then s ->> 'shade' else shade end,
    cover        = case when s ? 'cover' then v_cover else cover end,
    paths        = case when s ? 'paths' then nullif(s -> 'paths', 'null'::jsonb) else paths end
  where id = g.id;

  update public.drafts
  set status = 'stable', decided_by = auth.uid(), decided_at = now(), decline_reason = null
  where id = d.id;
end $$;

revoke all on function public.ship_game(public.drafts) from public, anon, authenticated;

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

  -- A game's settings: they change the game, and have no entry.
  if d.action = 'game' then
    perform public.ship_game(d);
    update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
    where draft_id = d.id and status = 'open';
    return null;
  end if;

  -- A Block's setup: it changes the Block, and has no entry.
  if d.action = 'setup' then
    perform public.ship_setup(d);
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

-- What to read: game settings Drafts are allowed, and publishing knows them and the earlier kinds.
select
  (select pg_get_constraintdef(oid) like '%''game''%' from pg_constraint where conname = 'drafts_action_check') as drafts_allow_game_settings,
  (select pg_get_functiondef('public.ship_draft(uuid)'::regprocedure) like '%ship_game%') as publishing_writes_them,
  (select pg_get_functiondef('public.ship_draft(uuid)'::regprocedure) like '%ship_setup%') as setups_still_work,
  (select pg_get_functiondef('public.ship_draft(uuid)'::regprocedure) like '%ship_structure%') as pages_and_blocks_still_work;
