# Wiki links (an integration)

**Status:** Live (2026-11-10): checked links on cards, and a fix per entry · **Chat:** `Village · Wiki links` · **Mockup:** none yet ·
**Code:** `src/lib/wiki.ts` (names to wiki addresses, checks; plain and tested),
`src/app/api/wiki/[game]/[card]/route.ts` (asks the wiki whether the page exists, kept for a day),
`src/components/wiki/WikiLink.tsx` (the link on cards) · **Database:** one column,
`games.wiki` (`supabase/migrations/20261113000000_game_wiki.sql`, reviewed by the hub).

Not a Block of its own: a small link that sits on entries (characters, items, classes, places).
Written up here with the Blocks because it's built like one, like [Videos](videos.md).

## What it's for

Matt (2026-11-10): link a Village entry to its page on the game's wiki, for example a
character's wiki page.

Village and a wiki do different jobs. Village is the quick answer while you play: who is this,
can I recruit them, how strong are they. A wiki is the long read: every line of dialogue, every
support conversation, the history behind a name. Players already use both. A link from our card
to the wiki's page saves them the search, and it's a fair nod to the wiki communities whose work
our builders often check against.

### The moments (from the intuitive-design steps)

| | Going deeper: "tell me everything" (primary) | Checking: "is Village right?" | Building: "let me look it up" |
|---|---|---|---|
| **Who** | Any player | A careful player, or one who spotted a mistake | A builder writing or fixing an entry |
| **Trigger** | Read the card, want the full story, supports, or lore | A number or fact looks off | Adding a character, checking a stat |
| **State** | Curious, relaxed, game often paused | Skeptical | Focused, several tabs open |
| **What they know** | The entry they're on | The entry, the fact in doubt | The entry's name |
| **Surroundings** | Phone by the TV, or a second screen | Same | A computer, Village and the wiki side by side |
| **Done looks like** | On the right wiki page in one tap, Village still open behind it | Saw the wiki's version, maybe suggested a fix | Had the page open, cited it as the source |
| **Time** | A tap | A minute | Seconds saved on every entry |

Real-world signal (general knowledge, plus a check of the real wikis on 2026-11-10, below): the
usual annoyances are links that lead to "page not found", landing on a "which one did you
mean?" page (there are several Theodoras across Fire Emblem games), wikis full of spoilers, and
a link that quietly took you out of the app you were using.

What this means for the design:
- **No dead links.** A link only shows once our server has asked the wiki that the page is
  really there. A missing page or a "which one?" page shows no link and goes on a list for
  builders instead.
- **Quiet, at the end.** The link is small and comes after our own content, with the wiki's
  name on it, so it reads as "more on the wiki" and not as "the answer is elsewhere".
- **Never lose your place.** It opens in a new tab; Village stays where you were.
- **Nobody pastes links.** One setting per game builds every entry's link from its name.
  Builders only step in where the wiki names the page differently.

## What we found on the real wikis (2026-11-10)

We asked four wikis' free MediaWiki API (`api.php?action=query&titles=...`, no key) about real
entries:

| Wiki | Checked | Found | "Which one?" pages | Missing |
|---|---|---|---|---|
| Fire Emblem Wiki, Fandom (fireemblem.fandom.com) | 50 Fortune's Weave characters | 50 | 6 (Theodora, Leda, Ursula, Castor, Maria, Simon) | 0 |
| Fire Emblem Wiki, independent (fireemblemwiki.org) | the same 50 | 50 | 1 (Ursula, by a redirect) | 0 |
| Both Fire Emblem wikis | 10 Fortune's Weave weapons | 7 to 8 | Fandom: Fire, Thunder, Wind | 2 to 3 (Glass Wheel, Sword of Judgment) |
| Zelda Wiki (zeldawiki.wiki) | 10 Ocarina of Time names | 10 | 0 | 0 ("Zelda" redirects to "Princess Zelda") |

What that tells us:
- **Most names just work.** 90% or more found by the name alone.
- **"Which one?" pages follow a pattern for characters.** Fandom's "Theodora" page lists
  "Theodora (Fortune's Weave)", and that page exists. Weapons don't follow it ("Fire" means
  "Fire (tome)"), so those go to builders.
