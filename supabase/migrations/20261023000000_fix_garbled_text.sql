-- Fix dashes and quotes that were stored garbled: "9/2â€“9/8" instead of "9/2–9/8".
-- The text was read with the wrong character set on its way into the database, so each
-- of these characters became two or three odd ones. (The files in src/data are fine.)
--
-- History stays intact: each affected entry gets a corrected new version and its pointer
-- moves to it, the same way publishing a Draft works. Safe to run twice; the second run
-- finds nothing to fix.

create or replace function pg_temp.unmangle(t text) returns text language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(t,
    chr(226) || chr(8364) || chr(8220), chr(8211)),  -- – en dash
    chr(226) || chr(8364) || chr(8221), chr(8212)),  -- — em dash
    chr(226) || chr(8364) || chr(8482), chr(8217)),  -- ’
    chr(226) || chr(8364) || chr(732),  chr(8216)),  -- ‘
    chr(226) || chr(8364) || chr(339),  chr(8220)),  -- “
    chr(226) || chr(8364) || chr(157),  chr(8221)),  -- ”
    chr(226) || chr(8364) || chr(166),  chr(8230)),  -- …
    chr(206) || chr(184),               chr(952))    -- θ
$$;

do $$
declare
  r record;
  fixed_id bigint;
begin
  for r in
    select distinct rv.id, rv.card_id, rv.content, rv.game_version
    from public.card_pointers p
    join public.card_revisions rv on rv.id = p.revision_id
    where rv.content::text <> pg_temp.unmangle(rv.content::text)
  loop
    insert into public.card_revisions (card_id, content, game_version, summary)
    values (r.card_id, pg_temp.unmangle(r.content::text)::jsonb, r.game_version, 'Fix garbled dashes and quotes')
    returning id into fixed_id;
    update public.card_pointers set revision_id = fixed_id, updated_at = now() where revision_id = r.id;
  end loop;
end $$;

-- What's left to fix (should be 0).
select count(*) as still_garbled
from public.card_pointers p
join public.card_revisions rv on rv.id = p.revision_id
where rv.content::text <> pg_temp.unmangle(rv.content::text);
