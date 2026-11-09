# Block: World (Places and Foes)

**Status:** Building (2026-11-09): slice 1, the real map, live (6dd6e9e); SQL applied by Matt 2026-11-09 · **Chat:** `Village · Block: World` ·
**Mockup:** none yet · **Code today:** `src/components/app/MapBlock.tsx` (the "map" look of a
Collection), the "rows" look in `Blocks.tsx`, starter data in `src/data/pages/fortunes-weave.ts`
(`places()`, `foes()`) · **Live on:** Fortune's Weave · World (Dungeons and places, 28; Foes, 6);
Ocarina of Time · World (Places and Foes, empty)

World is the teal Page, symbol MapPin. Today it holds two first-version Collections. This file
designs them properly, the way Characters and Items were: two Block types, **Places** and
**Foes**, laid out by builder-set fields (`src/lib/fields.ts`), linked to each other and to the
rest of the app.

## What it's for

The "where?" Page. A player picks it up between battles or at the door of a dungeon: to choose
where to go next, to see what a place holds before going in (or to check they didn't miss
anything on the way out), and, when something keeps beating them, to look up that foe. It's
also where a completionist keeps score: which places are cleared, which duels are won.

### The moments (from the intuitive-design steps)

| | At the door: "what's in here?" (primary) | Free time: "where should I go next?" | Losing: "how do I beat this?" | Keeping score: "what's left?" |
|---|---|---|---|---|
| **Trigger** | About to enter a dungeon, or just left one and wonders if they missed a chest | Finished a chapter; has free turns to grind, loot or recruit | Lost to a boss or a duel, or one appeared on the map | Late game, or between routes |
| **State** | Focused, wants a quick list | Relaxed, a bit unsure what's worth the time | Frustrated, wants the one trick | Relaxed, methodical |
| **What they know** | The place's name, from the map in the game | Their party's level, what they still need (an item, a recruit) | The foe's name on screen, sometimes only "the giant" | Roughly what they've done |
| **Surroundings** | Game paused on the world map | On the couch, game paused | Retry screen, controller in hand | Game paused, or not playing at all |
| **Done looks like** | Knows the chests, materials, foes and anything missable there; goes in | Picks a place that fits their level and gets them something they want | Knows its weakness and what to bring | Sees what's left and where |
| **Time** | 10 to 20 seconds | Under a minute | Under 30 seconds | A minute or two |

Real-world signal (general knowledge of how players ask, not a fresh study): players ask by
place and level ("what level for Nemea Cavern", "best place to farm Lunar Stone", "where do I
go after chapter 9"), and by the foe in front of them ("how to beat the giant", "Dread Warrior
locations"). The usual complaints about wikis: a place's page lists its lore before its
chests, the foes and items for a place are on other pages you have to cross-check, and
there's no way to tick off what you've done, so players keep their own spreadsheets.

What this means for the design:
- **A place leads with what's there**: chests, materials, foes, people, and anything you can
  miss, before any description.
- **Typed once, shown everywhere.** If an item's "Where to get it" names Nemea Cavern, or a
  foe's "Where" does, the place shows it under "Found here" by itself, the way "Used to make"
  works out on Items. Nobody types the same fact twice.
- **"Where next" is one glance.** Above the map, the next few places you haven't cleared,
  lowest level first, on your route.
- **The foe card leads with the answer**: weak to, how to beat it, what to bring, before stats.
- **Ticks are the score.** "Cleared" on places and "Beaten" on foes fill in the map and the
  list, saved like every other tick (on the device, and in the account when signed in).

## What a player sees

### Places Block

- **Map** (the default): region tiles on map paper, as today (our own rough layout, never the
  game's map art), each tile filling in as its places are cleared, with "2 of 3 cleared" and a
  level range. Tap a region for its places.
- **Next up**: a short strip above the map, "Next up for you", with the two or three lowest-level
  places that aren't cleared yet (on the player's route), each a piece with its name and level.
  Hidden once everything is cleared.
- **List**: places as rows: piece, name, region, level, and a Cleared tick. Sorts: By level (the
  default), A to Z, By region. Search looks in names and in everything that's there ("Lunar
  Stone" finds the places that have it).
- **One place** (the full view, the Characters card's parts): the piece (game art when there is
  some, else the region's or type's symbol, else initials), the name, "Lv 23" beside it, Region
  and Type as pills, "Opens: Part II" with a clock, the Cleared tick, then the fields in the
  builders' order: Missable first in a red box (like a guide's Watch out), Chests, Materials,
  then **Found here** (worked out): Foes, People and Items that name this place, as small
  pieces, tappable. Then About, and Videos.

