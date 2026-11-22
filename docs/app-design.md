# The game app's feel (app-wide)

**Status:** Slice 1 (the home) built 2026-11-22 · **Chat:** `Village · App design` · **Code:** `AppHome` in
`src/components/app/PageView.tsx`, `src/components/app/HomeNext.tsx`

How every game's app feels to a player, across Blocks: the home, the top of each Page, and how routes are
shown. Each Block's own view stays with that Block's chat and spec; this file covers what they share.

## Why

Matt, 2026-11-22, on Fortune's Weave: "I like the content but I don't like the feel. Everything looks the
same and I'm just scrolling through lists; it doesn't feel intuitive regarding what I'm doing." It felt
wrong while scrolling down the Party Page. On a phone (375 px) the home ended in a stack of identical Page
cards (a table of contents), and every Page stacked eight rows of controls before its first entry (the
first unit about halfway down, the first item about 60% down).

## The moments (from the intuitive-design steps)

Matt picked **looking something up** as the moment to design around first (2026-11-22).

| | Looking something up (primary) | Game paused, what now? | Planning |
|---|---|---|---|
| **Trigger** | A name on screen (a unit, a weapon, a class, a quest), or "where do I get X?" | Back in town, a new chapter, a level up | Sitting down before a session or a new route |
| **State** | Curious, wants back to the game | Wants to get on with playing | Relaxed |
| **What they know** | The name as the game shows it, maybe misspelled or partial | Their route, roughly their party | Units they like |
| **Surroundings** | Game paused, phone by the TV | Same | Sofa or a computer |
| **Done looks like** | The card answers it | Knows the 1 to 3 things to do now | A plan saved |
| **Time** | 10 to 30 seconds | 10 to 20 seconds | Minutes |

## Rules

- **Builders make everything** (Matt, 2026-11-22: "anything related to the game should be created by
  builders, not on the backend or by moderators"). Nothing in the app's look or behaviour may name a game's
  places, people or terms in code. Everything shown comes from entries, the game's routes and route question,
  and Block setups. Why: Village works for any game only if builders can make all of it.
- **Routes are never filtered silently** (Matt, 2026-11-22). One playthrough can cross every route in turn
  (Fortune's Weave: all four Flame Lords). Wherever a list is filtered by route, the route stays in view and
  the list says what's hidden; search finds everything and labels other routes; empty states say what's on
  other routes. Why: a player who started on Cai thinks information is missing on their second Flame Lord.
- **Answer first, browse second.** The first thing on a screen answers the moment; the full list is one tap
  further.

## Slice 1: the home, built around search (Matt: "Yes, build slice 1", 2026-11-22)

Top to bottom on a phone:
1. **One big search**, the first thing under the top bar. Results show every route; your route's come first,
   and an entry that isn't on yours says so under its name ("Flame Lord: Leda only", the game's own route noun,
   so it reads right for any game). Tapping a result opens its card on top of the home (the same pop-up links
   use), so Back returns to the search; guides and timeline entries still go to their Page.
2. **Recent**: the last entries you opened, as small chips under the search, opening the same pop-up. A card
   opened in a pop-up (from search or a link inside a card) now counts as opened (`Peek.tsx`).
3. **The route line**: "Flame Lord: Theodora · Change" (the game's own route noun from its route question),
   opening the phone's picker. With none picked it's yellow (act on this): the game's route question, "For your
   deadlines and party. Search always shows every Flame Lord."
4. Launch votes and "Still being built" for games that need them (unchanged).
5. **Next for you**: one card with the next last chance on your route (with Done, the same tick as on its
   Page, and "Done: … · Undo" for a mis-tap) and your party's next steps (from the Planner), at most three, then
   "Your party · 1 more to do". An empty party gets "Plan your party".
6. **Browse everything**: every Page as a small tile (its piece and name), three to a row on a phone.
7. Open questions, new in Village, communities, the credit line (unchanged, moved down).

The big dark banner with the title and route radio buttons is gone: the top bar already names the game.

**Checked** on a local production build and live (6a022e0, 2026-11-22), phone (375 px): search first, "Dancer"
showing "Flame Lord: Leda only" and opening its card over the home, Back returning to the results, Recent filled
from a pop-up, the yellow route line with none picked, Done and Undo moving the last chance on, three party steps
with "1 more to do", eight Page tiles, no sideways scroll, no console errors. Not checked: a real phone's touch.

## Later

- **Slice 2: every Page's top.** One search and a route bar that stay at the top while scrolling; builder
  tools (spreadsheet, share, add) behind one "⋯"; the first entry in the top quarter of a phone screen; each
  route-filtered list starts with "Theodora · 8 more on other routes" (one tap to show them, greyed with
  "Flame Lord: Leda only").
- **Each Block's own shape** (class ladder, item shelf, timeline, map) with that Block's chat.
- **The Party Page** (Planner chat): one-line party rows, My run showing only what's due before the next
  chapter.
- **"Starting your next Flame Lord?"** on the home once a route is finished. Needs a signal builders set (which
  checklist entry ends a route), not words read from text.

## Known gaps (builder readiness)

Existing code reads Fortune's Weave's words out of text: deadline sorting assumes Part I is chapters 1 to 12
and Parts II and III follow (`src/lib/deadline.ts`), and My run orders by "Renown" (`src/lib/my-run.ts`). A
builder on another game can't change either. Raised as its own follow-up, 2026-11-22.
