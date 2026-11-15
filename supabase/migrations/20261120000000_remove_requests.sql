-- Asking to remove an entry (Matt, 2026-11-15). Some entries shouldn't be in the app at all, like
-- "Advanced classes" sitting in Classes as an entry when it's really a heading. Anyone signed in
-- can ask for any entry to be removed, with a reason. It's a Draft like any fix: others vote,
-- and a moderator approves or declines it.
--
-- Run order: just this, after 20261119000000_weapon_types.sql. Safe to run twice.
--
-- What it changes:
-- 1. Drafts get an `action`: 'edit' (every Draft so far) or 'remove'. A removal must name an
--    entry, and can't be part of a pasted batch.
-- 2. ship_draft: publishing a removal takes the entry out of the app (its Stable and Preview
--    pointers go). The entry and every version of it are kept, so it can be brought back.
--    Other Drafts still waiting on it are declined ("The entry was removed from the app").
--    A fix to an entry that has been removed can't be published. A Draft can only publish
--    into its own game.
-- 3. The Workshop chat note says "<name> was removed from the app." Removals don't post to Discord.

-- 1. The action --------------------------------------------------------------------------------
alter table public.drafts add column if not exists action text not null default 'edit';

alter table public.drafts drop constraint if exists drafts_action_check;
alter table public.drafts add constraint drafts_action_check
  check (action in ('edit', 'remove') and (action = 'edit' or (card_id is not null and batch_id is null)));

-- 2. Publishing ---------------------------------------------------------------------------------
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

-- 3. The chat note, and Discord ------------------------------------------------------------------
create or replace function public.draft_chat_note() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  page text;
  thread text;
  gone boolean := new.action = 'remove';
begin
  if new.status is not distinct from old.status or new.status not in ('stable', 'declined') then return new; end if;
  -- A note must never undo a publish: if writing it fails for any reason, it's skipped.
  begin
    select page_key into page from public.game_blocks where game_id = new.game_id and block_key = new.block_key;
    thread := case when new.card_id is null then 'draft:' || new.id else 'card:' || new.card_id end;
    -- The note carries the moderator who decided (the Draft's author if unknown); the chat
    -- shows it as the Village's note, naming both the author and the moderator.
    insert into public.chat_messages (game_id, author_id, body, block_key, linked_draft_id, thread_key, kind, event)
    values (
      new.game_id,
      coalesce(new.decided_by, new.author_id),
      left(case
        when new.status = 'stable' and gone then coalesce(nullif(new.content ->> 'name', ''), new.title) || ' was removed from the app.'
        when new.status = 'stable' then new.title || ' is now in the app.'
        else new.title || ' was declined' || coalesce(': ' || new.decline_reason, '.') end, 4000),
      page, new.id, thread, 'system',
      jsonb_build_object(
        'type', case when new.status = 'stable' then 'published' else 'declined' end,
        'draft', new.id,
        'author', new.author_id,
        'before', new.base_revision_id,
        'isNew', old.card_id is null,
        'removed', gone,
        'reason', new.decline_reason));
  exception when others then
    null;
  end;
  return new;
end $$;

-- A removed entry has no page to link to, so removals don't post to Discord.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'discord_queue_published' and pronamespace = 'public'::regnamespace) then
    drop trigger if exists drafts_discord on public.drafts;
    create trigger drafts_discord after update of status on public.drafts
      for each row when (new.batch_id is null and new.action = 'edit') execute function public.discord_queue_published();
  end if;
end $$;

-- What to read: the action column is there (every Draft so far is 'edit'), and publishing knows removals.
select
  (select count(*) from public.drafts where action = 'edit') as drafts_marked_edit,
  (select count(*) from public.drafts where action = 'remove') as removal_requests,
  (select pg_get_functiondef('public.ship_draft(uuid)'::regprocedure) like '%action = ''remove''%') as publishing_handles_removals,
  (select pg_get_triggerdef(oid) like '%action%' from pg_trigger where tgname = 'drafts_discord' limit 1) as discord_skips_removals;
