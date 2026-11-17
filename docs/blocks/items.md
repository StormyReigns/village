# Block 2: Items

**Status:** Live, first version (2026-11-02), on Fortune's Weave · Items and Weapons and magic ·
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

- **Tiles** (the default), a shelf where each section is drawn by how much it holds
  (`densityFor` in `src/lib/items.ts`; Matt, 2026-11-15, because a big shelf of cards falls
  apart):
  - **up to 16 items: cards** in one row that scrolls sideways (see "The tile" below; 8 until
    2026-11-16);
  - **17 to 60: small icon tiles**, in three rows that scroll sideways (striped white, the set's shade, white): the plain symbol (or
    picture) in the Page color, the name under it, and its numbers (the tile's first chart, up
    to four) as small heat-colored boxes, the one being sorted by outlined;
  - **over 60: icon rows**, in eight rows that scroll sideways, striped white and shade in turn: symbol, name, the tile's
    first other tag (a rank) and the same small numbers.
  The header names the small numbers once ("Might · Hit · Weight · Crit"). One Block can mix
  all three, which keeps a big Block from feeling like a wall. Tap any of them for the full
  view.
- **Sideways, not folded** (Matt, 2026-11-16): tiles and rows scroll sideways (with arrows on
  a computer, and the mouse wheel moving them) instead of "Show all".
- **Organizing**: with nothing typed, items are grouped under headers by the Block's first tag
  (Key items · 3, Materials · 4...), so the shelf reads like the game's own inventory tabs.
  Each group is its own band: a light wash of the Page color with an edge, a gap before the
  next, and a header that is a solid strip in the Page color (white symbol, name and count, like
  a tab), pinned under the top bar while the band scrolls past. Sideways strips show their
  arrows on phones too, and a small bar under each strip shows how much there is and how far
  along you are. Any tag can be
  the grouping, as in Characters. Letter ranks group best first (S, A, B... with a range like
  "B–A" by its best letter). Sorts: A to Z, Z to A, and "Best <stat>" for each stat (a sort by
  a stat drops the headers and ranks every item). A tag the items are grouped by isn't
  repeated on them.
- **Type chips**: each with its symbol and count ("Sword · 42"); tapping one shows only that
  type, and All brings the whole shelf back (Matt, 2026-11-16; they jumped to sections before).
- **List**: the same items as rows, for scanning: piece, name, the tile's things in one line,
  and the first line of what it does.
- **Got it**: a tick box on each item's full view (a piece: the split outline until you have
  it, then solid with a check, snapping into place), and a small solid piece by the name on
  its tile and row. Kept with the other ticks (checklists, recruits): on the device, and in
  the player's account when signed in, so the tile and the full view always agree.
- **Compare**: only when the Block has a chart (weapons). The full heatmap table, the one
  Weapons and magic had: tap a column to sort, tap a row for the full view.
  A "By type" button beside Name (named after the grouping tag: "By weapon type") groups the
  rows under their type, each type still in the sort's order, so the best Might among swords is
  one tap. The same button is on the heatmap a stat opens from an item's full view (under the
  ticked "Selected items").
- The address holds the item, so links and share cards open straight to it.
- Each device remembers the view, the grouping and the sort, per Block.

## The tile

Each item is a white card on the shelf (since 2026-11-14), with a clear gap between cards:
- A **standout badge** on top when the item is the clear best at one of the tile's numbers:
  "Strongest" (Might, Attack...), "Most accurate" (Hit), "Lightest" (Weight), "Best crit",
  "Toughest", "Fastest", "Cheapest"... (`standouts` in `src/lib/items.ts`). Ties earn none, it
  needs three items with the number, and an item keeps its first word. Where any card in the
  Block has a badge, every card keeps the row, so the pieces line up.
- The piece: game art when there is some, else the symbol of its Type or weapon type (drawn
  big, about a third of the piece), else initials. Never blank.
- The name under it, in ink, like an app-icon label (two lines at most).
- Up to three things the builders chose to put on the tile, in their order:
  - a chart: its first four numbers in two columns, each named in full (Might, Weight) over
    the number, heat-colored; the stat being sorted by is outlined in ink;
  - a short text or number: one small line ("1,200 G");
  - a tag or a toggle: a small pill.
