-- Village: Communities on each game's home (docs/blocks/discord.md, part 2).
--   * communities: Discord servers (by invite code) and plain links (a subreddit, a forum) that
--     players list for a game. Each waits for a moderator's approval before it shows.
--     For Discord, what players see (name, icon, members) is read from Discord by our server
--     and never stored, so it can't be faked; `name` is only a label for moderators and the inbox.
--   * community_votes: "Recommend" (+1) or "Not for me" (-1); who voted how stays private,
--     totals come from community_tallies(). Nobody votes on their own listing.
--   * deciding (approve, decline with a reason) tells the lister in their inbox.
--   * reports: a flag can point at a listing; taking a listing down closes its reports.
--   * rate limit: 5 listings a day per player.
-- Safe to run twice.

create table if not exists public.communities (
  id             uuid primary key default gen_random_uuid(),
  game_id        text not null references public.games (id) on delete cascade,
  kind           text not null check (kind in ('discord', 'link')),
  invite         text check (invite ~ '^[A-Za-z0-9-]{2,32}$'),          -- Discord invite code
  url            text check (char_length(url) <= 300),                 -- a plain link's address
  name           text check (char_length(name) between 2 and 60),
  pitch          text not null check (char_length(pitch) between 3 and 100),
  listed_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status         text not null default 'waiting' check (status in ('waiting', 'live', 'declined', 'removed')),
  decided_by     uuid references public.profiles (id) on delete set null,
  decided_at     timestamptz,
  decline_reason text check (char_length(decline_reason) <= 300),
  created_at     timestamptz not null default now(),
  check ((kind = 'discord' and invite is not null and url is null)
      or (kind = 'link' and url is not null and name is not null and invite is null))
);
create index if not exists communities_game_idx on public.communities (game_id, status);
-- One listing per server or address per game, while it's waiting or live.
create unique index if not exists communities_one_invite on public.communities (game_id, lower(invite)) where invite is not null and status in ('waiting', 'live');
create unique index if not exists communities_one_url on public.communities (game_id, lower(url)) where url is not null and status in ('waiting', 'live');

-- A plain link: https, a real host name, not a link shortener, and not Discord (that's the other kind).
create or replace function public.community_link_ok(u text) returns boolean
language sql immutable as $$
  select u ~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(:[0-9]+)?(/[^[:space:]]*)?$'
     and lower(substring(u from '^https://([^/:]+)')) not in (
       'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly',
       'tiny.cc', 'shorturl.at', 'rb.gy', 'linktr.ee', 'discord.gg', 'discord.com', 'discordapp.com', 'www.discord.com')
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'communities_link_ok') then
    alter table public.communities add constraint communities_link_ok check (url is null or public.community_link_ok(url));
  end if;
end $$;

-- Votes -------------------------------------------------------------------------------------
create table if not exists public.community_votes (
  community_id uuid not null references public.communities (id) on delete cascade,
  voter_id     uuid not null references public.profiles (id) on delete cascade,
  value        smallint not null check (value in (-1, 1)),
  created_at   timestamptz not null default now(),
  primary key (community_id, voter_id)
);

-- Rules -------------------------------------------------------------------------------------
alter table public.communities     enable row level security;
alter table public.community_votes enable row level security;

-- Live listings for everyone; your own whatever their state; moderators see all of their game's.
drop policy if exists "read communities" on public.communities;
create policy "read communities" on public.communities for select
  using (status = 'live' or listed_by = auth.uid() or public.is_moderator(game_id));
-- Listing: as yourself, waiting for approval. Changes after that go through the functions below.
drop policy if exists "list a community" on public.communities;
create policy "list a community" on public.communities for insert
  with check (listed_by = auth.uid() and status = 'waiting' and decided_by is null and decided_at is null and decline_reason is null);

drop policy if exists "read own community votes" on public.community_votes;
create policy "read own community votes" on public.community_votes for select using (voter_id = auth.uid());
drop policy if exists "vote on communities" on public.community_votes;
create policy "vote on communities" on public.community_votes for insert
  with check (voter_id = auth.uid() and exists (
    select 1 from public.communities c where c.id = community_id and c.status = 'live' and c.listed_by <> auth.uid()));
drop policy if exists "change own community vote" on public.community_votes;
create policy "change own community vote" on public.community_votes for update
  using (voter_id = auth.uid())
  with check (voter_id = auth.uid() and exists (
    select 1 from public.communities c where c.id = community_id and c.status = 'live' and c.listed_by <> auth.uid()));
drop policy if exists "take back own community vote" on public.community_votes;
create policy "take back own community vote" on public.community_votes for delete using (voter_id = auth.uid());