### Foes Block

- **List** (the default): rows: piece, name, where, and "Weak to" as small pills. Filter chips by
  Kind (Boss, Duel, Regular...). A Beaten tick on each row.
- **One foe**: the piece, the name, "Lv 18" beside it, Kind as a pill, "Where: Dione Fort" with a
  pin (tappable to the place), the Beaten tick, then How to beat (the answer), Weak to, Bring,
  Drops (tappable to the item), Reward, and Stats (off by default). Then Videos.

## Fields

### Places (`PLACE_FIELDS`, all optional)

| Field | Key | Kind | On by default | Where it shows |
|-------|-----|------|---------------|----------------|
| Region | `Region` | tag | yes | a pill; groups the map tiles |
| Type | `Type` | tag (Dungeon, Town, Fort, Cave...) | no | a pill; filter chips |
| Suggested level | `Level` | number | yes | beside the name; the map's ranges; Next up |
| Opens | `Opens` | when ("Part II", "after Ch 8") | no | under the name with a clock |
| Missable | `Missable` | list | yes | a red box, first |
| Chests | `Chests` | list | yes | its own heading |
| Materials | `Materials` | list | yes | its own heading |
| Shops and services | `Shops` | list | no | its own heading |
| About | the entry's description | long text | yes | after the lists |
| Found here | (worked out) | foes, people, items naming this place | always | after the lists |

### Foes (`FOE_FIELDS`, all optional)

| Field | Key | Kind | On by default | Where it shows |
|-------|-----|------|---------------|----------------|
| Kind | `Kind` | tag (Boss, Duel, Regular...) | yes | a pill; filter chips |
| Level | `Level` | number | no | beside the name |
| Where | `Where` | place (names a place in the Places Block) | yes | under the name with a pin, tappable |
| How to beat | the entry's description | long text | yes | first |
| Weak to | `Weak to` | list | yes | pills on the row; its own heading |
| Resists | `Resists` | list | no | its own heading |
| Bring | `Bring` | list | no | its own heading |
| Drops | `Drops` | list (names items) | yes | its own heading; item names tappable |
| Reward | `Reward` | list | no | its own heading |
| Stats | `@stats` | chart | no | number boxes |

Builders can add their own fields of any kind, as in Characters and Items.

Fortune's Weave today maps across without moving anything in the database: a place's "What's
there" lines split into Chests and Materials (they're already "Chests: …" and "Ores: …"), its
"Lv 23" becomes Level, and a foe's `stat` (where) becomes Where and its "Weak to" stays.

## Builders

As in Characters and Items: **Set up** on a Places or Foes Block opens the field setup on the
Workbench, with a sample place ("Old Mine") or foe ("Cave Troll") as the preview. Adding or
fixing a place or foe uses the same entry form. Moderators save setups for now.

## Checked (2026-11-09)

On the production build, with the sample page (`/lab/map`), at desktop and phone (375 px) sizes:
the map fits the Block with no sideways scroll; tapping a pin zooms to it and shows its card
(Cleared, Open); a group of close pins splits in one tap; zoom, Fit and full screen (Escape closes
it) sit in a row under the map, so they never cover a pin; mouse drag moves the map and the wheel
scrolls the page with a "Hold Ctrl" hint; on touch, one finger scrolls the page with a "Use two
fingers" hint and two fingers zoom (checked with made-up touches; a real phone is still to try);
spoiler places have no pin until shown. Fortune's Weave · World is unchanged (region tiles) until a
map picture is saved; the Workshop's Map button and `?pins=` open the editor. Not yet checked, as
they need a signed-in moderator and the SQL: uploading and saving a picture, sending pins as
Drafts, and the place form's "Where on the map".

## Decisions

- 2026-11-09: a real map: one picture per Places Block that Builders choose, with a pin for
  each place that opens its card (Matt). The pin is the place itself (it keeps its own spot), so
  there's no separate list of IDs to keep matched. Why: players expect a map that looks like
  the game's, and a pin that can't lose its card can't go stale.
- 2026-11-09: the build doesn't depend on what the picture is, game map or scribble (Matt).
  What matters is that it's usable inside the Block it's on.
- 2026-11-09: tools as one magnifier over the map, not a row under it (Matt): less in the way.
- 2026-11-09: full screen sits over everything, straight under the page's body (on phones the
  pin's card was hidden behind the page), and "Open" on a pin's card leaves full screen so the
  place opens in front (Matt found both).
