-- The Planner (docs/blocks/planner.md), slice 3: sharing a party by its link. A player can make one
-- route's party readable to anyone with its link (and its share picture), or private again, like a
-- tier list. Shared plans show the maker's display name; plans hold no other words (a class step's
-- tier is checked against the class, 20261116000000_planner_builds.sql).
--
-- RUN AFTER 20261116000000_planner_builds.sql. Nothing else is needed. Safe to run twice.
--
--   party_plans.shared (off by default); anyone can read a shared row, its maker reads all of theirs.
--   share_party_plan(g, b, r, on_off): switches one of your own saved parties, returns its id.
--   Saving a party again keeps it shared or private as it was, so a shared link shows the latest plan.

alter table public.party_plans add column if not exists shared boolean not null default false;

drop policy if exists "read own party plans" on public.party_plans;
drop policy if exists "read own or shared party plans" on public.party_plans;
create policy "read own or shared party plans" on public.party_plans for select
  using (profile_id = auth.uid() or shared);

create or replace function public.share_party_plan(g text, b text, r text, on_off boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare plan_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to share your party.' using errcode = 'P0001'; end if;
  update public.party_plans set shared = coalesce(on_off, false)
  where game_id = g and block_key = b and route = coalesce(r, '') and profile_id = auth.uid()
  returning id into plan_id;
  if plan_id is null then raise exception 'Save your party first.' using errcode = 'P0001'; end if;
  return plan_id;
end $$;

revoke all on function public.share_party_plan(text, text, text, boolean) from public, anon;
grant execute on function public.share_party_plan(text, text, text, boolean) to authenticated;

-- Checks (the SQL Editor shows only this last result) ------------------------------------------
select
  exists (select 1 from information_schema.columns where table_schema = 'public'
     and table_name = 'party_plans' and column_name = 'shared')                           as shared_column,
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_plans'
     and policyname = 'read own or shared party plans')                                   as read_policy,
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_plans'
     and policyname = 'read own party plans')                                             as old_policy_gone,
  has_function_privilege('authenticated', 'public.share_party_plan(text, text, text, boolean)', 'execute')
    and not has_function_privilege('anon', 'public.share_party_plan(text, text, text, boolean)', 'execute') as share_signed_in_only,
  not has_table_privilege('authenticated', 'public.party_plans', 'update')                as still_no_direct_update;
