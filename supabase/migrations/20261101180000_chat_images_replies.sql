-- Chat: pictures (screenshots as proof) and replies that quote a message (docs/chat.md).
-- Safe to run twice.

-- Pictures on a message: a short list of { path, w, h } in the chat-images bucket below.
-- A message can be pictures alone, with no words.
alter table public.chat_messages add column if not exists attachments jsonb;
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check check (
  char_length(body) <= 4000
  and (char_length(body) >= 1 or jsonb_array_length(coalesce(attachments, '[]'::jsonb)) > 0));
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_attachments_check') then
    alter table public.chat_messages add constraint chat_messages_attachments_check check (
      attachments is null or (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) between 1 and 4));
  end if;
end $$;

-- A reply quotes the message it answers.
alter table public.chat_messages add column if not exists reply_to bigint references public.chat_messages (id) on delete set null;

-- Where the pictures live: a public bucket, files under game/person/, 5 MB at most, pictures
-- only. You can only upload into your own folder; moderators of the game (and you) can delete.
-- Guarded, because the test database has no storage.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('chat-images', 'chat-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "chat images: upload your own" on storage.objects';
    execute $p$create policy "chat images: upload your own" on storage.objects for insert to authenticated
      with check (bucket_id = 'chat-images' and (storage.foldername(name))[2] = auth.uid()::text)$p$;

    execute 'drop policy if exists "chat images: remove" on storage.objects';
    execute $p$create policy "chat images: remove" on storage.objects for delete to authenticated
      using (bucket_id = 'chat-images' and ((storage.foldername(name))[2] = auth.uid()::text
        or public.is_moderator((storage.foldername(name))[1])))$p$;
  end if;
end $$;
