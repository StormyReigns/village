-- Rate limits can't be dodged with a made-up date (hub, 2026-11-09).
--
-- Every rate limit counts a player's recent rows by created_at ("10 messages a minute",
-- "20 Drafts an hour"...). But a player sends their own rows straight to the database, and nothing
-- stopped them from sending a created_at of last year, which the limits then didn't count. The same
-- trick could push a Draft to the top of "New" or fake a chat message's time.
--
-- Now, for anything a player sends (the anon and authenticated roles), created_at is always the
-- moment it arrives, and an update can never change it. Migrations, seeds and the SQL Editor run as
-- the database owner and keep setting dates as they need to. The trigger is named to run before
-- each table's own slow-down trigger (triggers run in name order).
--
-- Safe to run any time, and twice. It skips tables that don't exist yet; communities set their own
-- date too, and running this again after the Communities SQL covers them as well.

create or replace function public.created_at_now() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.created_at := now();
    else
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['chat_messages', 'chat_reactions', 'drafts', 'draft_votes', 'flags', 'reports',
                           'questions', 'question_askers', 'videos', 'video_votes', 'communities',
                           'community_votes', 'player_marks'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'created_at') then
      execute format('drop trigger if exists a0_created_at_now on public.%I', t);
      execute format('create trigger a0_created_at_now before insert or update on public.%I for each row execute function public.created_at_now()', t);
    end if;
  end loop;
end $$;
