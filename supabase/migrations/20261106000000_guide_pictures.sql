-- Guides (Block 3, docs/blocks/guides.md): an optional picture on any step of a guide. A
-- step keeps it as a "[picture:game/person/file]" mark at the end of its line, which only ever
-- points into this bucket (src/lib/guides.ts). Same rules as chat-images: a public bucket,
-- files under game/person/, 5 MB at most, pictures only. You can only upload into your own
-- folder; moderators of the game (and you) can delete. Run this before the In short
-- migration and seed-app.sql. Safe to run twice.
-- Guarded, because the test database has no storage.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('guide-pictures', 'guide-pictures', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "guide pictures: upload your own" on storage.objects';
    execute $p$create policy "guide pictures: upload your own" on storage.objects for insert to authenticated
      with check (bucket_id = 'guide-pictures' and (storage.foldername(name))[2] = auth.uid()::text)$p$;

    execute 'drop policy if exists "guide pictures: remove" on storage.objects';
    execute $p$create policy "guide pictures: remove" on storage.objects for delete to authenticated
      using (bucket_id = 'guide-pictures' and ((storage.foldername(name))[2] = auth.uid()::text
        or public.is_moderator((storage.foldername(name))[1])))$p$;
  end if;
end $$;
