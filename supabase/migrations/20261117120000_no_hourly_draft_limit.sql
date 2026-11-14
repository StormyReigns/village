-- No hourly limit on Drafts (Matt, 2026-11-14): editing in the Workshop is never cut off after
-- 20 Drafts an hour. The AI spam check, reports and moderator review stay. Batches keep their
-- own limit of 3 a day, since each holds up to 200 rows.
--
--   * The drafts_slow_down trigger is dropped, so single Drafts have no hourly count.
--   * send_batch() no longer checks the hourly count. Its row names may be 1 to 120 characters,
--     to match 20261117000000_short_entry_names.sql (characters like Mu and Io).
--
-- RUN AFTER 20261117000000_short_entry_names.sql. Run the other way round and this still works,
-- but a batch with a two-letter name would hit the old 3-character rule until that one runs.
-- Safe to run twice.

drop trigger if exists drafts_slow_down on public.drafts;
drop function if exists public.drafts_slow_down();

-- As in 20261112000000_draft_batches.sql, without the hourly check, and names from 1 character.
-- rows: [{ "content": {...entry...}, "card": "<card uuid>" or null, "revision": <base revision> or null,
--          "source": "<this row's own source>" or null }]
create or replace function public.send_batch(g text, block text, title text, source text, rows jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me    uuid := auth.uid();
  bid   uuid;
  r     jsonb;
  name  text;
  card  uuid;
  rev   bigint;
  did   uuid;
  n     int;
  cards uuid[] := '{}';
begin
  if me is null then raise exception 'Sign in to send a batch.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.game_blocks b where b.game_id = g and b.block_key = block) then
    raise exception 'That Block doesn''t exist.' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(source, ''))) < 3 then
    raise exception 'Say where the sheet is from, so it can be credited.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then
    raise exception 'There are no rows to send.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(rows) > 200 then
    raise exception 'A batch holds 200 rows at most. Send the rest as another batch.' using errcode = 'P0001';
  end if;

  select count(*) into n from public.draft_batches where author_id = me and created_at > now() - interval '1 day';
  if n >= 3 then raise exception 'Slow down a little: 3 batches a day at most.' using errcode = 'P0001'; end if;

  insert into public.draft_batches (game_id, block_key, title, source, author_id)
  values (g, block, left(trim(title), 160), left(trim(source), 300), me)
  returning id into bid;

  for r in select * from jsonb_array_elements(rows) loop
    if jsonb_typeof(r -> 'content') <> 'object' then
      raise exception 'A row is missing its content.' using errcode = 'P0001';
    end if;
    if octet_length((r -> 'content')::text) > 20000 then
      raise exception 'A row is too long to send.' using errcode = 'P0001';
    end if;
    name := trim(coalesce(r -> 'content' ->> 'name', ''));
    if char_length(name) not between 1 and 120 then
      raise exception 'Every row needs a name of 1 to 120 characters ("%").', left(name, 40) using errcode = 'P0001';
    end if;
    card := nullif(r ->> 'card', '')::uuid;
    rev := nullif(r ->> 'revision', '')::bigint;
    if card is not null then
      if not exists (select 1 from public.cards c where c.id = card and c.game_id = g and c.block_key = block) then
        raise exception '"%" points at an entry that isn''t in this Block.', left(name, 40) using errcode = 'P0001';
      end if;
      if rev is null or not exists (select 1 from public.card_revisions cr where cr.id = rev and cr.card_id = card) then
        raise exception '"%" needs the version it was based on.', left(name, 40) using errcode = 'P0001';
      end if;
      if card = any(cards) then
        raise exception 'Two rows change the same entry ("%").', left(name, 40) using errcode = 'P0001';
      end if;
      cards := cards || card;
    end if;

    insert into public.drafts (game_id, block_key, card_id, base_revision_id, kind, title, content, source, theory, author_id, status, batch_id)
    values (g, block, card, case when card is null then null else rev end, 'fact', name, r -> 'content',
            left(coalesce(nullif(trim(r ->> 'source'), ''), trim(source)), 300),
            coalesce(r -> 'content' ->> 'flag', '') = 'unconfirmed', me, 'open', bid)
    returning id into did;
    insert into public.draft_credits (draft_id, profile_id, role) values (did, me, 'author');
  end loop;
  return bid;
end $$;
revoke execute on function public.send_batch(text, text, text, text, jsonb) from public, anon;
grant execute on function public.send_batch(text, text, text, text, jsonb) to authenticated;

-- Checks (the SQL Editor shows only this last result) ------------------------------------------
select
  not exists (select 1 from pg_trigger where tgname = 'drafts_slow_down'
     and tgrelid = 'public.drafts'::regclass)                                              as no_hourly_draft_limit,
  position('20 Drafts' in pg_get_functiondef('public.send_batch(text, text, text, text, jsonb)'::regprocedure)) = 0
                                                                                           as batches_skip_hourly_limit,
  position('3 batches a day' in pg_get_functiondef('public.send_batch(text, text, text, text, jsonb)'::regprocedure)) > 0
                                                                                           as batches_keep_daily_limit,
  has_function_privilege('authenticated', 'public.send_batch(text, text, text, text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.send_batch(text, text, text, text, jsonb)', 'execute') as send_signed_in_only;
