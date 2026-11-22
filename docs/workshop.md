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
- **"In the app" shows what needs help** (Matt, 2026-11-21: the lists felt bland and overwhelming, all
  brown and beige). Each Block has a progress line ("78 of 148 filled in") and a "need help" filter.
  Entries that still need something are split-outline pieces with "Needs Where to get it" in violet;
  filled-in ones are solid. A field counts when it's one of its type's core fields or most entries have
  it (`src/lib/completeness.ts`, tested). Lists over 12 are grouped by the tag the app filters by, in
  the tag's order (letter ranks best first). The repeated "Fix" became a pencil on hover.
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
  allow it). Signed-in Builders send it as a Draft (slice 2, below); signed out, they can keep it on their device.

### Slice 2: Page and Block Drafts (built 2026-11-15; live, Matt ran its SQL by 2026-11-21)

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

## Setups as Drafts (live 2026-11-21: Matt ran its SQL)

From Matt's Ocarina early-Builder review: Builders should build a game without Matt or moderators. Set up
(a Block's fields), a Planner's setup and a map picture saved for moderators only. Now anyone signed in
sends one as a Draft. `20261127000000_setup_drafts.sql` adds the action `setup`; tests:
`supabase/tests/setup-check.mjs`. Content and the "what changes" words: `src/lib/setup-draft.ts` (tested).

- **Sending:** signed in and not a moderator, Set up's and the Planner setup's button is "Submit for
  votes", and the map's is "Submit map for votes" (anyone signed in can now upload a map picture into
  their own folder). The Draft is titled "New setup for Units" or "New map for Places", and opens in
  Drafts once sent. Moderators still save directly.
- **What it carries:** the setup, and the Block's setup when it was sent ("before"). Publishing refuses
  if the Block's setup has changed since, rather than overwrite it; the card says so up front.
- **The card** (`SetupDraftCard` in `Workshop.tsx`, sharing `ProposalCard` with Page and Block Drafts):
  what it changes in words ("Renames Kind to Type", "Adds Weakness (list)"), the picture for a map, and
  "See it in Set up", which opens the editor with the suggestion and its preview (nothing to save there).
  Up and down votes. Moderators get "Approve and publish".
- **Publishing** (`ship_setup`) checks fields (60 at most, names, known kinds, links into this game,
  capped choice lists and stats), rebuilds a Planner's setup from checked parts (its Blocks in this game,
  sizes clamped), and takes a map only from the author's or a moderator's upload for this game.

## Changing a Block's type (built 2026-11-21; its SQL waits on Matt's run)

Matt's Ocarina review, item 6: Ocarina's Items and Foes started as Collections, an old type. A Block with
nothing in it yet can become another type: Characters, Items, Classes, Guides, Checklist or Timeline.

- **Where:** a "Type" button on the Block in In the app, shown only while the Block is empty, isn't a Tier list,
  Planner or map, and no Tier list or Planner uses it (`retypeProblem` in `src/lib/block-types.ts`, tested).
- **The editor** (`ChangeType.tsx`): Add Block's type list, and the picked type's example wearing the Block's
  name, symbol and color. Moderators change it straight away; anyone else signed in sends it as a setup Draft
  ("Foes as a Characters Block"), shown on its card with the same example.
- **Publishing** (`ship_setup`, `20261129000000_block_type_drafts.sql`, tests in `setup-check.mjs`): the type on
  its own, checked again (empty, not a map, nothing uses it, unchanged since sent). The old type's fields, look
  and settings go; the new type gets its usual filter. Set up comes after.
- **Later:** changing a Block that has entries (converting them), and new games starting with no Pages instead of
  prebuilt ones (`src/data/pages/ocarina-of-time.ts`; Ocarina's empty starters can stay or go, Matt's call).

### Rough spots

- Tier list and Planner previews show their empty starting state, not a filled-in example (a Tier
  list's community tiers and a party come from players). A sample list and party would read better.
- Set up for a fields Block is a separate step after adding. Starting from the type's usual fields
  keeps that short for most Builders.
- The Workshop hides Tier list Blocks (nothing to edit there), so a new one shows in the app only.
