-- Village: make the Workshop live.
--   * profiles get an avatar (from Discord) so chat shows faces
--   * the Standouts view leaves out removed Drafts
--   * rate limits on chat and Drafts
--   * chat, Drafts and votes stream live to everyone in the Workshop

-- Avatars ------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'villager_' || substr(replace(new.id::text, '-', ''), 1, 8),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

-- Fill in avatars for people who signed up before this update.
update public.profiles p
set avatar_url = u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where u.id = p.id and p.avatar_url is null;

-- Standouts view: removed Drafts drop out ---------------------------------------
-- The view keeps running as its owner, because who looked at a Draft is private:
-- visitors see the counts, never the viewer list.
create or replace view public.draft_scores as
select d.id as draft_id,
       d.game_id,
       d.block_key,
       coalesce(v.ups, 0)   as ups,
       coalesce(v.downs, 0) as downs,
       coalesce(w.viewers, 0) as viewers,
       public.wilson_lower(
         greatest(coalesce(v.ups, 0) - coalesce(v.downs, 0), 0),
         greatest(coalesce(w.viewers, 0), coalesce(v.ups, 0) + coalesce(v.downs, 0))
       ) as standout
from public.drafts d
left join (select draft_id, count(*) filter (where value = 1) as ups,
                  count(*) filter (where value = -1) as downs
           from public.draft_votes group by draft_id) v on v.draft_id = d.id
left join (select draft_id, count(distinct viewer_key) as viewers
           from public.draft_views group by draft_id) w on w.draft_id = d.id
where d.status <> 'removed';

-- Rate limits ---------------------------------------------------------------------
-- 10 chat messages a minute and 20 Drafts an hour per villager. Plenty for people,
-- a wall for spam bots.
create or replace function public.slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if tg_table_name = 'chat_messages' then
    select count(*) into recent from public.chat_messages
    where author_id = new.author_id and created_at > now() - interval '1 minute';
    if recent >= 10 then
      raise exception 'Slow down a little: 10 messages a minute at most.' using errcode = 'P0001';
    end if;
  else
    select count(*) into recent from public.drafts
    where author_id = new.author_id and created_at > now() - interval '1 hour';
    if recent >= 20 then
      raise exception 'Slow down a little: 20 Drafts an hour at most.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists chat_slow_down on public.chat_messages;
create trigger chat_slow_down before insert on public.chat_messages
  for each row execute function public.slow_down();
drop trigger if exists drafts_slow_down on public.drafts;
create trigger drafts_slow_down before insert on public.drafts
  for each row execute function public.slow_down();

-- Live updates ------------------------------------------------------------------
-- Supabase streams changes for tables in the supabase_realtime publication. Row-level
-- security still decides who receives each change.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'drafts') then
      alter publication supabase_realtime add table public.drafts;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'draft_votes') then
      alter publication supabase_realtime add table public.draft_votes;
    end if;
  end if;
end $$;
