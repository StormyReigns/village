-- Village: posts out to a game's Discord channel (docs/blocks/discord.md).
--   * discord_hooks: one Discord webhook link per game. The link is a secret (anyone holding it
--     can post in that channel), so nobody can read this table, moderators included; only the
--     functions below touch it, and moderators only ever see its last 4 characters.
--   * discord_outbox: lines waiting to be posted. A trigger queues one when a Draft is published.
--   * discord_flush(), run each minute by pg_cron, posts a game's lines in one message once
--     things go quiet (nothing new for 10 minutes, or an hour after the first), using pg_net.
--     The database sends the posts itself, so the link never leaves it.
--   * every post sends allowed_mentions { parse: [] } and breaks up "@", so it can't ping anyone.
-- Safe to run twice: running it again keeps one timer job (pg_cron replaces it by name).
-- Without pg_net and pg_cron (or before this runs) nothing is posted. To stop the timer:
--   select cron.unschedule('village-discord-flush');
-- A problem here never stops a Draft from publishing: the trigger gives up quietly.

-- The two Supabase extensions: web requests from the database, and a timer -------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end $$;

-- Where links in posts point. One place to change it when the site gets its own address.
create or replace function public.village_url() returns text
language sql immutable as $$ select 'https://village-tawny-beta.vercel.app' $$;

-- Text that goes into a post: one line, cut short, Discord's formatting characters escaped
-- (so a name can't fake a link or a heading) and "@" broken up so it can't mention anyone.
create or replace function public.discord_safe(t text, n int default 80) returns text
language sql immutable as $$
  select replace(
    regexp_replace(left(trim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), n),
                   '([\\*_~`|\[\]()<>#:-])', '\\\1', 'g'),
    '@', '@' || chr(8203))
$$;

-- The webhook, one per game (secret) ---------------------------------------------------
create table if not exists public.discord_hooks (
  game_id      text primary key references public.games (id) on delete cascade,
  url          text not null,
  last4        text not null,
  kinds        text[] not null default '{published}',
  status       text not null default 'ok' check (status in ('ok', 'broken')),
  last_error   text,
  last_sent_at timestamptz,
  set_by       uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);