- **The plain name can be someone else.** On fireemblemwiki.org, "Maria" and "Castor" are pages
  about characters from older games, and the Fortune's Weave ones are "Maria (Fortune's Weave)"
  and "Castor (Fortune's Weave)". A page found isn't always the right page. So Village asks for
  "Name (Fortune's Weave)" first, and only uses the plain name when there's no page for this game.
- **Redirects are normal and fine** ("Zelda" to "Princess Zelda"). But a redirect can also go
  somewhere unrelated (on Zelda Wiki, "Marth" goes to the Smash Bros page), so redirects to a
  differently named page are listed for builders to glance at, while the link still shows.
- **Different wikis are laid out differently.** Fandom's API is at `/api.php`, the independent
  wikis' at `/w/api.php`, and both put pages at `/wiki/Name`. Rather than asking a moderator to
  type an address pattern, Village works it out (below).

## What a player sees

On every character, item and class card (the Profiles card, the List's panel, the entry panel),
right under the name:

> **Fire Emblem Wiki ↗**

- Small, blue and underlined so it reads plainly as a link out, with the wiki's name so it's clear where you're going (and the wiki
  gets credit). Hovering says "Opens Fire Emblem Wiki in a new tab. Wikis often have spoilers."
- Opens in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Shows only when the page was found. Until our check answers (a split second, usually from the
  cache) nothing shows, so there's no flicker of a link that then disappears.
- A spoiler entry's link sits inside its spoiler, like the rest of the card.
- Builders' "John Doe" sample shows a gray, unlinked "Wiki ↗" so they see where it goes.

## Setting the wiki (moderators)

In the Workshop (moderators only), "Game wiki":
1. **Paste any page from the wiki**, e.g. `https://fireemblemwiki.org/wiki/Marth`.
2. Village finds the wiki behind it: it tries the two usual API addresses on that site
   (`/w/api.php`, then `/api.php`) and asks the wiki for its own name and page address. It shows:
   "Fire Emblem Wiki · found · Marth ✓".
3. **Name** is filled from the wiki (it can be shortened).
4. **When a name is taken** (optional): the word the wiki adds in brackets for this game, e.g.
   `Fortune's Weave`, so "Theodora" becomes "Theodora (Fortune's Weave)" where the wiki needs it.
5. Save. "Turn off" removes it, and every link goes with it.

What's saved, per game: the wiki's name, its API address, its page address pattern (from the wiki
itself, like `https://fireemblemwiki.org/wiki/$1`) and the bracket word. The API address must be
https, a real host name (no bare numbers, no `localhost`), and end in `api.php`; the database
checks this too, not just the form. Our server also only asks wiki sites on a known list (below).

## How a name becomes an address