- A line on what's special: the start of its first long text ("Heals you for half the damage
  dealt", "Recruits Ninae"), two lines at most.
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

**Fortune's Weave** today (after the item research of 2026-11-15, live once `seed-app.sql` is
rerun):
- **Items** (226 entries over 11 types): the 9 starter cards plus 217 researched ones:
  Equipment 26 (rings, gems, amulets, staves, masks), Shield 5, Consumable 7, Spell scroll 2,
  Crate 8, Material 64 (trade goods: each lists what it buys from the Vandhal Trading Co. and
  where, "5 (with 5 Caltrop Flower) buy a Charm Mask at Valley of Black Wings, Idiya"), and
  Gift 108 (each lists who loves it and who really likes it). Symbols: a key, wheat (trade
  goods), a scroll, a badge, a sparkle, a gem (equipment), a shield, a flask, a scroll, a box,
  a gift. "Used for" holds an item's effect, a gift's fans or a trade good's uses; "Where to
  get it" holds the trades that give it. Data: `src/data/pages/fortunes-weave-goods.ts`.
- **Weapons and magic** (32 entries): Rank and Might / Hit / Weight / Crit on the tile;
  "Effect" (shown as "What it does"), "Note" (the "Only Fabio can use it" lines), "Where to
  get it" and "Used for" in the full view. A "Weapon type" tag (Sword, Spear, Axe, Bow,
  Gauntlet, Black Magic, White Magic, the game's own names, from Game8's list of all weapons
  and spells) gives each piece its symbol: a sword, a spear (drawn for us; Lucide has none),
  an axe, a bow, a fist, a wand with sparkles, a sun. The update 1.01 bundle (Chosen Sword,
  Chosen Lance, Royal Sword, Breidablik) has no one type and keeps its initials.
  After the research: **149 entries**, the 32 starter ones plus every other weapon and spell
  Game8 lists (Sword 24, Spear 26, Axe 20, Gauntlet 17, Bow 16, Black Magic 24, White Magic
  21). Each new one has Might, Hit, Weight and Crit from its Game8 page, its rank (a spell's is
  the skill level most of its learners get it at), what it does in our words (range, what it's
  effective against, its combat art, avoid, curse, a spell's uses and effect), where to get it
  (shops, crates, chests, quests, trials, trades, "Eshmel's own weapon"), what it upgrades to
  (The Nameless to Shining Spear) and, for spells, who learns it. A weapon's durability is left
  out (it only matters for combat arts). Data: `src/data/pages/fortunes-weave-arsenal.ts`.
- **Research sources** (Nov 2026), named on every entry: Game8's list of all weapons and spells
  and each one's page; Raider King's guide to the Vandhal Trading Co. (trader items, trades,
  trade goods); accessory guides from allthings.how and Prodigy Gamers (effects, weights);
  Game8's gift guide (who likes what; Game8 marks it a work in progress). Spell effects are
  checked against fortunesweave.co.uk's spell list. Starter cards and community edits always
  win: the seed only adds what's missing (matched by name, so "Miasma Δ" isn't added beside
  "Miasma").

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
- 2026-11-14: weapons show their type's symbol in their piece (Matt). A piece now takes a
  symbol from any of its tags, the Block's first filter first, so weapons stay grouped by Rank
  while showing a sword or a bow. Why: initials told players nothing, and uploading art for
  every weapon would leave most tiles as initials for a long time. A picture, once added,
  still replaces the symbol. Migration `20261119000000_weapon_types.sql`.
- 2026-11-14: tiles became cards (Matt: "I like the cards idea but I also liked the stats"):
  a white card each, a bigger symbol, all the tile's numbers kept but named in full and in two
  columns, a standout badge for the clear best at a number, and a line on what's special. Why:
  the shelf looked like splotches, numbers and some text; players at the armory want "which is
  better?" and "what does it do?" answered at a glance.
