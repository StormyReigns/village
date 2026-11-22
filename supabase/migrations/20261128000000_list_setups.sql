-- Setups as Drafts for Checklists and Timelines (Matt, 2026-11-21; docs/blocks/checklist.md, timeline.md).
-- Checklists and Timelines now have a Set up: fields a Builder adds to their rows and cards (Where, Reward,
-- Boss, You get...). 20261127000000 let setup Drafts change the fields of Characters, Items, Classes and
-- Guides only; this lets them change a Checklist's or Timeline's too. Moderators could already save these
-- directly (game_blocks.fields), so nothing else changes.
--
-- Run order: after 20261127000000_setup_drafts.sql (run 2026-11-21). Safe to run twice. It replaces
-- ship_setup with the same function, one line different (the list of Block types). If 20261127000000 is
-- ever run again after this one, run this one again too (otherwise a Checklist or Timeline setup Draft
-- is refused with "That Block isn't set up by fields."; nothing else breaks).

create or replace function public.ship_setup(d public.drafts) returns void
language plpgsql security definer set search_path = public as $$
declare
  s        jsonb := coalesce(d.content -> 'setup', '{}'::jsonb);
  bef      jsonb := coalesce(d.content -> 'before', '{}'::jsonb);
  gb       public.game_blocks;
  f        jsonb;
  ch       jsonb;
  st       jsonb;
  seen     text[] := '{}';
  k        text;
  p        jsonb;
  plan     jsonb;
  slots    jsonb := '[]'::jsonb;
  slot     jsonb;
  vals     jsonb;
  unlock   jsonb;
  size     int;
  cnt      int;
  m        jsonb;
  pic      text;
  credit   text;
  w        int;
  h        int;
  uuid_re  text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  select * into gb from public.game_blocks where game_id = d.game_id and block_key = d.block_key for update;
  if gb.block_key is null then raise exception 'The Block this setup was for isn''t in the app any more.'; end if;
  if octet_length(d.content::text) > 200000 then raise exception 'That setup is too big to send.'; end if;
  if not (s ? 'fields' or s ? 'plan' or s ? 'map') then raise exception 'This Draft has no setup in it.'; end if;

  -- A Block's fields (Set up), and its stats.
  if s ? 'fields' then
    if gb.type not in ('characters', 'items', 'classes', 'guide', 'checklist', 'timeline') then raise exception 'That Block isn''t set up by fields.'; end if;
    if coalesce(bef -> 'fields', 'null'::jsonb) is distinct from coalesce(gb.fields, 'null'::jsonb)
       or coalesce(bef -> 'stats', 'null'::jsonb) is distinct from coalesce(gb.stats, 'null'::jsonb) then
      raise exception 'The setup of % changed since this was sent. Open Set up and send it again.', gb.title;
    end if;
    if jsonb_typeof(s -> 'fields') <> 'array' or jsonb_array_length(s -> 'fields') > 60 then
      raise exception 'A Block has 60 fields at most.';
    end if;
    for f in select * from jsonb_array_elements(s -> 'fields') loop
      if jsonb_typeof(f) <> 'object' or jsonb_typeof(f -> 'key') <> 'string' or jsonb_typeof(f -> 'label') <> 'string' then
        raise exception 'Every field needs a name.';
      end if;
      k := lower(f ->> 'key');
      if char_length(f ->> 'key') not between 1 and 120 or char_length(btrim(f ->> 'label')) not between 1 and 60 then
        raise exception 'Every field needs a name of 60 characters or fewer.';
      end if;
      if k = any(seen) then raise exception 'Two fields have the same name: %.', f ->> 'label'; end if;
      seen := seen || k;
      if coalesce(f ->> 'kind', '') not in ('text', 'number', 'tag', 'place', 'when', 'chart', 'list', 'links', 'longtext',
                                           'yesno', 'playable', 'steps', 'writeup', 'tier') then
        raise exception 'The field % has a kind we don''t know.', f ->> 'label';
      end if;
      if nullif(f ->> 'to', '') is not null and not exists (select 1 from public.game_blocks where game_id = d.game_id and block_key = f ->> 'to') then
        raise exception 'The field % links to a Block that isn''t in this game.', f ->> 'label';
      end if;
      if f ? 'choices' then
        if jsonb_typeof(f -> 'choices') <> 'array' or jsonb_array_length(f -> 'choices') > 60 then
          raise exception 'A list of choices has 60 at most.';
        end if;
        for ch in select * from jsonb_array_elements(f -> 'choices') loop
          if jsonb_typeof(ch -> 'name') <> 'string' or char_length(ch ->> 'name') not between 1 and 60 or char_length(coalesce(ch ->> 'about', '')) > 600 then
            raise exception 'Each choice for % needs a name of 60 characters or fewer.', f ->> 'label';
          end if;
        end loop;
      end if;
      if f ? 'stats' and (jsonb_typeof(f -> 'stats') <> 'array' or jsonb_array_length(f -> 'stats') > 30) then
        raise exception 'A chart has 30 stats at most.';
      end if;
      if f ? 'options' and (jsonb_typeof(f -> 'options') <> 'array' or jsonb_array_length(f -> 'options') <> 2
                            or char_length(f -> 'options' ->> 0) > 40 or char_length(f -> 'options' ->> 1) > 40) then
        raise exception 'A yes-or-no field has two choices of 40 characters or fewer.';
      end if;
    end loop;
    st := case when jsonb_typeof(s -> 'stats') = 'array' then s -> 'stats' else null end;
    if st is not null and jsonb_array_length(st) > 30 then raise exception 'A chart has 30 stats at most.'; end if;
    -- Every stat, on the Block or a chart: a key and a name, and which way is better.
    for ch in select x from jsonb_array_elements(coalesce(st, '[]'::jsonb)) x
              union all select x from jsonb_array_elements(s -> 'fields') f2, jsonb_array_elements(case when jsonb_typeof(f2 -> 'stats') = 'array' then f2 -> 'stats' else '[]'::jsonb end) x loop
      if jsonb_typeof(ch -> 'key') <> 'string' or jsonb_typeof(ch -> 'label') <> 'string'
         or char_length(ch ->> 'key') not between 1 and 120 or char_length(ch ->> 'label') not between 1 and 40
         or coalesce(ch ->> 'better', '') not in ('high', 'low') then
        raise exception 'Every stat needs a name of 40 characters or fewer.';
      end if;
    end loop;
    update public.game_blocks
    set fields = s -> 'fields', stats = case when st is null or jsonb_array_length(st) = 0 then null else st end
    where game_id = d.game_id and block_key = d.block_key;
  end if;

  -- A Planner's setup: rebuilt from what's checked, never copied.
  if s ? 'plan' then
    if gb.type <> 'planner' then raise exception 'That Block isn''t a Planner.'; end if;
    if coalesce(bef -> 'plan', 'null'::jsonb) is distinct from coalesce(gb.plan_setup, 'null'::jsonb) then
      raise exception 'The setup of % changed since this was sent. Open Set up and send it again.', gb.title;
    end if;
    p := s -> 'plan';
    if jsonb_typeof(p) <> 'object' or not exists (select 1 from public.game_blocks where game_id = d.game_id and block_key = p ->> 'roster' and type = 'characters') then
      raise exception 'A Planner picks its party from a Characters Block in this game.';
    end if;
    plan := jsonb_build_object('roster', p ->> 'roster');
    if jsonb_typeof(p -> 'size') = 'number' then
      -- Clamped before it becomes a whole number, so a huge one can't overflow.
      size := least(100, greatest(1, round((p ->> 'size')::numeric)))::int;
      plan := plan || jsonb_build_object('size', size);
    end if;
    if jsonb_typeof(p -> 'unlock') = 'array' then
      -- In the order given, without repeats.
      select coalesce(jsonb_agg(x order by i), '[]'::jsonb) into unlock
      from (select x, min(i) as i from jsonb_array_elements_text(p -> 'unlock') with ordinality t(x, i)
            where i <= 12 and char_length(x) between 1 and 120 group by x) v;
      if jsonb_array_length(unlock) > 0 then plan := plan || jsonb_build_object('unlock', unlock); end if;
    end if;
    if nullif(p ->> 'classes', '') is not null then
      if not exists (select 1 from public.game_blocks where game_id = d.game_id and block_key = p ->> 'classes' and type = 'classes') then
        raise exception 'The class steps come from a Classes Block in this game.';
      end if;
      plan := plan || jsonb_build_object('classes', p ->> 'classes');
    end if;
    if jsonb_typeof(p -> 'slots') = 'array' then
      if jsonb_array_length(p -> 'slots') > 12 then raise exception 'A Planner has 12 gear slots at most.'; end if;
      for slot in select * from jsonb_array_elements(p -> 'slots') loop
        if coalesce(slot ->> 'key', '') !~ '^[a-z0-9-]{1,30}$' or char_length(btrim(coalesce(slot ->> 'label', ''))) not between 1 and 40 then
          raise exception 'Every gear slot needs a name of 40 characters or fewer.';
        end if;
        if not exists (select 1 from public.game_blocks where game_id = d.game_id and block_key = slot ->> 'from' and type = 'items') then
          raise exception 'The gear slot % picks from an Items Block in this game.', btrim(slot ->> 'label');
        end if;
        cnt := case when jsonb_typeof(slot -> 'count') = 'number' then least(10, greatest(1, round((slot ->> 'count')::numeric)))::int else 1 end;
        vals := null;
        if jsonb_typeof(slot -> 'tag') = 'object' and jsonb_typeof(slot -> 'tag' -> 'values') = 'array'
           and char_length(coalesce(slot -> 'tag' ->> 'key', '')) between 1 and 120 then
          select coalesce(jsonb_agg(x order by i), '[]'::jsonb) into vals
          from (select x, min(i) as i from jsonb_array_elements_text(slot -> 'tag' -> 'values') with ordinality t(x, i)
                where i <= 40 and char_length(x) between 1 and 60 group by x) v;
        end if;
        slots := slots || jsonb_build_array(jsonb_build_object('key', slot ->> 'key', 'label', btrim(slot ->> 'label'), 'from', slot ->> 'from', 'count', cnt)
          || case when vals is not null and jsonb_array_length(vals) > 0 then jsonb_build_object('tag', jsonb_build_object('key', slot -> 'tag' ->> 'key', 'values', vals)) else '{}'::jsonb end);
      end loop;
      if jsonb_array_length(slots) > 0 then plan := plan || jsonb_build_object('slots', slots); end if;
    end if;
    update public.game_blocks set plan_setup = plan where game_id = d.game_id and block_key = d.block_key;
  end if;

  -- A map picture: one of our uploads for this game, by the author or a moderator.
  if s ? 'map' then
    if gb.type <> 'collection' or coalesce(gb.look, '') <> 'map' then raise exception 'That Block has no map.'; end if;
    if coalesce(bef -> 'map', 'null'::jsonb) is distinct from coalesce(gb.map, 'null'::jsonb) then
      raise exception 'The map of % changed since this was sent. Open Map and send it again.', gb.title;
    end if;
    m := s -> 'map';
    pic := m ->> 'picture';
    if jsonb_typeof(m) <> 'object' or pic is null
       or pic !~ ('^' || regexp_replace(d.game_id, '([^a-z0-9-])', '', 'g') || '/' || uuid_re || '/' || uuid_re || '\.(webp|jpg|gif|png)$')
       or split_part(pic, '/', 1) <> d.game_id then
      raise exception 'That map picture isn''t one of ours.';
    end if;
    if split_part(pic, '/', 2) <> d.author_id::text and not exists (select 1 from public.moderators where game_id = d.game_id and profile_id::text = split_part(pic, '/', 2)) then
      raise exception 'That map picture was uploaded by someone else.';
    end if;
    if jsonb_typeof(m -> 'w') <> 'number' or jsonb_typeof(m -> 'h') <> 'number' then raise exception 'The map picture needs its size.'; end if;
    w := least(20000, greatest(1, round((m ->> 'w')::numeric)))::int;
    h := least(20000, greatest(1, round((m ->> 'h')::numeric)))::int;
    credit := left(btrim(regexp_replace(coalesce(m ->> 'credit', ''), '\s+', ' ', 'g')), 80);
    update public.game_blocks
    set map = jsonb_build_object('picture', pic, 'w', w, 'h', h) || case when credit <> '' then jsonb_build_object('credit', credit) else '{}'::jsonb end
    where game_id = d.game_id and block_key = d.block_key;
  end if;

  update public.drafts
  set status = 'stable', decided_by = auth.uid(), decided_at = now(), decline_reason = null
  where id = d.id;
end $$;

revoke all on function public.ship_setup(public.drafts) from public, anon, authenticated;

-- What to read: setup Drafts now take Checklists and Timelines, and publishing still calls ship_setup.
select
  (select pg_get_functiondef('public.ship_setup(public.drafts)'::regprocedure) like '%''checklist'', ''timeline''%') as lists_take_setups,
  (select pg_get_functiondef('public.ship_draft(uuid)'::regprocedure) like '%ship_setup%') as publishing_writes_setups;
