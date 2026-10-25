-- Supabase's security check flagged public.draft_scores ("Security Definer View"): a view
-- runs with its creator's access by default, so it skipped the row rules on the tables it
-- reads. Now it runs with the access of whoever asks, like everything else.
--
-- The one thing it legitimately needs from a private table is how many people looked at
-- each Draft (who looked stays private). That comes from a small function that returns
-- only the counts, so the Standouts sort keeps working. Safe to run twice.

create or replace function public.draft_viewer_counts()
returns table (draft_id uuid, viewers bigint)
language sql stable security definer set search_path = public as $$
  select v.draft_id, count(distinct v.viewer_key) from public.draft_views v group by v.draft_id
$$;
revoke all on function public.draft_viewer_counts() from public;
grant execute on function public.draft_viewer_counts() to anon, authenticated;

create or replace view public.draft_scores with (security_invoker = true) as
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
left join public.draft_viewer_counts() w on w.draft_id = d.id
where d.status <> 'removed';
