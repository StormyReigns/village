-- World (docs/blocks/world.md): a real map for a Places Block. Builders pick any picture (the
-- game's map, a drawing, a scribble); each place gets a pin on it that opens the place.
--
--   * game_blocks.map (jsonb): the Block's map picture, { picture, w, h }, where picture is a
--     path in the map-pictures bucket ("game/person/file.webp"). Set by the game's moderators,
--     like a field setup (the "mods edit blocks" rule already covers it).
--   * A place's pin isn't stored here: it's part of the place's content ({ spot: { x, y } },
--     percent across and down the picture), so a pin is proposed, voted and published as an
--     ordinary Draft, and history keeps every move.
--   * map-pictures: a public bucket like guide-pictures, but 10 MB, since a map is one big
--     picture. You can only upload into your own folder; you or the game's moderators delete.
--
-- Safe to run twice. Guarded, because the test database has no storage.

alter table public.game_blocks add column if not exists map jsonb;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('map-pictures', 'map-pictures', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "map pictures: upload your own" on storage.objects';
    execute $p$create policy "map pictures: upload your own" on storage.objects for insert to authenticated
      with check (bucket_id = 'map-pictures' and (storage.foldername(name))[2] = auth.uid()::text
        and public.is_moderator((storage.foldername(name))[1]))$p$;

    execute 'drop policy if exists "map pictures: remove" on storage.objects';
    execute $p$create policy "map pictures: remove" on storage.objects for delete to authenticated
      using (bucket_id = 'map-pictures' and ((storage.foldername(name))[2] = auth.uid()::text
        or public.is_moderator((storage.foldername(name))[1])))$p$;
  end if;
end $$;