-- Lines waiting to go out, and the posts sent (to read Discord's answers) -------------------
create table if not exists public.discord_outbox (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games (id) on delete cascade,
  kind       text not null check (kind in ('published', 'test')),
  line       text not null default '',
  ref_id     uuid,                       -- the Draft, so one is never queued twice
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create unique index if not exists discord_outbox_once on public.discord_outbox (kind, ref_id) where ref_id is not null;
create index if not exists discord_outbox_waiting on public.discord_outbox (game_id) where sent_at is null;

create table if not exists public.discord_sends (
  request_id bigint primary key,         -- pg_net's id for the request
  game_id    text not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  checked    boolean not null default false
);

-- Nobody reads or writes these directly: row-level security on with no rules, and no access.
alter table public.discord_hooks  enable row level security;
alter table public.discord_outbox enable row level security;
alter table public.discord_sends  enable row level security;
revoke all on public.discord_hooks, public.discord_outbox, public.discord_sends from public, anon, authenticated;

-- Moderators: connect, choose, test, remove, and see the status ----------------------------
create or replace function public.set_discord_hook(g text, link text) returns text
language plpgsql security definer set search_path = public as $$
declare m text[];
begin
  if auth.uid() is null or not public.is_moderator(g) then
    raise exception 'Only this game''s moderators can connect Discord.' using errcode = 'P0001';
  end if;
  m := regexp_match(trim(coalesce(link, '')),
    '^https://(?:discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)/api/(?:v[0-9]+/)?webhooks/([0-9]{17,20})/([A-Za-z0-9_-]{60,100})/?$', 'i');
  if m is null then
    raise exception 'That isn''t a Discord webhook link. It should start with https://discord.com/api/webhooks/' using errcode = 'P0001';
  end if;
  insert into public.discord_hooks (game_id, url, last4, set_by)
  values (g, 'https://discord.com/api/webhooks/' || m[1] || '/' || m[2], right(m[2], 4), auth.uid())
  on conflict (game_id) do update
    set url = excluded.url, last4 = excluded.last4, status = 'ok', last_error = null,
        set_by = excluded.set_by, updated_at = now();
  return right(m[2], 4);
end $$;

create or replace function public.set_discord_kinds(g text, k text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_moderator(g) then
    raise exception 'Only this game''s moderators can change Discord posts.' using errcode = 'P0001';
  end if;
  if not (coalesce(k, '{}') <@ array['published']) then
    raise exception 'Unknown kind of post.' using errcode = 'P0001';
  end if;
  update public.discord_hooks set kinds = coalesce(k, '{}'), updated_at = now() where game_id = g;
  if not found then raise exception 'Connect a Discord channel first.' using errcode = 'P0001'; end if;
  -- Lines of a kind no longer posted won't go out.
  delete from public.discord_outbox o where o.game_id = g and o.sent_at is null and o.kind <> 'test' and not (o.kind = any(coalesce(k, '{}')));
end $$;

create or replace function public.remove_discord_hook(g text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_moderator(g) then
    raise exception 'Only this game''s moderators can disconnect Discord.' using errcode = 'P0001';
  end if;
  delete from public.discord_hooks where game_id = g;
  delete from public.discord_outbox where game_id = g and sent_at is null;
end $$;

create or replace function public.discord_send_test(g text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_moderator(g) then
    raise exception 'Only this game''s moderators can send a test.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.discord_hooks where game_id = g) then
    raise exception 'Connect a Discord channel first.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.discord_outbox where game_id = g and kind = 'test' and created_at > now() - interval '1 minute') then
    raise exception 'A test is on its way. One a minute at most.' using errcode = 'P0001';
  end if;
  insert into public.discord_outbox (game_id, kind) values (g, 'test');
end $$;

-- Never the link: its last 4 characters, the settings and whether it works. Moderators only.
create or replace function public.discord_hook_status(g text)
returns table (last4 text, kinds text[], status text, last_error text, last_sent_at timestamptz, updated_at timestamptz, waiting int)
language sql stable security definer set search_path = public as $$
  select h.last4, h.kinds, h.status, h.last_error, h.last_sent_at, h.updated_at,
         (select count(*)::int from public.discord_outbox o where o.game_id = h.game_id and o.sent_at is null and o.kind <> 'test')
  from public.discord_hooks h
  where h.game_id = g and auth.uid() is not null and public.is_moderator(g)
$$;

-- A published Draft queues one line --------------------------------------------------------
create or replace function public.discord_queue_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  b    record;
  slug text;
  who  text;
  href text;
  line text;
begin
  if new.status <> 'stable' or old.status = 'stable' or new.card_id is null then return new; end if;
  if not exists (select 1 from public.discord_hooks h where h.game_id = new.game_id and h.status = 'ok' and 'published' = any(h.kinds)) then
    return new;
  end if;
  select gb.page_key, gb.type, p.title as page_title into b
  from public.game_blocks gb left join public.app_pages p on p.game_id = gb.game_id and p.page_key = gb.page_key
  where gb.game_id = new.game_id and gb.block_key = new.block_key;
  select c.slug into slug from public.cards c where c.id = new.card_id;
  select coalesce(nullif(pr.display_name, ''), pr.username) into who from public.profiles pr where pr.id = new.author_id;

  -- The same addresses the app uses (answerHref in src/lib/questions.ts).
  href := public.village_url() || '/g/' || new.game_id;
  if b.page_key is not null then
    href := href || '/' || b.page_key ||
      case when b.type in ('guide', 'timeline') then '#' || new.block_key || '-' || slug
           else '?e=' || new.block_key || '.' || slug end;
  end if;

  if new.content ->> 'spoiler' = 'true' then
    line := '[A spoiler](' || href || ')';
  else
    line := '[' || public.discord_safe(coalesce(nullif(new.content ->> 'name', ''), new.title)) || '](' || href || ')';
  end if;
  if b.page_title is not null then line := line || ' · ' || public.discord_safe(b.page_title, 40); end if;
  line := line || case when old.card_id is null then ' (new)' else ' (updated)' end;
  line := '• ' || line || ' · found by ' || public.discord_safe(coalesce(who, 'a villager'), 40);

  insert into public.discord_outbox (game_id, kind, line, ref_id)
  values (new.game_id, 'published', line, new.id)
  on conflict do nothing;
  return new;
-- This runs inside publishing: whatever goes wrong here, the Draft still ships.
exception when others then
  raise warning 'Discord line not queued for Draft %: %', new.id, sqlerrm;
  return new;
end $$;

drop trigger if exists drafts_discord on public.drafts;
create trigger drafts_discord after update of status on public.drafts
  for each row execute function public.discord_queue_published();

-- Every minute: read Discord's answers, then post what's ready -------------------------------
create or replace function public.discord_flush() returns int
language plpgsql security definer set search_path = public as $$
declare
  h      record;
  r      record;
  title  text;
  home   text;
  lines  text[];
  total  int;
  body   jsonb;
  rid    bigint;
  posted int := 0;
  base   jsonb := jsonb_build_object(
    'username', 'Village',
    'avatar_url', public.village_url() || '/village/logo.png',
    'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb));
begin
  if to_regproc('net.http_post') is null then return 0; end if;

  -- 1. What Discord said about earlier posts (pg_net keeps answers for a few hours).
  for r in execute $q$
    select s.request_id, s.game_id, s.created_at, x.status_code, x.error_msg, x.timed_out
    from public.discord_sends s join net._http_response x on x.id = s.request_id
    where not s.checked order by s.request_id $q$
  loop
    -- An answer about a link that's since been replaced says nothing about the new one.
    update public.discord_hooks k set
      status       = case when r.status_code in (401, 403, 404) then 'broken' else k.status end,
      last_error   = case when r.status_code between 200 and 299 then (case when k.status = 'broken' then k.last_error end)
                          when r.status_code in (401, 403, 404) then 'Discord no longer accepts this link. Paste a new one.'
                          when r.status_code is not null then 'Discord answered ' || r.status_code || '. The next post will try again.'
                          else 'Discord didn''t answer. The next post will try again.' end,
      last_sent_at = case when r.status_code between 200 and 299 then r.created_at else k.last_sent_at end
    where k.game_id = r.game_id and k.updated_at <= r.created_at;
    update public.discord_sends set checked = true where request_id = r.request_id;
  end loop;
  delete from public.discord_sends where created_at < now() - interval '1 day';
  delete from public.discord_outbox where sent_at < now() - interval '30 days';

  -- 2. Each connected game whose lines are ready: a test right away, the rest once it's quiet.
  for h in
    select k.* from public.discord_hooks k
    where k.status = 'ok' and exists (
      select 1 from public.discord_outbox o where o.game_id = k.game_id and o.sent_at is null
      group by o.game_id
      having bool_or(o.kind = 'test')
          or max(o.created_at) < now() - interval '10 minutes'
          or min(o.created_at) < now() - interval '1 hour')
  loop
    select g.title into title from public.games g where g.id = h.game_id;
    home := public.village_url() || '/g/' || h.game_id;

    if exists (select 1 from public.discord_outbox where game_id = h.game_id and sent_at is null and kind = 'test') then
      body := base || jsonb_build_object('embeds', jsonb_build_array(jsonb_build_object(
        'title', 'Village is connected',
        'url', home,
        'description', 'Updates from the ' || public.discord_safe(title, 100) || ' app will show up here.',
        'color', 16762173,
        'footer', jsonb_build_object('text', 'Built by players · Village'))));
      execute 'select net.http_post(url := $1, body := $2, headers := $3)' into rid
        using h.url, body, '{"Content-Type": "application/json"}'::jsonb;
      insert into public.discord_sends (request_id, game_id) values (rid, h.game_id) on conflict do nothing;
      update public.discord_outbox set sent_at = now() where game_id = h.game_id and sent_at is null and kind = 'test';
      posted := posted + 1;
    end if;

    -- Tests go straight out; the rest wait until the game's queue is quiet.
    continue when not exists (
      select 1 from public.discord_outbox o where o.game_id = h.game_id and o.sent_at is null and o.kind = 'published'
      group by o.game_id
      having max(o.created_at) < now() - interval '10 minutes' or min(o.created_at) < now() - interval '1 hour');

    select array_agg(line order by id), count(*)::int into lines, total
    from (select id, line from public.discord_outbox
          where game_id = h.game_id and sent_at is null and kind = 'published' and kind = any(h.kinds)
          order by id) x;
    -- Only the first 10 are listed; the rest are counted.
    if total > 0 then
      body := base || jsonb_build_object('embeds', jsonb_build_array(jsonb_build_object(
        'title', left('New in the ' || title || ' app', 256),
        'url', home,
        'description', array_to_string(lines[1:10], E'\n') ||
                       case when total > 10 then E'\n[and ' || (total - 10) || ' more](' || home || ')' else '' end,
        'color', 16762173,
        'footer', jsonb_build_object('text', 'Built by players · Village'))));
      execute 'select net.http_post(url := $1, body := $2, headers := $3)' into rid
        using h.url, body, '{"Content-Type": "application/json"}'::jsonb;
      insert into public.discord_sends (request_id, game_id) values (rid, h.game_id) on conflict do nothing;
      posted := posted + 1;
    end if;
    update public.discord_outbox set sent_at = now() where game_id = h.game_id and sent_at is null and kind = 'published';
  end loop;
  return posted;
end $$;

-- Only the timer runs the sender and the trigger; players and moderators can't.
revoke execute on function public.discord_flush() from public, anon, authenticated;
revoke execute on function public.discord_queue_published() from public, anon, authenticated;

-- The timer: every minute -------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $c$ select cron.schedule('village-discord-flush', '* * * * *', 'select public.discord_flush()') $c$;
  end if;
end $$;
