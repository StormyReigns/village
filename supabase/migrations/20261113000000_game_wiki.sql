-- Village: wiki links (docs/blocks/wiki-links.md, first slice).
--   * games.wiki: the game's wiki, set by a moderator: { name, api, article, bracket }.
--     name    what players see on the link ("Fire Emblem Wiki")
--     api     the wiki's MediaWiki API address (https, ends in api.php); our server only ever
--             asks this address, never one sent from the browser
--     article the wiki's page address, with $1 where the page name goes (same site as api)
--     bracket optional: the word the wiki adds when a name is taken, "Theodora (Fortune's Weave)"
--   * Moderators can already edit their game's row ("mods edit games"); the check below keeps
--     the addresses safe whoever writes them.
--   * Fills in both games' wikis (only where none is set), so links show once this has run.
-- Safe to run twice.

alter table public.games add column if not exists wiki jsonb;

create or replace function public.game_wiki_ok(w jsonb) returns boolean
language sql immutable as $$
  select w is null or (
    jsonb_typeof(w) = 'object'
    and jsonb_typeof(w -> 'name') = 'string' and char_length(w ->> 'name') between 2 and 60
    -- https, a real host name (letters in the last part, so no bare numbers or localhost), api.php
    and coalesce((w ->> 'api') ~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(/[a-z0-9._~-]+)*/api\.php$', false)
    and coalesce((w ->> 'article') ~* '^https://([a-z0-9-]+\.)+[a-z]{2,}/[^[:space:]?#]*\$1$', false)
    and lower(substring(w ->> 'api' from '^https://([^/]+)')) = lower(substring(w ->> 'article' from '^https://([^/]+)'))
    and (w -> 'bracket' is null
      or (jsonb_typeof(w -> 'bracket') = 'string' and char_length(w ->> 'bracket') between 1 and 60
          and (w ->> 'bracket') !~ '[#<>\[\]|{}]'))
  )
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'games_wiki_ok') then
    alter table public.games add constraint games_wiki_ok check (public.game_wiki_ok(wiki));
  end if;
end $$;

update public.games set wiki = jsonb_build_object(
    'name', 'Fire Emblem Wiki',
    'api', 'https://fireemblemwiki.org/w/api.php',
    'article', 'https://fireemblemwiki.org/wiki/$1',
    'bracket', 'Fortune''s Weave')
  where id = 'fortunes-weave' and wiki is null;

update public.games set wiki = jsonb_build_object(
    'name', 'Zelda Wiki',
    'api', 'https://zeldawiki.wiki/w/api.php',
    'article', 'https://zeldawiki.wiki/wiki/$1',
    'bracket', 'Ocarina of Time')
  where id = 'ocarina-of-time' and wiki is null;
