# Starting a game

**Status:** Slice 1 live (2026-11-21; Matt ran 20261130000000); slices 2 to 4 planned · **Chat:** started from the Builder-readiness chat ·
**Code:** `src/lib/games-data.ts` (`getGames`, `findGame`, cached), `src/lib/game-row.ts` (a row as a game, tested), `src/components/GamesProvider.tsx` (`useGames`, `useGame` in the browser), `src/data/games.ts` (the `Game` type and the starter games, the fallback)

From Matt's Ocarina early-Builder review, item 1: Builders can't start a game. A game's title, release date,
cover, routes and genre shade live in code. The goal is that Builders can build a game without Matt.

## The moment

A Builder whose game isn't in Village, often right before or at its launch. They know its name, its platform
and roughly its date, but not our words ("routes", "shade"). Done is the game existing with an empty Workshop,
ready for its first Page, in about two minutes. A player who searches for it later should find it, and see
where to help while it's being built.

## Agreed (Matt, 2026-11-21)

- **The Workshop opens straight away; the app launches later.** Starting a game makes it at once, for
  Builders only: its Workshop works, and players don't see it on the front page. The app launches for players
  once **5 people vote for it, or a Village moderator approves it**, whichever comes first.
- **Defaults Matt didn't change** (suggested, open to change):
  - The starter becomes the game's first moderator, for that game only, so its Builders aren't waiting on
    Matt. Village moderators can step in or remove them.
  - The start form asks only the basics: name, short name, platform, release date and genre (which picks the
    color shade). Cover, routes and wiki come later from the game's own Workshop, as setup Drafts.
  - "Don't see your game? Start it" sits on the front page under the games, and in its search when nothing
    matches (with the name already typed).

## What players see

- Before launch the game isn't on the front page or in its search. Its address works: the app home says it's
  being built, shows the "Still being built" progress, and points to the Workshop. Search engines skip it.
- At launch it joins the front page, as prelaunch or live by its release date.

## How it's built (slices)

1. **Games from the database.** The `games` table (from 20261020000000; it has id, title, platform,
   release_date, status, preset and wiki) gains what `games.ts` holds: short title, genre, shade, cover,
   routes (paths), next, popularity, moved pages. A migration fills in Fortune's Weave and Ocarina from
   `games.ts`. The site reads games through one cached loader, like `src/lib/app-data.ts`, refreshed when a
   game changes. No change anyone can see.
   **Built 2026-11-21.** The root layout reads the games (cached for days, tag `games`) and hands them to the
   browser side. Anything a row lacks comes from `games.ts`, so the site is the same before and after the SQL
   runs. Pages now refresh daily, since every page's shell reads the games.
2. **Start a game.** A `start_game` database function: signed in, checks every box (lengths, the genre is one
   of ours, the date), makes the game's address from its name and refuses a near-duplicate, gives one new game
   per person per day, sets the game's status to building (the table's 'draft'), and makes the starter its
   moderator. The front page's "Start it" opens the form; the new game's Workshop opens with "Add your first
   Page".
3. **Launch.** "I'd use this" votes on a game being built, from signed-in players other than its starter. At
   5, it launches by itself (a trigger, which must never fail the vote). Village moderators get "Launch now"
   and "Take it down" (spam, duplicates, games we shouldn't host).
4. **Game settings as Drafts.** In the game's Workshop: cover picture, routes and their question, wiki,
   genre, name and date, sent as setup Drafts like a Block's setup, published by the game's moderators.

Later: new games start with no Pages, instead of prebuilt ones like `src/data/pages/ocarina-of-time.ts`.

## Open questions

- What a launch vote is called on the button ("I'd use this", "Launch it").
- Whether a game that's never launched is ever cleared away (say, after 90 days with nothing in it).