-- Totals for a game's live listings (the app hides them below 5 votes).
create or replace function public.community_tallies(g text)
returns table (community_id uuid, ups int, downs int)
language sql stable security definer set search_path = public as $$
  select c.id,
         count(v.value) filter (where v.value = 1)::int,
         count(v.value) filter (where v.value = -1)::int
  from public.communities c
  left join public.community_votes v on v.community_id = c.id
  where c.game_id = g and c.status = 'live'
  group by c.id
$$;
grant execute on function public.community_tallies(text) to anon, authenticated;

-- Rate limit: 5 listings a day ----------------------------------------------------------------
-- A new listing always starts fresh and waiting, whatever was sent, so it can't be backdated
-- past the limit or arrive already decided.
create or replace function public.communities_slow_down() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now(); new.status := 'waiting';
  new.decided_by := null; new.decided_at := null; new.decline_reason := null;
  if (select count(*) from public.communities where listed_by = new.listed_by and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Slow down a little: 5 listings a day at most.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists communities_slow_down on public.communities;
create trigger communities_slow_down before insert on public.communities
  for each row execute function public.communities_slow_down();

-- Moderators decide; the lister hears about it -----------------------------------------------
create or replace function public.decide_community(c uuid, approve boolean, reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare lst public.communities; title text;
begin
  select * into lst from public.communities where id = c for update;
  if lst.id is null then raise exception 'That listing no longer exists.' using errcode = 'P0001'; end if;
  if auth.uid() is null or not public.is_moderator(lst.game_id) then
    raise exception 'Only this game''s moderators can approve listings.' using errcode = 'P0001';
  end if;
  if lst.status <> 'waiting' then raise exception 'This listing has already been decided.' using errcode = 'P0001'; end if;
  if not approve and char_length(trim(coalesce(reason, ''))) < 3 then
    raise exception 'Say in a few words why, so they know what would get it in.' using errcode = 'P0001';
  end if;

  update public.communities
  set status = case when approve then 'live' else 'declined' end, decided_by = auth.uid(), decided_at = now(),
      decline_reason = case when approve then null else left(trim(reason), 300) end
  where id = c;

  select g.title into title from public.games g where g.id = lst.game_id;
  insert into public.inbox (profile_id, game_id, type, payload)
  values (lst.listed_by, lst.game_id, case when approve then 'community_live' else 'community_declined' end,
    jsonb_build_object(
      'community', lst.id,
      'title', case when approve then coalesce(lst.name, 'Your community') || ' is listed on ' || title
                    else coalesce(lst.name, 'Your community') || ' wasn''t listed' end,
      'body', case when approve then 'Players can find it on the game''s home now.' else left(trim(reason), 300) end,
      'href', '/g/' || lst.game_id));
end $$;
grant execute on function public.decide_community(uuid, boolean, text) to authenticated;

-- A moderator takes a listing down, or the lister takes their own away. Closes its reports.
create or replace function public.remove_community(c uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lst public.communities;
begin
  select * into lst from public.communities where id = c for update;
  if lst.id is null then raise exception 'That listing no longer exists.' using errcode = 'P0001'; end if;
  if auth.uid() is null or not (public.is_moderator(lst.game_id) or lst.listed_by = auth.uid()) then
    raise exception 'Only a moderator or whoever listed it can take it down.' using errcode = 'P0001';
  end if;
  update public.communities set status = 'removed', decided_by = auth.uid(), decided_at = now() where id = c;
  update public.flags set status = 'resolved', handled_by = auth.uid(), handled_at = now()
  where community_id = c and status = 'open';
end $$;
grant execute on function public.remove_community(uuid) to authenticated;

-- Reports: a flag can point at a listing --------------------------------------------------------
alter table public.flags add column if not exists community_id uuid references public.communities (id) on delete cascade;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'flags_one_target') then
    alter table public.flags drop constraint flags_one_target;
  end if;
  alter table public.flags add constraint flags_one_target
    check (num_nonnulls(message_id, draft_id, question_id, video_id, tier_placement_id, community_id) = 1);
  if not exists (select 1 from pg_constraint where conname = 'flags_reporter_id_community_id_key') then
    alter table public.flags add constraint flags_reporter_id_community_id_key unique (reporter_id, community_id);
  end if;
end $$;

create or replace function public.flag_game() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.game_id := coalesce(
    (select game_id from public.chat_messages where id = new.message_id),
    (select game_id from public.drafts where id = new.draft_id),
    (select game_id from public.questions where id = new.question_id),
    (select game_id from public.videos where id = new.video_id),
    (select l.game_id from public.tier_placements tp join public.tier_lists l on l.id = tp.list_id where tp.id = new.tier_placement_id),
    (select game_id from public.communities where id = new.community_id));
  return new;
end $$;