- 2026-11-09: pins are yellow pieces with an ink edge and an ink symbol; a cleared place is ink
  with a white edge and a yellow tick; the picked one is bigger with a white glow (Matt: the white
  split outline looked choppy and cheap on a map; this reads on any picture). The group chips use
  the Profiles strip's scroller (arrows, wheel, no bar), with room so nothing is cut off.
- 2026-11-09: placing pins in full screen (Matt: "select from list + pin efficiently"): a "Full
  screen" button over the Workshop's map; in full screen the places sit in a strip under the map,
  the picked one in yellow, those not on the map yet first. The editor starts on the first place
  not on the map, and placing a pin moves on to the next, so a whole map is a tap per place.
- 2026-11-09: Groups on places, one each, a kind of place separate from Region; the map filters by
  several at once; a filter is loud and never remembered (Matt). Why: nobody should wonder where a
  place went. Fortune's Weave's places got their Group from their names
  (`20261110120000_place_groups.sql`, reviewed by the hub); Beast's Path and Dragonbone Tangle are
  left for the community rather than guessed.
- 2026-11-09: the map is the first slice (Matt). Each pin is a Draft (Matt), so the community
  can place and fix pins like any other fact.

## Open questions (for Matt)

1. Which moment comes first: "what's in this place?" (drafted as primary), "where next?", or "how
   do I beat this?"
2. Places and Foes as two proper Block types on the fields system (drafted), or one World Block?
3. The map: keep region tiles as now, or let builders arrange the tiles roughly like the game's
   geography (still our own drawing)?
4. Ticks: Cleared per place and Beaten per foe (drafted), or also a tick per chest?
5. First slice: Places first (map, Next up, the place card with Found here and Cleared), then
   Foes in slice 2?

## The real map (Matt's idea, 2026-11-09, being worked out)

Matt: a scrollable map matching the game, with pins Builders place, each opening the place's
card. Proposed shape:
- **One map picture per Places Block**, set by moderators, scrollable and pinch-zoomable
  (likely Leaflet, the usual tool for game maps; huge maps get cut into tiles later).
- **The pin is the place.** No separate ID list to match up: on a place's card in the Workshop,
  "Put it on the map", tap the spot. The place keeps its spot as a percentage of the picture,
  so moving a pin is an ordinary Draft and a pin can never lose its card. Short labels (A1, B2)
  can be worked out from the region and order if wanted.
