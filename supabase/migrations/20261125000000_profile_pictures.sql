-- Profile pictures (docs/inbox.md, "Profiles"): upload your own, like any forum. Safe to run twice.
-- Run it on its own: nothing in seed-app.sql depends on it. The site works before it's run
-- (everyone keeps their Discord picture or initials); uploading just says it's almost ready.
--
--   profiles.picture   null   = your Discord picture, if you signed in with Discord (avatar_url)
--                      'none' = no picture: your initials
--                      '<your id>/<file>.webp|jpg|png' = a picture you uploaded to "avatars"
--   avatars            a public bucket, 2 MB at most, still pictures only, one folder per person.
--                      You upload only into your own folder; you and any moderator can delete.
--   remove_picture     a moderator takes someone's picture down (it becomes 'none') and the
--                      person hears why in their inbox ('picture_removed'). They can upload another.

alter table public.profiles add column if not exists picture text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_picture_check') then
    -- Only our own bucket, only your own folder: nobody can point their picture at an outside site.
    alter table public.profiles add constraint profiles_picture_check
      check (picture is null or picture = 'none' or picture ~ ('^' || id::text || '/[0-9a-f-]{36}\.(webp|jpg|png)$'));
  end if;
end $$;
grant update (picture) on public.profiles to authenticated;

-- The bucket (guarded, because the test database has no storage) ------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "avatars: upload your own" on storage.objects';
    execute $p$create policy "avatars: upload your own" on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;

    execute 'drop policy if exists "avatars: remove" on storage.objects';
    execute $p$create policy "avatars: remove" on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.moderators m where m.profile_id = auth.uid())))$p$;
  end if;
end $$;

-- A moderator takes a picture down -------------------------------------------------------------
create or replace function public.remove_picture(who uuid, reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.moderators where profile_id = auth.uid()) then
    raise exception 'Only moderators can take a picture down.' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(reason, ''))) < 3 then
    raise exception 'Say why, in a few words.' using errcode = 'P0001';
  end if;
  update public.profiles set picture = 'none' where id = who;
  if not found then raise exception 'No villager by that id.' using errcode = 'P0001'; end if;
  if who <> auth.uid() then
    insert into public.inbox (profile_id, game_id, type, payload)
    values (who, null, 'picture_removed', jsonb_build_object('reason', left(trim(reason), 300), 'by', auth.uid()));
  end if;
end $$;
revoke execute on function public.remove_picture(uuid, text) from public, anon;
grant execute on function public.remove_picture(uuid, text) to authenticated;

-- What to read: the column, its rule and the function are in place, and the bucket's rules
-- (the bucket itself is checked by uploading a picture on your profile).
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'picture') as picture_column,
  (select count(*) from pg_constraint where conname = 'profiles_picture_check') as picture_rule,
  (select count(*) from pg_proc where proname = 'remove_picture') as remove_function,
  (select count(*) from pg_policies where policyname like 'avatars:%') as avatar_rules_of_2;
