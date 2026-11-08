-- Videos (docs/blocks/videos.md): whoever added a video can delete it only in its first hour
-- (Matt, 2026-11-08). After that they ask for removal instead, which is a report the game's
-- moderators see on the Notice Board; moderators can take any video down at any time.
-- Run after 20261108180000_videos.sql. Safe to run twice.

create or replace function public.remove_video(v uuid) returns void
language plpgsql security definer set search_path = public as $$
declare vid public.videos;
begin
  select * into vid from public.videos where id = v;
  if vid.id is null then raise exception 'That video isn''t here.' using errcode = 'P0001'; end if;
  if not (public.is_moderator(vid.game_id)
          or (vid.added_by = auth.uid() and vid.created_at > now() - interval '1 hour')) then
    if vid.added_by = auth.uid() then
      raise exception 'You can only delete it in its first hour. Ask for removal instead.' using errcode = 'P0001';
    end if;
    raise exception 'Only a moderator can take it down.' using errcode = 'P0001';
  end if;
  update public.videos set status = 'removed', removed_by = auth.uid(), removed_at = now() where id = v;
  update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
  where video_id = v and status = 'open';
end $$;
grant execute on function public.remove_video(uuid) to authenticated;
