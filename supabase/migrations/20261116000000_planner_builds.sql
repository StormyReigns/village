-- The Planner (docs/blocks/planner.md), slice 2: each party member's build, saved with the party.
-- A member can now carry class steps (one class per tier of the game's Classes Block, each with
-- "done") and gear (items in the slots the builders set, like "Weapons and magic", up to each
-- slot's count). Still private: only the player reads their plans. No player text is stored.
--
-- RUN AFTER 20261115000000_planner.sql. Nothing else is needed: the update near the end gives
-- Fortune's Weave's Party planner its class steps and weapon slots (seed-app.sql never replaces a
-- planner's saved setup, so it can't do this itself). Running seed-app.sql before or after is harmless.
--
--   plan_setup gains: "classes": "<Classes Block key>",
--                     "slots": [{ "key": "weapons", "label": "Weapons and magic", "from": "<Items Block key>", "count": 3 }]
--   party_plans.plan members gain: "classes": [{ "band": "Beginner", "card": "<uuid>", "done": true }]
--                                   "gear": [{ "slot": "weapons", "cards": ["<uuid>", ...] }]
--
-- Safe to run twice.

create or replace function public.save_party_plan(g text, b text, r text, p jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  setup jsonb;
  cap int;
  members jsonb;
  m jsonb;
  bad int;
  recent int;
  built jsonb := '[]'::jsonb;
  steps jsonb;
  gear jsonb;
  at timestamptz := now();
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
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
  if exists (select 1 from jsonb_array_elements(members) x
             where jsonb_typeof(x) is distinct from 'object' or coalesce(x->>'card', '') !~* uuid_re) then
    raise exception 'Someone in that party isn''t in this game.' using errcode = 'P0001';
  end if;
  select count(*) into bad
  from jsonb_array_elements(members) x
  left join public.cards c on c.id = (x->>'card')::uuid and c.game_id = g and c.block_key = setup->>'roster'
  where c.id is null;
  if bad > 0 then raise exception 'Someone in that party isn''t in this game.' using errcode = 'P0001'; end if;
  if (select count(distinct x->>'card') from jsonb_array_elements(members) x) <> jsonb_array_length(members) then
    raise exception 'Someone is in that party twice.' using errcode = 'P0001';
  end if;

  -- Each member's build, checked piece by piece and rebuilt, in party order.
  for m in select x from jsonb_array_elements(members) with ordinality t(x, o) order by o loop
    steps := '[]'::jsonb;
    gear := '[]'::jsonb;

    -- Class steps: only when the planner names a Classes Block; at most 12, one per tier, each a
    -- class of that Block.
    if m ? 'classes' and m->'classes' <> 'null'::jsonb then
      if jsonb_typeof(m->'classes') is distinct from 'array' or jsonb_array_length(m->'classes') > 12
         or coalesce(setup->>'classes', '') = '' then
        raise exception 'That class plan doesn''t fit this planner.' using errcode = 'P0001';
      end if;
      if exists (select 1 from jsonb_array_elements(m->'classes') s
                 where jsonb_typeof(s) is distinct from 'object'
                    or coalesce(s->>'card', '') !~* uuid_re
                    or char_length(coalesce(s->>'band', '')) not between 1 and 40
                    or (s ? 'done' and jsonb_typeof(s->'done') is distinct from 'boolean')) then
        raise exception 'That class plan doesn''t fit this planner.' using errcode = 'P0001';
      end if;
      if exists (select 1 from jsonb_array_elements(m->'classes') s
                 left join public.cards c on c.id = (s->>'card')::uuid and c.game_id = g and c.block_key = setup->>'classes'
                 where c.id is null) then
        raise exception 'That class plan doesn''t fit this planner.' using errcode = 'P0001';
      end if;
      if (select count(distinct s->>'band') from jsonb_array_elements(m->'classes') s) <> jsonb_array_length(m->'classes') then
        raise exception 'Only one class per tier.' using errcode = 'P0001';
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('band', s->>'band', 'card', lower(s->>'card'), 'done', coalesce((s->>'done')::boolean, false)) order by o), '[]'::jsonb)
        into steps from jsonb_array_elements(m->'classes') with ordinality t(s, o);
    end if;

    -- Gear: only the planner's own slots, each once, items of that slot's Block, no more than its
    -- count (10 at most).
    if m ? 'gear' and m->'gear' <> 'null'::jsonb then
      if jsonb_typeof(m->'gear') is distinct from 'array' or jsonb_array_length(m->'gear') > 12 then
        raise exception 'That gear doesn''t fit this planner.' using errcode = 'P0001';
      end if;
      if exists (
        select 1 from jsonb_array_elements(m->'gear') s
        left join lateral (
          select sl from jsonb_array_elements(case when jsonb_typeof(setup->'slots') = 'array' then setup->'slots' else '[]'::jsonb end) sl
          where sl->>'key' = s->>'slot' limit 1
        ) slot on true
        where jsonb_typeof(s) is distinct from 'object'
           or slot.sl is null
           or jsonb_typeof(s->'cards') is distinct from 'array'
           or jsonb_array_length(s->'cards') > greatest(least(coalesce(case when jsonb_typeof(slot.sl->'count') = 'number' then (slot.sl->>'count')::numeric end, 1), 10), 0)
           or exists (select 1 from jsonb_array_elements(s->'cards') k
                      where jsonb_typeof(k) is distinct from 'string' or k #>> '{}' !~* uuid_re)
           or exists (select 1 from jsonb_array_elements_text(s->'cards') k
                      left join public.cards c on c.id = k::uuid and c.game_id = g and c.block_key = slot.sl->>'from'
                      where c.id is null)
           or (select count(distinct k) from jsonb_array_elements_text(s->'cards') k) <> jsonb_array_length(s->'cards')
      ) then
        raise exception 'That gear doesn''t fit this planner.' using errcode = 'P0001';
      end if;
      if (select count(distinct s->>'slot') from jsonb_array_elements(m->'gear') s) <> jsonb_array_length(m->'gear') then
        raise exception 'That gear doesn''t fit this planner.' using errcode = 'P0001';
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('slot', s->>'slot', 'cards',
               (select coalesce(jsonb_agg(lower(k) order by ko), '[]'::jsonb) from jsonb_array_elements_text(s->'cards') with ordinality u(k, ko))) order by o), '[]'::jsonb)
        into gear from jsonb_array_elements(m->'gear') with ordinality t(s, o);
    end if;

    built := built || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'card', lower(m->>'card'),
      'classes', case when jsonb_array_length(steps) > 0 then steps end,
      'gear', case when jsonb_array_length(gear) > 0 then gear end)));
  end loop;

  -- Saved as a player goes, so the limit is generous: about one save every 6 seconds for an hour.
  select count(*) into recent from public.party_plan_saves where profile_id = me and saved_at > at - interval '1 hour';
  if recent >= 600 then raise exception 'Slow down a little: your party will save in a while.' using errcode = 'P0001'; end if;
  delete from public.party_plan_saves where profile_id = me and saved_at < at - interval '1 hour';
  insert into public.party_plan_saves (profile_id, saved_at) values (me, at);

  insert into public.party_plans (game_id, block_key, profile_id, route, plan, updated_at)
  values (g, b, me, coalesce(r, ''), jsonb_build_object('party', built), at)
  on conflict (game_id, block_key, profile_id, route)
  do update set plan = excluded.plan, updated_at = excluded.updated_at;
  return at;
