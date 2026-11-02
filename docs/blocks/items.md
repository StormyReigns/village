# Block 2: Items

**Status:** Built, first version (2026-11-02); live on Fortune's Weave once the SQL is run ·
**Chat:** `Village · Block: Items` · **Mockup:** none yet · **Code:**
`src/components/app/Items.tsx` (tiles, List, Compare, Got it), `src/lib/items.ts` (group
order), the item fields in `src/lib/fields.ts` (`ITEM_FIELDS`, `tileFields`, `linkedFrom`),
the full view in `CharacterCard.tsx`, and Set up and the item form in the Workshop
(`FieldSetup.tsx`, `CharacterInputs.tsx`) · **Database:**
`supabase/migrations/20261102000000_items_block.sql`, then `seed-app.sql` · **Replaces:**
Fortune's Weave · Items (was a "slots" Collection) and Weapons and magic (was a "stats
table" Collection)

Built on Characters (Block 1), the most refined Block: the same fields model, piece, card
parts, heatmap and Workshop editors. Items adds the tile and a smarter way to find things.

## What it's for

The things in a game: what one does, where to get it, which is better, and what it takes
to make or upgrade it. Players pick it up mid-game, game paused, with the item's exact name
on screen in front of them (unlike characters, they nearly always know the name). They want
one answer and to get back to playing, usually in under 20 seconds.

### The moments (from the intuitive-design steps)

| | Found it: "what's this for?" (primary) | Need it: "where do I get it?" | Choosing: "which is better?" | Making it: "what do I need?" |
|---|---|---|---|---|
| **Trigger** | Picked up something new, or about to sell or throw it away | A quest, a recruit or a recipe asks for it | At a shop or the armory, two options side by side | At a forge or shop, or planning an upgrade |
| **State** | Curious, a bit unsure ("is this important?") | Mildly stuck | Weighing it up | Planning |
| **What they know** | The exact name, from the game | The exact name, from the request | Both names | The item they want |
| **Done looks like** | Knows if it matters and what it's for; keeps it or sells it | Knows the place and how; goes there | Picks one | Has a shopping list of materials |
| **Time** | 10 to 20 seconds | 20 to 30 seconds | Under a minute | A minute or two |

What this means for the design:
- **Search is the front door**, always in view. It finds a name from a few letters or a typo,
  and also looks inside the text, so "Lake Brontes" finds what you can get there and "recruit"
  finds the items people want.
- **The tile answers the quick questions**: its basic stats (Might, Hit...) or a price sit on
  it, so comparing a shelf of swords needs no tap at all.
- **The full view leads with the answer**: "What it does" and "Where to get it" first.
- **Comparing is one tap**: numbers are heat-colored against every other item, and tapping
  one opens the full table of everyone (the Characters heatmap, reused).
- **Making it answers both ways**: an item lists what it's made from, and every material
  shows what it's used to make, worked out from those lists, so nobody types it twice.

## What a player sees

- **Tiles** (the default): items as tiles in a grid, like an inventory screen. Each tile is
  the item's piece, its name under it, and whatever the builders put on the tile (Matt,
  2026-11-02): a row of small heat-colored numbers for basic stats, a price, a Type pill.
  Tap a tile for the full view.
- **Organizing**: with nothing typed, tiles are grouped under headers by the Block's first tag
  (Key items · 3, Materials · 4...), so the grid reads like the game's own inventory tabs.
  Filter chips (Type, Rank...) narrow it, and any tag can be the grouping, as in Characters.
  Letter ranks group best first (S, A, B... with a range like "B–A" by its best letter).
  Sorts: A to Z, Z to A, and "Best <stat>" for each stat (a sort by a stat drops the
  headers and ranks every item). A tag the tiles are grouped by isn't repeated on them.
- **List**: the same items as rows, for scanning: piece, name, the tile's things in one line,
  and the first line of what it does.
- **Got it**: a tick box on each item's full view (a piece: the split outline until you have
  it, then solid with a check, snapping into place), and a small solid piece by the name on
  its tile and row. Kept with the other ticks (checklists, recruits): on the device, and in
  the player's account when signed in, so the tile and the full view always agree.
- **Compare**: only when the Block has a chart (weapons). The full heatmap table, the one
  Weapons and magic had: tap a column to sort, tap a row for the full view.
- The address holds the item, so links and share cards open straight to it.
- Each device remembers the view, the grouping and the sort, per Block.

## The tile

Small and tidy, the same size for every item so the grid stays even (pieces never touch):
- The piece: game art when there is some, else the Type's symbol (a key for key items, a gem
  for materials), else initials. Never blank.
- The name under it, in ink, like an app-icon label (two lines at most).
- Up to three things the builders chose to put on the tile, in their order:
  - a chart: its first four numbers as tiny boxes ("MIG 14 · HIT 70"), heat-colored;
  - a short text or number: one small line ("1,200 G");
  - a tag or a toggle: a small pill.
- A spoiler on the tile stays covered; a value for another route shows the player's route.

## The full view

