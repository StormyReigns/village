-- Bringing back a removed entry (Matt, 2026-11-15). A removal (20261120000000_remove_requests.sql)
-- keeps every version of the entry. A moderator can bring it back from the removal's Draft: its
-- newest version becomes the app's again, and the Workshop chat says it's back.
--
-- Run order: after 20261120000000_remove_requests.sql (it reads drafts.action). Run before that, the
-- function is made but every call fails until the removals SQL is run. Safe to run twice.
--
-- Fixes that were declined when the entry was removed stay declined; a moderator can reopen them.

create or replace function public.restore_entry(draft uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  d    public.drafts;
  rid  bigint;
  page text;
begin
  select * into d from public.drafts where id = draft;
  if d.id is null or d.action <> 'remove' then raise exception 'That isn''t a removal.' using errcode = 'P0001'; end if;
  if auth.uid() is null or not public.is_moderator(d.game_id) then
    raise exception 'Only this game''s moderators can bring an entry back.' using errcode = 'P0001';
  end if;
  if d.status <> 'stable' then raise exception 'That entry was never removed.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.card_pointers where card_id = d.card_id and channel = 'stable') then
    raise exception 'That entry is already back in the app.' using errcode = 'P0001';
  end if;

  select max(id) into rid from public.card_revisions where card_id = d.card_id;
  if rid is null then raise exception 'That entry has no versions to bring back.' using errcode = 'P0001'; end if;

  insert into public.card_pointers (card_id, channel, revision_id, updated_by)
  values (d.card_id, 'stable', rid, auth.uid());

  -- The chat note must never undo bringing it back.
  begin
    select page_key into page from public.game_blocks where game_id = d.game_id and block_key = d.block_key;
    insert into public.chat_messages (game_id, author_id, body, block_key, linked_draft_id, thread_key, kind, event)
    values (
      d.game_id, auth.uid(),
      left(coalesce(nullif((select content ->> 'name' from public.card_revisions where id = rid), ''), d.title) || ' is back in the app.', 4000),
      page, d.id, 'card:' || d.card_id, 'system',
      jsonb_build_object('type', 'published', 'draft', d.id, 'author', d.author_id, 'before', null,
                         'isNew', false, 'restored', true, 'reason', null));
  exception when others then
    null;
  end;

  return rid;
end $$;

revoke execute on function public.restore_entry(uuid) from public, anon;
grant execute on function public.restore_entry(uuid) to authenticated;

-- What to read: the function is there, and only signed-in players (moderators, checked inside) can call it.
select
  exists (select 1 from pg_proc where proname = 'restore_entry' and pronamespace = 'public'::regnamespace) as bring_back_ready,
  has_function_privilege('anon', 'public.restore_entry(uuid)', 'execute') as signed_out_can_call;