end $$;

revoke all on function public.save_party_plan(text, text, text, jsonb) from public, anon;
grant execute on function public.save_party_plan(text, text, text, jsonb) to authenticated;

-- Fortune's Weave's Party planner gets its class steps and weapon slots, only while its setup is
-- still exactly slice 1's starter (a builder's own setup is left alone).
update public.game_blocks
set plan_setup = '{"roster":"units","size":15,"unlock":["Recruit","@description"],"classes":"classes","slots":[{"key":"weapons","label":"Weapons and magic","from":"weapons-and-magic","count":3}]}'::jsonb
where game_id = 'fortunes-weave' and block_key = 'your-party'
  and plan_setup = '{"roster":"units","size":15,"unlock":["Recruit","@description"]}'::jsonb;

-- Checks (the SQL Editor shows only this last result) ------------------------------------------
select
  has_function_privilege('authenticated', 'public.save_party_plan(text, text, text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_party_plan(text, text, text, jsonb)', 'execute') as save_signed_in_only,
  (select prosecdef from pg_proc where oid = 'public.save_party_plan(text, text, text, jsonb)'::regprocedure) as runs_as_owner,
  (select plan_setup->>'classes' from public.game_blocks where game_id = 'fortunes-weave' and block_key = 'your-party') as party_classes_block,
  (select plan_setup->'slots'->0->>'from' from public.game_blocks where game_id = 'fortunes-weave' and block_key = 'your-party') as party_weapons_block;
