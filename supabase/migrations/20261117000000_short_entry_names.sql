-- Draft names can be short. Some characters' names are two letters (Mu, Io), and the old floor
-- of 3 stopped anyone sending a fix for them. A name still needs something besides spaces, and
-- stays at most 120 characters. (Batch names keep their own rule.) Safe to rerun.

alter table public.drafts drop constraint if exists drafts_title_check;
alter table public.drafts add constraint drafts_title_check check (char_length(btrim(title)) between 1 and 120);

-- What the rule is now (should say 1 and 120).
select pg_get_constraintdef(oid) as drafts_title_rule from pg_constraint where conname = 'drafts_title_check';
