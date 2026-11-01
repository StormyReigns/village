-- Chat threads: a message can belong to the thread of one thing being built, while still
-- showing in the game's one chat (docs/chat.md). The key names the thing, never its name,
-- so renames don't break a thread:
--   card:<uuid>         an entry in the app (Eshmel)
--   draft:<uuid>        a new entry's Draft, until it's published and has a card
--   block:<block key>   a Block's setup (Characters)
--   entry:<block>.<id>  an entry that isn't in the database yet
-- Null means a message to the whole game, as before. Safe to run twice.

alter table public.chat_messages add column if not exists thread_key text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_thread_key_check') then
    alter table public.chat_messages add constraint chat_messages_thread_key_check
      check (thread_key is null or (thread_key ~ '^(card|draft|block|entry):.+' and char_length(thread_key) <= 200));
  end if;
end $$;

create index if not exists chat_thread_idx on public.chat_messages (game_id, thread_key, created_at desc)
  where thread_key is not null;