- **Pins are small pieces**: the split outline until cleared, solid after (the brand's "solid
  = done"). Close pins merge into a count when zoomed out, so pieces never touch. Tap a pin for
  the place's card (the entry panel, a sheet on phones).
- Without a map picture, the region tiles stay as they are.
- **Any picture works** (Matt, 2026-11-09): the build doesn't care whether it's the game's map
  or a scribble. Builders choose it; what's allowed is a community and moderation matter, like
  any other upload.

### Usable inside the Block (Matt: "what matters is that it be usable within the block it's applied to")

The map is the Places Block's Map view, inside its white panel like any other view, not a
separate page. So it has to work in that space on a computer and on a phone:
- **Fits the panel.** It opens showing the whole picture at the panel's width, at a set
  height (about two thirds of the screen on a phone), so the rest of the Page is still there
  below it.
- **Never traps the page.** On a phone, one finger scrolls the page as usual and two fingers
  move and zoom the map ("Use two fingers to move the map" shows if someone tries one), the
  way maps embedded in pages work. On a computer, drag moves it and the wheel scrolls the page
  unless Ctrl is held (or the +/- buttons are used).
- **Full screen when wanted.** A button opens the map over the whole screen, where one finger
  moves it freely; X or back returns to the Page in the same spot.
- **The tools: one magnifier** over the top right (Matt, 2026-11-09), white with an ink edge and a
  shadow so it shows on any picture. Tapping it opens zoom in, zoom out, "Show the whole map" and
  full screen under it; dragging the map closes them. The map can be dragged a little past its
  edges, so a pin under the magnifier can always come out. Full screen keeps an X beside it.
- **Groups** (Matt, 2026-11-09): each place has one Group, a kind of place (Cave, Fort, Town,
  Shop...), kept as its `Group` category, separate from its Region. Chips over the map (All,
  then each group with its symbol and count) switch groups on and off, several at once. While a
  filter is on, the map says so in yellow over its top left ("2 of 28 · only Cave, Fort", Show
  all), and the line under it says "Showing 2 of 28: show all". The filter is never remembered:
  every visit starts with every place. A group's symbol sits inside its pins, from the group's
  name (`groupSymbol` in `src/lib/world-map.ts`; a Block's `symbols` stay for Region).
- **Tap a pin** for a small card in the map (the piece, name, level, Cleared tick, "Open");
  "Open" brings up the full place card. The address holds the place, so a link opens the map
  on that pin.
- **The list stays one tap away** (Map · List), and search on the Block drops the map to
  the matching pins and centers on them.
- **Placing pins** (Builders, in the Workshop): the same map in the place's form, "Tap where
  it is" (tap again to move it), and the preview shows it as players will.
- **Back** closes full screen too, as Escape does.
- **Credit** under the map, small ("Map: Game8"), set with the picture (the hub, 2026-11-09:
  game art is fine, credited to its source).
- **Spoilers**: a place marked spoiler has no pin, and isn't counted, until spoilers are shown,
  as everywhere else. Off-route places are left off the same way.
- Search on the Block still switches to the list for now (pins narrowing to matches is later).

### Kept where

- The picture: a Block setting (`game_blocks.map`: `{ picture, w, h }`), uploaded to its own
  bucket (`map-pictures`, 10 MB); set by moderators, as setups are for now.
- A pin: on the place itself, as `spot: { x, y }` (percent across and down the picture) in its
  content, so it travels with Drafts, votes and history unchanged, and never shows as a stray
  "+" section on cards that don't know about maps.

### Placing pins

- **Each pin is a Draft** (Matt, 2026-11-09): voted and published like any edit.
- **"Map"** (in the Workshop's "In the app", beside Add on a map Block; the app's "3 not on the
  map yet: place them" opens it too, `?pins=<block>`): moderators upload the picture (kept up to
  4096 px on its longer side) and write the credit, then "Save map". Anyone can place pins: the
  places, those not on the map first, in a list; tap a place, tap the map (tap again to move
  it), Undo per place. "Submit 6 pins" sends one Draft per place. Drafts are limited to 20 an
  hour, so anything over that stays on the device ("8 wait on this device: send them later").
  Places with an open Draft say so, so two Builders don't place the same one.
- **One place's form** (Fix or Add): a "Where on the map" box with the same map, tap to place.
- "What changes" says "Put on the map" or "Moved on the map".

### Code

`src/lib/world-map.ts` (checking the picture and pins, moving and zooming, grouping pins; tested),
`src/components/world/` (`MapCanvas.tsx` the frame, gestures and pins; `PictureMap.tsx` the Places
Block's map and the pin's card; `MapSpotInput.tsx` "Where on the map" in the form),
`src/app/g/[game]/workshop/MapSetup.tsx` (the Workshop's Map editor), and the sample page
`/lab/map` (a made-up world, not linked). Shared parts, with the hub's go-ahead (2026-11-09):
`types.ts` (`BlockMap`, `map`, `spot`), `app-data.ts`, `Blocks.tsx` (Open for a pin),
`Workshop.tsx` (the Map button and editor), `EntryForm.tsx` (the spot box; `clean()` keeps a spot
only as two numbers 0 to 100), `changes.ts` ("Put on the map", "Moved on the map"),
`useWorkshop.ts` (the bucket), `schema-check.mjs`.

## Build plan (slice 1: the map)

1. **Database** (`supabase/migrations/20261110000000_world_map.sql`, reviewed by the hub, run by Matt 2026-11-09):
   `game_blocks.map`, and the `map-pictures` bucket (moderators upload).
2. `src/lib/world-map.ts` (plain, tested): reading and writing a spot, the picture's address,
   fitting and zooming maths, grouping close pins into a count.
3. `src/components/world/PictureMap.tsx`: the map in the Block (fit, zoom buttons, two-finger
   move on phones, Ctrl+wheel on computers, full screen), pins as pieces (outline until cleared),
   the pin's small card with Cleared and Open. `MapBlock.tsx` shows it when the Block has a
   picture, else the region tiles.
4. `src/app/g/[game]/workshop/MapSetup.tsx`: "Set up map" (moderators: the picture) and "Place
   pins" (anyone signed in: pins as Drafts).
5. The place's form: "Where on the map".
6. Check on the production build at desktop and phone sizes with a sample picture (`/lab/map`),
   since Fortune's Weave has no map picture until a moderator adds one.

## Later

- Builders arrange region tiles on a grid (rough geography, our own layout).
- Pins for other things: chests, foes, characters, as layers to switch on and off.
- A map per dungeon (its floors), opened from the place's card.
- A tick per chest or material.
- "Farm this": search a material and see every place and foe that gives it, best first.
- Places and foes on a guide ("You'll go through: Nemea Cavern").