The card in the details panel, laid out by every switched-on field, using the Characters
card's parts:
- **Picture** as a piece, smaller than a character's portrait.
- **Name** in bold, with short fields beside it (Price, Sell price).
- **Tags** under the name as pills (Type, Rank or rarity), tappable to show every item with it.
- **What it does** and **Where to get it**, near the top in the starter order. "Where to get
  it" lines written "Place: how" show the place in bold; whole sentences read as text.
- **Stats** as heat-colored number boxes. Tapping one opens the table of every item sorted
  by it. No web by default (four numbers on a sword read better as boxes); builders can
  switch it on.
- **Made from**: small pieces of the materials with the amount ("× 3"), tappable.
- **Used to make**: worked out automatically from other items' "Made from".
- **Upgrades to / from**: the next and previous step (Levin Sword +1 → +3), tappable.
- Then the rest in the builders' order. Empty fields don't show, spoiler fields stay covered
  until tapped, route-specific values show for the player's route.

## Fields

Every Items Block starts from these common fields (`ITEM_FIELDS`); all are optional. Each field has
one more switch than in Characters: **On the tile** (shown on the tile as well as in the
full view). Everything switched on is in the full view.

| Field | Kind | On by default | On the tile by default |
|-------|------|---------------|------------------------|
| Type | tag (Key item, Material, Weapon...) | yes | no (it's the grouping) |
| Rank or rarity | tag | no | yes, when on |
| Price | number, beside the name | no | yes, when on |
| Sell price | number, beside the name | no | no |
| Stats | chart (the Block's stats) | no | yes, when on |
| What it does | long text | yes | no |
| Where to get it | list ("Place: how"), one source per line | yes | no |
| Made from | other items, with amounts ("Iron Ore: 3") | yes | no |
| Upgrades to | other items | no | no |
| Who can use it | short text ("Only Fabio") | no | no |
| Description | long text, for flavor or extra notes | no | no |

"Used to make" and "Upgrades from" aren't fields: they're worked out from other items. Long
text, lists and other items can't go on the tile (they don't fit), so Set up offers the tile
switch only on the rest.

Builders can add their own fields of any kind, the same kinds as Characters. "Other
characters" reads "Other items" in an Items Block (it links to entries in the same Block).

**Fortune's Weave** today:
- **Items** (9 entries: key items, materials, quest items, licenses, resources): Type, with
  a symbol for each (a key, a gem, a scroll, a badge, a sparkle), "Used for" and "Where to
  get it" (kept under the keys the entries already use, so nothing moves in the database).
- **Weapons and magic** (32 entries): Rank and Might / Hit / Weight / Crit on the tile;
  "Effect" (shown as "What it does"), "Note" (the "Only Fabio can use it" lines), "Where to
  get it" and "Used for" in the full view.

## Builders

As in Characters: **Set up** on an Items Block opens the field setup (switch, rename,
reorder, spoilers, add your own) on the Workbench. Each field row has a grid button, "On
the tile" (yellow when on), and the preview shows both: a sample tile and the "Sample item"
full view, so builders see what each choice does. With three things on the tile, the
button on the rest is dimmed and says the tile is full. Stat names have item suggestions
(Tactics weapon, Action weapon, Armor, Classic RPG gear), and the example for each kind of
field uses item names (Element, Ingredients, Lore...).
**Adding or fixing an item** uses the same form as characters: fields in the full view's
order, inputs by kind, "Made from" as rows of "Which item" and "How many, or a note" with
names offered from the Block, and the live preview. Moderators save setups for now.

## Decisions

- 2026-11-02: Items is Block 2, and Characters is its foundation. Why: Characters got the
  most refinement; the current Items Block is outdated (Matt).
- 2026-11-02: items show as tiles with basic stats, and builders decide in the Block editor
  what's on the tile and what's only in the full view (Matt). Why: players scan a shelf of
  items to compare them, and only some numbers matter at a glance.
- 2026-11-02: it reuses the Characters parts (fields, piece, card, heatmap, editors) rather
  than copying them. Why: one fix improves both, and builders learn one way of setting up.
- 2026-11-02: Weapons and magic becomes an Items Block too, beside Items on the same Page,
  with Compare as its third view; the old stats-table look retires there (Matt). Why: one way
  to build and set up anything a player carries.
- 2026-11-02: with nothing searched or filtered, tiles sit under headers by Type (or any tag
  the player picks) (Matt). Why: it reads like the game's own inventory tabs.
- 2026-11-02: crafting is in from the start: "Made from" with amounts, and "Used to make"
  worked out on every material (Matt). Why: one list typed once answers both questions.
- 2026-11-02: players get a "Got it" tick now, saved on their device (Matt). It uses the
  same store as checklist ticks and recruits, which also follows a signed-in player's account.
- 2026-11-02: built. The item's full view is the Characters card (`CharacterCard`, name kept
  for now) with item touches; Characters renders exactly as before (a test pins its fields
  and sample, and the Units card matched the live site on a production build).

## Open questions

- A mockup board for Items on the Block Silhouettes canvas.
- Whether a "Not got yet" filter is worth adding for collectors.

- "Who can use it" linking to characters in another Block (Units).
- Shops as their own thing (what a shop sells, at what price).
- Whether Characters gets tiles and "On the tile" too.

## Later