- 2026-11-15: each section is drawn by how much it holds: cards up to 8, small icon tiles to
  30, icon rows past that; long sections fold, headers stay pinned, and the chips jump between
  sections (Matt: the cards fall apart with too many items; design variety helps against
  overwhelm, for hundreds of items over 3 to 12 types). The compact looks use the plain symbol,
  not a piece (Matt): pieces belong to cards and the full view. Fortune's Weave weapons group by
  Weapon type first, then Rank (starter data; live after seed-app.sql is rerun).
- 2026-11-15: item heatmaps (Compare, and the one a stat opens) can group rows by type, with
  the stat sort kept inside each type (Matt: we need to be able to sort by type). Why: comparing
  a sword with a spell rarely helps; players compare within a weapon type.
- 2026-11-16: cards for up to 16 items, tiles up to 60, rows past that; tiles and rows scroll
  sideways instead of "Show all"; the type chips show one type instead of jumping; and the
  compact looks show all the tile's numbers small, in the room "Might 11" took (Matt).
- 2026-11-16: each type is its own tinted, outlined band with a gap between (Matt: on a phone
  it was hard to tell where one set ends and the next starts).
- 2026-11-16: the band headers became solid Page-color strips, and sideways strips got arrows
  on phones and a progress bar (Matt: still hard to tell sets apart at a glance, and hard to
  tell it scrolls on a phone).
- 2026-11-16: card sections are one row high and scroll sideways; stat names, wherever they
  are shortened, use one rule (`statAbbr` in `src/lib/stats.ts`): MT, HIT, WT, CRT for weapons,
  STR, DEF, SPD... for characters (Matt). Cards keep the full words, which fit.
- 2026-11-16: tiles and rows are three rows high, each row a stripe: white, the set's shade,
  white (Matt).
- 2026-11-16: long sets (over 60, like Gift with 108) went back to eight rows, still striped,
  so they don't run off sideways for dozens of screens (Matt).
- 2026-11-15: Fortune's Weave's items were researched and added (Matt: find all known items):
  117 weapons and spells and 217 other items, with numbers from the sources and the rest in our
  own words, each citing its source; unknown effects are left out rather than guessed. Why: the
  Blocks only had the starter cards, and players look up items more than anything else.
- 2026-11-15: healing spells (Heal, Laia, Physic, Recover, Fortify) have no numbers; their heal
  power sits in the text ("with a heal power of 30") (Matt). Why: Game8 keeps it in the Might box,
  so Recover ranked third-strongest of all weapons. Migration `20261119120000_heal_power.sql`.

- 2026-11-16: types with fewer than five items fold into one "Other" section at the end of the
  shelf (`foldSmall` in `src/lib/items.ts`), with its header naming the types inside; each item
  keeps its type's symbol. A lone small type stays as it is (an Other of one type would only
  rename it), and so does a shelf where every type is small. The chips still filter to any
  single type (Matt). Why: a row of tiny bands, one or two items each, read as clutter.

- 2026-11-16: the starter card "Chosen Sword, Chosen Lance, Royal Sword, Breidablik" leaves the app
  (Matt: it showed as one item but is four weapons). Each has its own entry from the research,
  which now says where it comes from ("Arrives on its own in Part I, Chapter 4, on every route").
  Migration `20261123000000_retire_weapon_bundle.sql`; the bundle's versions are kept.

## Open questions

- Fortune's Weave gaps after the research (2026-11-15): effects nobody has published yet (the
  three masks, Challenge Gem, Spirit Gem, Antitoxin, Dew of Protection); where most gifts and
  trade goods are found; the starter Answerer has no numbers, and the
  starter forged weapons (Levin Sword +1, +3, Salamander +5) come from the player-made table, not
  Game8. Fixing starter entries needs Drafts or a migration (the seed never changes them).
- Mounts (Game8 lists about 17) and battalions could be items too.

- Builders choosing symbols for their own tags in Set up (today they come from the starter
  data or a migration).

- A mockup board for Items on the Block Silhouettes canvas.
- Whether a "Not got yet" filter is worth adding for collectors.

- "Who can use it" linking to characters in another Block (Units).
- Shops as their own thing (what a shop sells, at what price).
- Whether Characters gets tiles and "On the tile" too.

## Later
