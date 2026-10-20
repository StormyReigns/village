-- Village: initial schema.
--
-- Shape of the data:
--   games ─┬─ game_blocks ── cards ── card_revisions (append-only history)
--          │                    └──── card_pointers (which revision Stable / Preview show)
--          ├─ drafts ─┬─ draft_credits
--          │          ├─ draft_votes
--          │          └─ draft_views (one row per viewer per day, for Standouts)
--          ├─ chat_messages
--          └─ reports ("was this right?" from the game app)
--
-- Nothing is ever overwritten: a change to a card is a new revision, and publishing or
-- rolling back moves a pointer. Row-level security is on for every table; reads are
-- public, writes are limited to the signed-in author or a moderator.

-- ---------------------------------------------------------------- people

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text,
  is_founder   boolean not null default false,
  hide_planted boolean not null default false,  -- hide the gray "Planted" count on the profile
  created_at   timestamptz not null default now()
);

-- Moderators can approve, decline and publish. A null game_id means every game.
create table public.moderators (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game_id    text,
  created_at timestamptz not null default now(),
  unique (profile_id, game_id)
);

-- Give every new account a profile with a placeholder username they can change later.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'villager_' || substr(replace(new.id::text, '-', ''), 1, 8),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- games and blocks

create table public.games (
  id           text primary key check (id ~ '^[a-z0-9-]{2,48}$'),   -- slug, e.g. 'fortunes-weave'
  title        text not null,
  platform     text,
  release_date date,
  status       text not null default 'draft'
               check (status in ('draft', 'prelaunch', 'launch', 'live', 'archived')),
  preset       text not null,           -- genre preset in src/lib/blocks.ts, e.g. 'tactics-rpg'
  created_at   timestamptz not null default now()
);

-- Which blocks a game uses. block_key matches a block definition in src/lib/blocks.ts;
-- title lets a game rename it ("Units" instead of "People").
create table public.game_blocks (
  game_id   text not null references public.games (id) on delete cascade,
  block_key text not null,
  title     text,
  position  int  not null default 0,
  primary key (game_id, block_key)
);

-- ---------------------------------------------------------------- cards and versions

create table public.cards (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null,
  block_key  text not null,
  slug       text not null,
  created_at timestamptz not null default now(),
  unique (game_id, slug),
  foreign key (game_id, block_key) references public.game_blocks (game_id, block_key) on delete cascade
);

