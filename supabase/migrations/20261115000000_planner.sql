-- The Planner (docs/blocks/planner.md), slice 1: a player's own party for their run, saved to their
-- account so a plan made on a computer shows on the phone by the TV. Everyone can plan on their
-- device; this is only for signed-in players. Plans are private: only their maker can read them.
--
-- RUN THIS, THEN supabase/seed-app.sql. The seed adds Fortune's Weave's Party Page (tint 'slate')
-- and its Planner Block (type 'planner', with plan_setup), which this allows. Run the seed first and
-- it stops at the Party Page with nothing changed; just run this, then the seed again.
--
--   * app_pages.tint may be 'slate' (the eighth Page color, for the Party Page).
--   * game_blocks.type may be 'planner'; game_blocks.plan_setup holds its setup.
--   * party_plans: one row per player, Planner Block and route. Written only by save_party_plan().
--   * party_plan_saves: a small log for the save rate limit, an hour deep. Nobody reads it.
--
-- Safe to run twice.

-- The Page color and the Block ------------------------------------------------------------------
alter table public.app_pages drop constraint if exists app_pages_tint_check;
alter table public.app_pages add constraint app_pages_tint_check
  check (tint in ('leaf', 'sky', 'berry', 'sun', 'plum', 'teal', 'indigo', 'slate'));

alter table public.game_blocks drop constraint if exists game_blocks_type_check;
alter table public.game_blocks add constraint game_blocks_type_check
  check (type in ('collection', 'guide', 'checklist', 'timeline', 'characters', 'items', 'tierlist', 'classes', 'planner'));

-- { "roster": "units", "size": 15, "title": "Your party" }
-- roster: the Characters Block a party is picked from (any Page of the game). size: the most units
-- a party holds, or missing for no limit. Later slices add class steps and gear slots.
alter table public.game_blocks add column if not exists plan_setup jsonb;

-- Plans ----------------------------------------------------------------------------------------
-- plan: { "party": [{ "card": "<uuid>" }, ...] } in the player's order. Rebuilt by
-- save_party_plan() from checked parts only, so nothing else can be stored in it.
create table if not exists public.party_plans (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null,
  block_key  text not null,                                             -- the Planner Block
  profile_id uuid not null references public.profiles (id) on delete cascade,
  route      text not null default '' check (route ~ '^[a-z0-9-]{0,24}$'), -- '' for a game without routes
  plan       jsonb not null default '{"party": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, block_key, profile_id, route),
  foreign key (game_id, block_key) references public.game_blocks (game_id, block_key) on delete cascade
);

alter table public.party_plans enable row level security;

drop policy if exists "read own party plans" on public.party_plans;
create policy "read own party plans" on public.party_plans for select using (profile_id = auth.uid());
-- Saving goes through save_party_plan(), which checks every unit.
revoke insert, update, delete on public.party_plans from anon, authenticated;
drop policy if exists "delete own party plans" on public.party_plans;
create policy "delete own party plans" on public.party_plans for delete using (profile_id = auth.uid());
grant delete on public.party_plans to authenticated;

-- Players never write rows directly, but if that's ever allowed, the date can't be made up
-- (20261111130000_created_at_now.sql).
drop trigger if exists a0_created_at_now on public.party_plans;
create trigger a0_created_at_now before insert or update on public.party_plans
  for each row execute function public.created_at_now();

create table if not exists public.party_plan_saves (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  saved_at   timestamptz not null default now()
);
create index if not exists party_plan_saves_idx on public.party_plan_saves (profile_id, saved_at);
alter table public.party_plan_saves enable row level security;
revoke all on public.party_plan_saves from anon, authenticated;