The wiki's own rules (MediaWiki), so we match what its search would do:
- Spaces become underscores; the first letter is made a capital (most wikis do this).
- Everything else is URL-encoded, keeping the characters MediaWiki leaves readable (`:` `/` `'`
  `(` `)` `,`), so links look like the wiki's own: `/wiki/Theodora_(Fortune's_Weave)`.
- The name used is the entry's name. On a route game it's the plain name (routes don't rename
  people).
- The link goes to the page the wiki answered with: after a redirect, the real page
  ("Princess_Zelda"), after the bracket step, "Theodora_(Fortune's_Weave)".

The order Village tries, for each entry:
1. The builder's fix, if the entry has one (below). If it's "no link", stop.
2. If the game has a bracket word: "Name (bracket word)". Found and not a "which one?" page:
   link it.
3. The entry's name. Found and not a "which one?" page (or a redirect to one): link it.
4. Otherwise no link, and the entry goes on the builders' list.

Both names go to the wiki in one question.

## A fix per entry (builders)

Where the wiki names a page differently, a builder fixes that one entry with a normal Draft:
- In the entry form, under "Edit other parts", **Wiki page**: it shows what Village found
  ("Theodora (Fortune's Weave) ✓", or "Not found on Fire Emblem Wiki"). "Use a different page"
  takes a page name or a pasted address from that wiki (anything from another site is turned
  away with "That's not a Fire Emblem Wiki page"). "No wiki link" turns it off for this entry.
- Stored on the entry as a page name (`wiki: "Theodora (Fortune's Weave)"`) or "off"
  (`wiki: false`), never as a full address, so a fix can't point at another site. It's part of
  the entry's content, so it's voted on and shipped like any other change, and shows in the
  Draft's list of changes ("Wiki page: Theodora → Theodora (Fortune's Weave)").

## For builders

- **Open on the wiki**: a small button by the entry form's name, "Fire Emblem Wiki ↗", opening
  that entry's page (or the wiki's search for the name when it isn't found). It's in the
  Workshop only, for looking things up.
- **The wiki as a Source**: under "Where can others check this?", a chip "Fire Emblem Wiki:
  Theodora" fills the source with the page's name and address in one tap.
- **Links to check** (Workshop, "In the app" tab): entries with no link, in three groups:
  "Not on the wiki" (missing), "Which one?" (landed on a list page; it offers the pages that list
  links to, and picking one starts a Draft with the fix filled in), and "Goes elsewhere" (a
  redirect to a differently named page, to glance at). Each row has "Open on the wiki" and "Fix".

## Keeping it safe and polite

- **We only ever call the address a moderator saved for that game.** The browser asks our
  server about one entry by its game and card id (`/api/wiki/fortunes-weave/<card id>`); the
  server looks up that entry's name itself. It never takes an address or a page name from the
  browser, so nobody can make our server fetch other sites or ask the wiki about anything.
- **Only wiki sites we know.** Even with a saved address that passes every check, our server only
  asks sites on a short list (`KNOWN_WIKI_HOSTS` in `src/lib/wiki.ts`, the hub 2026-11-10):
  fireemblemwiki.org, zeldawiki.wiki, bulbapedia.bulbagarden.net, and any address on fandom.com,
  wiki.gg, fextralife.com and miraheze.org. A game whose wiki is elsewhere shows no links until
  we add its site. Why: a name that looks fine could point somewhere it shouldn't, and moderators
  will be community members.
- **When a wiki turns our server away, the player's browser asks.** fireemblemwiki.org sits
  behind Cloudflare, which blocks requests from server companies like Vercel (it answers 403),
  while players' browsers get through. So when the wiki turns our server away (or is down), our
  server answers with the saved wiki and the page names it worked out, and the browser asks that
  wiki itself (MediaWiki allows this with `origin=*`): only a known wiki site, at most two names
  that pass the page-name check (`askOf`), no login or cookies, no referrer. The answer is kept on
  the device for a day. The wiki sees the player's internet address, as it would when they click
  the link, like YouTube thumbnails. Our server keeps "turned away" for an hour and tries again.
- **Checked like any outside answer**: https only, no following redirects to other addresses,
  a 4-second timeout, a size cap on the answer, and page names checked against the characters a
  wiki allows (no `#<>[]|{}`, at most 255 bytes).
- **Kept for a day** (like video credits), with the wiki asked in batches of up to 50 names, so a
  busy Page costs the wiki a handful of requests a day. The wiki being down isn't kept as "not
  found", and neither is a timeout: those aren't kept at all, so links come back once it answers. A generic "Village" name in our requests (wikis ask
  for one), with nothing about the player.
- **No copying.** Village never shows the wiki's text, pictures or page previews: just the link
  and the wiki's name. Our rule is "our own words", and wiki pictures are often game art with
  unclear rights.

## Data

- `games.wiki` (one new column, a moderator setting): `{ name, api, article, bracket }`, or empty
  for no wiki. Moderators can already edit their game's row; a check makes sure `api` is an
  https `api.php` address and `article` a matching https page pattern. The migration can fill in
  the two games' wikis, so links show the day it's run.
- `wiki` on an entry (its content, in Drafts and revisions like every other part): a page name,
  or `false` for no link. No database change; the type goes in `src/data/pages/types.ts`.