create table public.card_revisions (
  id           bigint generated always as identity primary key,
  card_id      uuid not null references public.cards (id) on delete cascade,
  content      jsonb not null,           -- shaped by the block's field definitions
  game_version text,                     -- game patch this is correct for, e.g. '1.1.0'
  summary      text,                     -- one line: what changed
  draft_id     uuid,                     -- the Draft it came from, if any
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index card_revisions_card_idx on public.card_revisions (card_id, id desc);

-- What each channel shows. Moving a pointer publishes; moving it back rolls back.
create table public.card_pointers (
  card_id     uuid not null references public.cards (id) on delete cascade,
  channel     text not null check (channel in ('stable', 'preview')),
  revision_id bigint not null references public.card_revisions (id),
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now(),
  primary key (card_id, channel)
);

-- Audit trail of every pointer move, so any change can be traced and undone.
create table public.pointer_events (
  id            bigint generated always as identity primary key,
  card_id       uuid not null references public.cards (id) on delete cascade,
  channel       text not null,
  from_revision bigint references public.card_revisions (id),
  to_revision   bigint not null references public.card_revisions (id),
  reason        text,                    -- 'publish', 'rollback', 'market-day', ...
  actor         uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

create function public.log_pointer_move() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pointer_events (card_id, channel, from_revision, to_revision, actor)
  values (new.card_id, new.channel,
          case when tg_op = 'UPDATE' then old.revision_id end,
          new.revision_id, new.updated_by);
  return new;
end $$;

create trigger card_pointers_audit
  after insert or update on public.card_pointers
  for each row execute function public.log_pointer_move();

-- ---------------------------------------------------------------- drafts and voting

create table public.drafts (
  id               uuid primary key default gen_random_uuid(),
  game_id          text not null references public.games (id) on delete cascade,
  block_key        text not null,
  card_id          uuid references public.cards (id),           -- null = a new card
  base_revision_id bigint references public.card_revisions (id), -- what it edits
  kind             text not null check (kind in ('fact', 'opinion', 'widget')),
  title            text not null check (char_length(title) between 3 and 120),
  content          jsonb not null,
  source           text,                -- where a fact can be checked
  origin           text not null default 'direct' check (origin in ('direct', 'chat', 'report')),
  status           text not null default 'open'
                   check (status in ('checking', 'open', 'approved', 'preview', 'stable', 'declined', 'removed')),
  size             text check (size in ('small', 'medium', 'large')),
  theory           boolean not null default false,  -- an unconfirmed finding, shown labeled
  author_id        uuid not null references public.profiles (id),
  decided_by       uuid references public.profiles (id),
  decided_at       timestamptz,
  decline_reason   text,
  created_at       timestamptz not null default now()
);
create index drafts_game_idx on public.drafts (game_id, block_key, status);

create table public.draft_credits (
  draft_id   uuid not null references public.drafts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('author', 'coauthor', 'seeder', 'spotter')),
  primary key (draft_id, profile_id)
);

-- One vote per person per Draft. For facts, +1 = "I can confirm", -1 = "seems wrong".
create table public.draft_votes (
  draft_id   uuid not null references public.drafts (id) on delete cascade,
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (draft_id, voter_id)
);

-- A view = the card was expanded or on screen for a moment. One row per viewer per day.
-- viewer_key is a profile id, or a hashed device id for signed-out visitors.
create table public.draft_views (
  draft_id   uuid not null references public.drafts (id) on delete cascade,
  viewer_key text not null,
  day        date not null default current_date,
  primary key (draft_id, viewer_key, day)
);

-- ---------------------------------------------------------------- chat and reports

create table public.chat_messages (
  id              bigint generated always as identity primary key,
  game_id         text references public.games (id) on delete cascade,  -- null = Town Hall
  author_id       uuid not null references public.profiles (id),
  body            text not null check (char_length(body) between 1 and 4000),
  block_key       text,            -- what it's about (set by the author or the AI tagger)
  linked_draft_id uuid references public.drafts (id) on delete set null,
  spoiler         boolean not null default false,
  removed_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index chat_game_idx on public.chat_messages (game_id, created_at desc);

-- "Was this right?" from the game app. Signed-out reports wait on the Notice Board.
create table public.reports (
  id          bigint generated always as identity primary key,
  game_id     text not null references public.games (id) on delete cascade,
  card_id     uuid not null references public.cards (id) on delete cascade,
  revision_id bigint references public.card_revisions (id),
  kind        text not null check (kind in ('confirm', 'not_quite')),
  body        text check (char_length(body) <= 1000),
  reporter_id uuid references public.profiles (id),
  device_key  text,               -- hashed, for signed-out reports and the thank-you note
  status      text not null default 'notice' check (status in ('notice', 'draft', 'dismissed', 'fixed')),
  draft_id    uuid references public.drafts (id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- Standouts

-- Lower bound of the Wilson score interval: "the lowest approval rate we can believe,
-- given how few people have seen it". Same maths as src/lib/standouts.ts.
create function public.wilson_lower(successes numeric, trials numeric, z numeric default 1.96)
returns numeric language sql immutable as $$
  select case when trials <= 0 then 0 else
    greatest(0,
      ((successes / trials) + z * z / (2 * trials)
        - z * sqrt(((successes / trials) * (1 - successes / trials) + z * z / (4 * trials)) / trials))
      / (1 + z * z / trials))
  end
$$;

create view public.draft_scores as
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
           from public.draft_views group by draft_id) w on w.draft_id = d.id;

-- ---------------------------------------------------------------- row-level security

create function public.is_moderator(g text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators m
                 where m.profile_id = auth.uid() and (m.game_id is null or m.game_id = g))
$$;

alter table public.profiles       enable row level security;
alter table public.moderators     enable row level security;
alter table public.games          enable row level security;
alter table public.game_blocks    enable row level security;
alter table public.cards          enable row level security;
alter table public.card_revisions enable row level security;
alter table public.card_pointers  enable row level security;
alter table public.pointer_events enable row level security;
alter table public.drafts         enable row level security;
alter table public.draft_credits  enable row level security;
alter table public.draft_votes    enable row level security;
alter table public.draft_views    enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.reports        enable row level security;

-- Public reads
create policy "read profiles"   on public.profiles       for select using (true);
create policy "read games"      on public.games          for select using (status <> 'draft' or public.is_moderator(id));
create policy "read blocks"     on public.game_blocks    for select using (true);
create policy "read cards"      on public.cards          for select using (true);
create policy "read revisions"  on public.card_revisions for select using (true);
create policy "read pointers"   on public.card_pointers  for select using (true);
create policy "read drafts"     on public.drafts         for select using (status <> 'removed' or public.is_moderator(game_id));
create policy "read credits"    on public.draft_credits  for select using (true);
create policy "read votes"      on public.draft_votes    for select using (true);
create policy "read chat"       on public.chat_messages  for select using (removed_at is null or public.is_moderator(game_id));
create policy "mods read events"  on public.pointer_events for select using (public.is_moderator((select game_id from public.cards c where c.id = card_id)));
create policy "mods read reports" on public.reports        for select using (public.is_moderator(game_id) or reporter_id = auth.uid());
create policy "read own mod rows" on public.moderators     for select using (profile_id = auth.uid());

-- Your own profile: only these columns, so nobody can make themselves Founder.
create policy "edit own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (username, display_name, hide_planted) on public.profiles to authenticated;

-- Villagers write their own things
create policy "post drafts"  on public.drafts        for insert with check (author_id = auth.uid() and status in ('checking', 'open'));
create policy "vote"         on public.draft_votes   for insert with check (voter_id = auth.uid() and voter_id <> (select author_id from public.drafts d where d.id = draft_id));
create policy "change vote"  on public.draft_votes   for update using (voter_id = auth.uid());
create policy "unvote"       on public.draft_votes   for delete using (voter_id = auth.uid());
create policy "chat"         on public.chat_messages for insert with check (author_id = auth.uid());
create policy "own credits"  on public.draft_credits for insert with check (profile_id = auth.uid());
-- Signed-out reports and views go through server routes that use the service key, so
-- these policies only cover signed-in villagers.
create policy "report"       on public.reports       for insert with check (reporter_id = auth.uid());
create policy "view"         on public.draft_views   for insert with check (viewer_key = auth.uid()::text);

-- Moderators run the pipeline
create policy "mods edit games"     on public.games          for all using (public.is_moderator(id))      with check (public.is_moderator(id));
create policy "mods edit blocks"    on public.game_blocks    for all using (public.is_moderator(game_id)) with check (public.is_moderator(game_id));
create policy "mods edit cards"     on public.cards          for all using (public.is_moderator(game_id)) with check (public.is_moderator(game_id));
create policy "mods add revisions"  on public.card_revisions for insert with check (public.is_moderator((select game_id from public.cards c where c.id = card_id)));
create policy "mods move pointers"  on public.card_pointers  for all using (public.is_moderator((select game_id from public.cards c where c.id = card_id)))
                                                               with check (public.is_moderator((select game_id from public.cards c where c.id = card_id)));
create policy "mods decide drafts"  on public.drafts         for update using (public.is_moderator(game_id));
create policy "mods moderate chat"  on public.chat_messages  for update using (public.is_moderator(game_id));
create policy "mods handle reports" on public.reports        for update using (public.is_moderator(game_id));