-- Saving: the whole plan for one route at once, replacing what was there.
-- p: { "party": [{ "card": "<uuid>" }, ...] }. Only units of the Planner's roster Block, each once,
-- no more than its size.
create or replace function public.save_party_plan(g text, b text, r text, p jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  setup jsonb;
  cap int;
  members jsonb;
  bad int;
  recent int;
  at timestamptz := now();
begin
  if me is null then raise exception 'Sign in to save your party.' using errcode = 'P0001'; end if;
  select plan_setup into setup from public.game_blocks where game_id = g and block_key = b and type = 'planner';
  if setup is null or coalesce(setup->>'roster', '') = '' then
    raise exception 'That planner isn''t in the app.' using errcode = 'P0001';
  end if;
  if coalesce(r, '') !~ '^[a-z0-9-]{0,24}$' then raise exception 'That route isn''t one of this game''s.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'party') is distinct from 'array' then
    raise exception 'That isn''t a party.' using errcode = 'P0001';
  end if;
  members := p->'party';
  -- Clamped before it becomes a whole number, so a huge or negative size can't break saving.
  cap := greatest(least(coalesce(case when jsonb_typeof(setup->'size') = 'number' then (setup->>'size')::numeric end, 100), 100), 0)::int;
  if jsonb_array_length(members) > cap then
    raise exception 'Your party is full: swap someone out.' using errcode = 'P0001';
  end if;
  -- Every member must be { "card": "<uuid>" } before anything reads it as an id.
  if exists (select 1 from jsonb_array_elements(members) m
             where jsonb_typeof(m) is distinct from 'object'
                or coalesce(m->>'card', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Someone in that party isn''t in this game.' using errcode = 'P0001';
  end if;
  select count(*) into bad
  from jsonb_array_elements(members) m
  left join public.cards c on c.id = (m->>'card')::uuid and c.game_id = g and c.block_key = setup->>'roster'
  where c.id is null;
  if bad > 0 then raise exception 'Someone in that party isn''t in this game.' using errcode = 'P0001'; end if;
  if (select count(distinct m->>'card') from jsonb_array_elements(members) m) <> jsonb_array_length(members) then
    raise exception 'Someone is in that party twice.' using errcode = 'P0001';
  end if;

  -- Saved as a player goes, so the limit is generous: about one save every 6 seconds for an hour.
  select count(*) into recent from public.party_plan_saves where profile_id = me and saved_at > at - interval '1 hour';
  if recent >= 600 then raise exception 'Slow down a little: your party will save in a while.' using errcode = 'P0001'; end if;
  delete from public.party_plan_saves where profile_id = me and saved_at < at - interval '1 hour';
  insert into public.party_plan_saves (profile_id, saved_at) values (me, at);

  -- Rebuilt from the checked ids only, lowercased, in the player's order.
  insert into public.party_plans (game_id, block_key, profile_id, route, plan, updated_at)
  values (g, b, me, coalesce(r, ''), jsonb_build_object('party', coalesce(
    (select jsonb_agg(jsonb_build_object('card', lower(m->>'card')) order by o) from jsonb_array_elements(members) with ordinality x(m, o)),
    '[]'::jsonb)), at)
  on conflict (game_id, block_key, profile_id, route)
  do update set plan = excluded.plan, updated_at = excluded.updated_at;
  return at;
end $$;

revoke all on function public.save_party_plan(text, text, text, jsonb) from public, anon;
grant execute on function public.save_party_plan(text, text, text, jsonb) to authenticated;

-- Checks (the SQL Editor shows only this last result) ------------------------------------------
select
  (select count(*) from pg_constraint where conname = 'app_pages_tint_check'
     and pg_get_constraintdef(oid) like '%slate%') = 1                                   as slate_allowed,
  (select count(*) from pg_constraint where conname = 'game_blocks_type_check'
     and pg_get_constraintdef(oid) like '%planner%') = 1                                 as planner_allowed,
  exists (select 1 from information_schema.columns where table_schema = 'public'
     and table_name = 'game_blocks' and column_name = 'plan_setup')                      as plan_setup_column,
  (select relrowsecurity from pg_class where oid = 'public.party_plans'::regclass)       as plans_rls_on,
  (select relrowsecurity from pg_class where oid = 'public.party_plan_saves'::regclass)  as saves_rls_on,
  not has_table_privilege('authenticated', 'public.party_plans', 'insert')
    and not has_table_privilege('authenticated', 'public.party_plans', 'update')         as plans_write_only_by_function,
  has_function_privilege('authenticated', 'public.save_party_plan(text, text, text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_party_plan(text, text, text, jsonb)', 'execute') as save_signed_in_only,
  exists (select 1 from pg_trigger where tgname = 'a0_created_at_now'
     and tgrelid = 'public.party_plans'::regclass)                                       as created_at_trigger;
