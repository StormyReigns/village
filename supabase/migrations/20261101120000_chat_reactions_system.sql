-- Chat: reactions, and system messages (docs/chat.md). Safe to run twice.
--
-- System messages are written by the database, never by a person: when a Draft is
-- published (or declined), a note goes into its entry's thread. The chat shows it in detail
-- there, and as one line in the game's main chat. Villagers can only post ordinary messages.

-- What kind of message, and what happened ------------------------------------------------
alter table public.chat_messages add column if not exists kind text not null default 'chat';
alter table public.chat_messages add column if not exists event jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_kind_check') then
    alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('chat', 'system'));
  end if;
end $$;

drop policy if exists "chat" on public.chat_messages;
create policy "chat" on public.chat_messages for insert
  with check (author_id = auth.uid() and kind = 'chat' and event is null);

-- Notes when a Draft is published or declined ---------------------------------------------
create or replace function public.draft_chat_note() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  page text;
  thread text;
begin
  if new.status = old.status or new.status not in ('stable', 'declined') then return new; end if;
  select page_key into page from public.game_blocks where game_id = new.game_id and block_key = new.block_key;
  thread := case when new.card_id is null then 'draft:' || new.id else 'card:' || new.card_id end;
  insert into public.chat_messages (game_id, author_id, body, block_key, linked_draft_id, thread_key, kind, event)
  values (
    new.game_id,
    coalesce(new.decided_by, new.author_id),
    case when new.status = 'stable'
      then new.title || ' is now in the app.'
      else new.title || ' was declined' || coalesce(': ' || new.decline_reason, '.') end,
    page, new.id, thread, 'system',
    jsonb_build_object(
      'type', case when new.status = 'stable' then 'published' else 'declined' end,
      'draft', new.id,
      'author', new.author_id,
      'before', new.base_revision_id,
      'isNew', old.card_id is null,
      'reason', new.decline_reason));
  return new;
end $$;

drop trigger if exists drafts_chat_note on public.drafts;
create trigger drafts_chat_note after update of status on public.drafts
  for each row execute function public.draft_chat_note();

-- Reactions ------------------------------------------------------------------------------
create table if not exists public.chat_reactions (
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  profile_id uuid   not null references public.profiles (id) on delete cascade,
  emoji      text   not null check (char_length(emoji) between 1 and 16),
  game_id    text,  -- filled in from the message, for live updates per game
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id, emoji)
);
create index if not exists chat_reactions_game_idx on public.chat_reactions (game_id);

create or replace function public.reaction_game() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.game_id := (select game_id from public.chat_messages where id = new.message_id);
  return new;
end $$;
drop trigger if exists chat_reactions_game on public.chat_reactions;
create trigger chat_reactions_game before insert on public.chat_reactions
  for each row execute function public.reaction_game();

alter table public.chat_reactions enable row level security;
drop policy if exists "read reactions" on public.chat_reactions;
create policy "read reactions" on public.chat_reactions for select using (true);
drop policy if exists "react" on public.chat_reactions;
create policy "react" on public.chat_reactions for insert with check (
  profile_id = auth.uid()
  and exists (select 1 from public.chat_messages m where m.id = message_id and m.removed_at is null));
drop policy if exists "unreact" on public.chat_reactions;
create policy "unreact" on public.chat_reactions for delete using (profile_id = auth.uid());

-- Rate limits: system notes don't count, and reactions get their own -----------------------
create or replace function public.slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if tg_table_name = 'chat_messages' then
    if new.kind = 'system' then return new; end if;
    select count(*) into recent from public.chat_messages
    where author_id = new.author_id and kind = 'chat' and created_at > now() - interval '1 minute';
    if recent >= 10 then
      raise exception 'Slow down a little: 10 messages a minute at most.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'drafts' then
    select count(*) into recent from public.drafts
    where author_id = new.author_id and created_at > now() - interval '1 hour';
    if recent >= 20 then
      raise exception 'Slow down a little: 20 Drafts an hour at most.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'chat_reactions' then
    select count(*) into recent from public.chat_reactions
    where profile_id = new.profile_id and created_at > now() - interval '1 minute';
    if recent >= 30 then
      raise exception 'Slow down a little: 30 reactions a minute at most.' using errcode = 'P0001';
    end if;
  else
    select count(*) into recent from public.flags
    where reporter_id = new.reporter_id and created_at > now() - interval '1 hour';
    if recent >= 20 then
      raise exception 'Slow down a little: 20 reports an hour at most.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists chat_reactions_slow_down on public.chat_reactions;
create trigger chat_reactions_slow_down before insert on public.chat_reactions
  for each row execute function public.slow_down();

-- Live updates: reactions come and go for everyone in the game ------------------------------
alter table public.chat_reactions replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_reactions') then
    alter publication supabase_realtime add table public.chat_reactions;
  end if;
end $$;