- What the wiki answered isn't stored; it's asked again after a day.

## Build plan

1. **First slice: links on cards** (built 2026-11-10; SQL run by Matt). On Fortune's Weave
   it links 67 of 67 units (Maria, Castor and Ursula to their Fortune's Weave pages), 24 of 32
   weapons, 7 of 12 classes (Guardian through a redirect to "Guardian (Fortune's Weave class)")
   and 1 of 28 places. Items, most places and foes aren't on the wiki yet, so they show nothing.
   What: `src/lib/wiki.ts` (names to addresses, the order above,
   checks; tested), the check route, the column with the two games' wikis filled in (SQL for
   Matt), and the link on character, item and class cards and the entry panel. Shared files:
   `CharacterCard.tsx`, `EntryPanel.tsx` (one line each), and the migration (the hub reviews it).
2. **Fixes** (built 2026-11-10): the entry's `wiki` part in the type (read through `wikiFixOf`
   everywhere, since Draft content isn't checked by the database), the "Wiki page" control in the
   entry form, the line in a Draft's changes, "Open on the wiki" by the name, and the Source chip.
   In the Workshop the builder's browser checks names with the wiki directly (`src/components/wiki/ask.ts`),
   with the same limits as the live fallback. A spreadsheet paste-in copies the whole entry and only
   writes its columns, so a fix survives; a "Wiki page" column can come later.
3. **Builders' list and moderator setup**: "Links to check" in the Workshop, with "Which one?"
   picks; "Game wiki" for moderators.

## Decisions

- 2026-11-10 (Matt, in the hub): one wiki setting per game builds every entry's link from its
  name; a builder fixes one entry's link (or turns it off) with a normal Draft; links are checked
  with the wiki's free MediaWiki API on our server and only shown when the page exists; builders
  get "Open on the wiki" and the wiki as a ready-made Source. Why: nobody pastes hundreds of links,
  and no dead links.
- 2026-11-10: never copy wiki text or pictures into Village; link out with the wiki's name only.
  Why: our own words, and unclear rights on game art.
- 2026-11-10: our server only ever calls the wiki a moderator saved for that game, asked about
  entries it looks up itself. Why: a server that fetches whatever the browser asks can be abused.

- 2026-11-10 (Matt): the wikis are Fire Emblem Wiki at fireemblemwiki.org (run by fans; 1
  "which one?" page against Fandom's 6) and Zelda Wiki at zeldawiki.wiki (the main one, which left
  Fandom in 2023). Moderators can change them any time.
- 2026-11-10 (Matt): one wiki per game for now. Why: two links on every card is clutter, and
  players pick a favorite wiki anyway. A second can come later if a game's community asks.
- 2026-11-10 (Matt): a name that lands on a "which one?" page shows no link (after the bracket
  try) and goes on the builders' list. Why: a list page sends players nowhere.
- 2026-11-10 (Matt): the link carries the wiki's full name, "Fire Emblem Wiki ↗". Why: players
  see where they're going, and the wiki gets credit.
- 2026-11-10 (Matt): links show on Characters, Items and Collections (classes, foes, places),
  not on Guides, Checklists, Timelines or Tier lists. A per-Block switch in Set up can come later.

- 2026-11-10 (Matt): when a wiki blocks our server, the player's browser asks the wiki instead.
  Why: fireemblemwiki.org's Cloudflare blocks Vercel; our server still decides which wiki and
  which names, so nobody can point it anywhere else.

- 2026-11-10 (Matt): the link sits right under the name, blue and underlined. Why: easy to find,
  and plainly a link out. (It was at the end of the card in the Page's color.)

## Open questions (for Matt)

- None open right now.

## Later

- **Upgrade levels**: "Levin Sword +1" has no page, but "Levin Sword" does. Trying the name
  without a "+1" ending would link those without a fix per entry.

- A wiki for a whole Page or Block ("Classes" to the wiki's class list).
- Wikis that aren't MediaWiki (a few game sites run their own): they'd need their own check.
- Links in the other direction: a "Village" button for wikis, if a wiki community wants one.
