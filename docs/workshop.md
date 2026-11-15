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
  (2026-11-15 fix).

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

### Slice 2 (next): Page and Block Drafts

Matt chose "any Builder, as a Draft". Drafts get two more actions, "add a Page" and "add a Block",
following how removal Drafts were added (`20261120000000_remove_requests.sql`). Publishing one creates
the Page or Block. A Page Draft carries its first Block. The Draft card shows the same preview, so
voters see the result. Moderators can still publish at once in a brand-new game with no voters. It's a
migration, so the hub reviews it first.

### Rough spots

- Tier list and Planner previews show their empty starting state, not a filled-in example (a Tier
  list's community tiers and a party come from players). A sample list and party would read better.
- Set up for a fields Block is a separate step after adding. Starting from the type's usual fields
  keeps that short for most Builders.
- The Workshop hides Tier list Blocks (nothing to edit there), so a new one shows in the app only.
