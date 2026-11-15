# The Workshop (general UI)

**Chat:** `Village · Workshop Designer` · **Code:** `src/app/g/[game]/workshop/` (`Workshop.tsx` the frame,
`EditorShell.tsx` every editor's frame, `AddBlock.tsx` adding Pages and Blocks, `chat/` the chat) ·
`src/lib/block-types.ts` (the Block types Builders can add) · `src/lib/sample-game.ts` (the made-up game
in the Add Block preview)

How the Workshop itself works, apart from any one Block. Each Block's own editors are in its spec.

## Layout

- **Chat and work, one at a time on phones.** No Build/Chat switch (Matt, 2026-11-15). The chat folds
  to a thin bar on the left, with its count and an "@" for mentions. On phones the bar shows beside the
  work, and the chat's fold button goes back to it. On wide screens the chat starts open beside the
  work on every visit (the fold isn't remembered), and folds to the same bar.
- **The work column's top row:** the Page's name on the left; search, Drafts / In the app / Questions,
  and Add Block on the right, on every screen size. No "In the app" subtitle. While searching on a
  phone, the view buttons and Add Block step aside so the search box gets the row.
- **Editors never grow past their column**: a wide row inside (the Page chips) scrolls instead
  (2026-11-15 fix). The preview is drawn at 440px and shrunk to fit, with an "Actual size" switch, and
  the line before it drags to widen it (remembered per device).
- **The "+" Page tab** is pinned at the right of the tab row; the tabs scroll behind it.
- **Arranging Blocks** (Matt, 2026-11-15): with one Page open in "In the app", moderators drag a Block by
  the grip at its top left (or use the arrow keys on it) to move it up or down the Page. Saving swaps
  the shown Blocks among the places they hold, so Tier lists (not listed in the Workshop) keep theirs.
  The drag is `useDragSort.ts`. Set up uses it too: each field row has a grip at its left (the up and
  down arrows stay, for keyboards). Fix forms don't: a field's order belongs to the Block, not one entry.

## Adding Pages and Blocks (slice 1 live, 2026-11-15)

Matt, 2026-11-15: a new game's Workshop starts with no Pages; a "+" after the Page tabs makes one.
"Add Block" (it was "New") adds a Block: pick its type from a dropdown at the top left, see an example
of it filled in on the right, and the example takes on your work as you fill it in.

- **Empty Workshop:** only the "+" tab ("Add your first Page") and a prompt in the work column.
- **New Page:** name, a one-word short name (the phone's bottom bar), one of the eight Page colors
  (ones other Pages use are marked), a symbol, and its first Block, all in one editor: an empty Page
  is useless.
- **Add Block:** the type dropdown starts open. Each type shows the player's question it answers,
  since Builders don't know our names. Offered: Characters, Items, Classes, Guides, Tier list,
  Planner, and Checklist and Timeline marked "first version". Collection isn't offered: Places and
  Foes will replace it. A Tier list needs a Characters, Items or Classes Block on its Page; a Planner
  needs a Characters Block in the game.
- **The preview** is the real app Block, filled with "The Lantern Isles", a small made-up game, so it's
  never blank and spoils nothing. Hovering a type shows its plain example; once picked, the example
  wears your name, line, symbol and the Page's color.
- **New entries** come from the "+ Add" on each Block, not the top button.
- **Who:** anyone can fill it in. Moderators add it straight away (today's database rules already
  allow it). Others can keep it on their device for now.

### Slice 2: Page and Block Drafts (built 2026-11-15; its SQL waits on the hub and Matt)

Matt chose "any Builder, as a Draft". `20261122000000_page_block_drafts.sql` gives Drafts two more
actions, `add_page` (a Page with its first Block) and `add_block`, following how removal Drafts were
added. Tests: `supabase/tests/structure-check.mjs`.

- **Sending:** signed in and not a moderator, Add Block's button is "Submit for votes". The Draft is
  titled "New Page: Bestiary" or "Rivals on Units", and opens in Drafts once it's sent. Its content is
  `StructureContent` in `AddBlock.tsx`. Signed out, "Keep on this device" as before. Moderators still
  add directly.
- **Voting:** up and down votes (whether the app should have it is an opinion). A Block Draft counts
  on its Page's tab; a Page Draft shows under Everything.
- **The card** (`StructureDraftCard` in `Workshop.tsx`) says what it adds and shows the same preview
  its author saw. Moderators get "Approve and add".
- **Publishing** (`ship_structure`, called by `ship_draft`) checks everything a player typed: lengths,
  the type (only the ones Add Block offers), symbols (letters and digits), the color, and that a Tier
  list ranks a Characters, Items or Classes Block on its Page and a Planner picks from a Characters
  Block in the game. It builds the Tier list and Planner settings itself rather than copying them, and
  makes keys that never clash. The chat says "<title> is now in the app."; Discord skips these.

### Rough spots

- Tier list and Planner previews show their empty starting state, not a filled-in example (a Tier
  list's community tiers and a party come from players). A sample list and party would read better.
- Set up for a fields Block is a separate step after adding. Starting from the type's usual fields
  keeps that short for most Builders.
- The Workshop hides Tier list Blocks (nothing to edit there), so a new one shows in the app only.
