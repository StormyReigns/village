# Links between Blocks (shared by every Block)

**Status:** Building (2026-11-12): slices 1 and 2 live, links work across Blocks and Pages · **Chat:**
`Village · Links between Blocks` · **Mockup:** none yet · **Code:** `src/lib/entry-links.ts` (plain
and tested: what a links field points at, what its other side is called, the other side worked
out, `blockLinks` for links across Pages), `src/data/pages/types.ts` (`FieldDef.to`, `back`,
`both`), `src/components/app/EntryLinks.tsx` (the provider and the linked piece),
`src/components/app/CharacterCard.tsx` (draws both sides), `src/app/g/[game]/workshop/FieldSetup.tsx`
(`LinkSetup`) · **Database:** none (a Block's fields are already stored as jsonb, and links are
text lines on entries).

Not a Block of its own: the one way any Block's entries point at entries in another Block, or in
the same one. Written up here with the Blocks because every Block uses it.

## What it's for

Matt (2026-11-12): "I may want to add Locations to items or characters, and characters and items
to the Locations details. How do we make this plug'n'play and repeatable?"

Before this, every link was built on its own: Relationships and Made from could only point inside
their own Block; Items worked out "Used to make" with their own code; Classes worked out "Comes
from" with other code; a character's Location, an item's "Where to get it" and a class's "Who can
take it" were plain text you couldn't tap. Adding Places would have been a fifth one-off.

### The moments (from the intuitive-design steps)

| | Following a link: "where is that?" (primary) | Typing an entry: "it's found in…" | Setting up: "items should name their places" |
|---|---|---|---|
| **Who** | Any player | A contributor writing or fixing an entry | A builder in Set up |
| **Trigger** | A card names a place, a person or an item they care about | Adding an item and its sources | A new Block (Places) arrives, or the game links things in a way Village doesn't yet show |
| **State** | Curious or in a hurry, game paused | Focused, often copying from notes or a wiki | Thoughtful, has time |
| **What they know** | The name on the card | The names, roughly spelled | Which Blocks the game has |
| **Done looks like** | One tap, and they're on that entry's card, even on another Page | Typed it once; both cards show it | One choice, and both Blocks know about it |
| **Time** | A tap | Seconds per line | Under a minute |

Real-world signal (general knowledge, and the World spec's notes): a wiki's foes and items for a
place sit on other pages you have to cross-check; the same fact is typed on two pages and drifts
apart; links lead to "page not found".

What this means for the design:
- **Typed once, shown on both sides.** Nobody types the same fact twice, so it can't drift.
- **One look everywhere.** A link is a small piece in the other Page's color, its name beside it,
  the note in gray, tappable. A worked-out other side looks exactly the same.
- **Plug'n'play.** A builder makes one choice ("links to Places, the other side is called Items
  here") and both Blocks pick it up. No code per pair of Blocks.
- **No dead ends.** A name that matches nothing stays plain text in the app; in the Workshop it
  shows as "not built yet" (the split outline) with a way to add it.

## How it works

### For builders (Set up)

Under every list or links field of a Characters, Items or Classes Block (not Guides yet), one line:
**Names point at**: "Nothing: a plain list", "This Block", or any other Block in the game with
entries (shown as "Page · Block"). Switching keeps every entry's value, since a list and a links
field are both "Name: note" lines. When it points somewhere, a second line names the **other
side**, as it reads on the cards it names: "On Places cards, called: Items here". Left empty, there's
no other side (except the defaults for Made from, Upgrades to and Leads to). A field pointing at its
own Block can instead show **both ways, under this name** (on by default for Relationships).

The Block it points at lists it in its own Set up, under "Also on these cards, worked out" ("Items
here, from Items' Where to get it"), so its builders know where it comes from. For now it always
shows after that card's own fields; moving or hiding it there comes in slice 3.

### For contributors (typing an entry)

The same "Name: note" lines as every links field today ("Nemea Cavern: in a chest", "Iron Ore: 3").
Names are suggested from the Block it points at, and the boxes say "Name" and "A note" rather than
"Which item" or "Who". (Slice 3: a name that's in no entry yet shows as the split outline, "not
built yet", with "add it".)

### For players (a card)

Linked entries show as small pieces in their Page's color with the note beside them; a tap opens
that entry, on its own Page if need be. A name that matches no entry there (or a spoiler one) shows
as a piece with initials that doesn't open. An other side from the same Block sits right after the
field it comes from ("Used to make" under "Made from"). An other side from another Block sits after
the card's own fields, before the class match and Videos (proposed 2026-11-12). On a map's places
(World), typed links come first in the place's "What's here", above the names found in text.

## Rules

1. **Typed once, shown on both sides.** Type it where the fact is usually written down: items name
   their places, foes name where they are, classes name who can take them. If both sides do type
   it, nobody sees a name twice.
2. **Both ways the same** (Relationships): instead of an other side, a field inside its own Block
   can show both ways under one heading (Alice lists Bob, so Bob's card shows Alice too). The
   mirrored name comes without its note, since "Sister" said from Alice's side is wrong on Bob's.
3. **One or many.** A single link sits under the name with a pin (a character's Location, a foe's
   Where); several are a list of pieces. (Slice 3.)
4. **Spoilers and routes carry over.** Spoiler entries never show on the other side, nor open from a
   link; an other side follows the player's route. Links typed on a card always show, since its
   writer put them there.
5. **Linked by name, inside the Block it points at.** Two Blocks can share a name (a town and a
   character) without mixing up. A name matches whatever its case. (Slice 3: renaming an entry
   offers to update the lines that point at it, in the same Draft.)
6. **Worked-out matches are not links.** "Classes for Ash" and "Who suits it"
   (`src/lib/class-fit.ts`) come from shared numbers, not from anyone typing a link. They stay their
   own feature; later they can use "Who can take it" to leave out classes a unit can't take.

## Today's links, on the one pattern

| Field | Block | Points at | Other side |
|---|---|---|---|
| Relationships | Characters | itself | both ways, under its own name |
| Made from | Items | itself | Used to make |
| Upgrades to | Items | itself | Upgrades from |
| Leads to | Classes | itself | Comes from (plus the path worked out from skill ranks, `src/lib/classes.ts`) |
| Where to get it | Items | a plain list until a builder points it at Places | Items here |
| Where | Foes | Places (World spec) | Foes here |
| Location | Characters | Places (slice 3, one link with a pin) | People here |
| Who can take it | Classes | short text; a builder can add a links field pointing at Characters | Classes |

Blocks set up before this keep working: a links field with no `to` points at its own Block, and
the other sides above have defaults by key, so Made from still shows Used to make without anyone
touching Set up. Fortune's Weave's "Where to get it" holds sentences ("Valhalla Mine hunting
grounds."), not place names, so pointing it at Places only pays once its lines are written as
names ("Valhalla Mine: hunting grounds").

## Slices

1. **One way to link** (2026-11-12, 219b0ca): `FieldDef.to` and `FieldDef.back`; one helper that
   works out every other side (`otherSides` in `src/lib/entry-links.ts`); the card draws both sides
   the same way. Items' Used to make and Upgrades from, and Classes' Comes from, moved onto it. No
   visible change.
2. **Across Blocks** (2026-11-12): in Set up, a list or links field picks the Block it points at and
   names its other side; the Block it points at lists it. `blockLinks` works out on the server what
   each Page's cards need (the entries their links point at, and other sides from elsewhere, with
   each entry's address, picture and Page color), handed down by `LinksProvider`. The entry form
   suggests names from the Block a field points at. Relationships both ways. A map's places get
   typed links in "What's here".
3. **Polish**: one link with a pin under the name; "not built yet" outlines and "add it" in the
   Workshop; renames offer to update links; a long other side (a big town's 40 items) shows the
   first few with "see all"; moving or hiding an other side in the Set up of the Block it shows on;
   other sides on Collections other than maps (Foes, until World makes them a fields Block).

## Decisions

- 2026-11-12: One field kind, Links, points at any Block (or its own), with an optional name for
  the other side. Why: every link so far was one-off code, and Places would have added more.
- 2026-11-12: Links stay "Name: note" text lines, matched by name inside the Block they point at.
  Why: they're typed, pasted from spreadsheets and edited as Drafts like everything else; no new
  tables, no database change.
- 2026-11-12: The stat match between units and classes stays separate. Why: it's worked out from
  numbers, not typed, and only makes sense for some games.
- 2026-11-12: An other side from another Block shows after the card's own fields, before the class
  match and Videos. Why: proposed to Matt, who went ahead with slice 2 on it; the card's own facts
  come first.
- 2026-11-12: The Block an other side shows on lists it in Set up but can't move it yet. Why:
  storing a placed row in that Block's fields would touch every place that reads fields (the entry
  form, samples, spreadsheets); a plain default first.
- 2026-11-12: A mirrored Relationships name drops its note. Why: notes describe the link from the
  writer's side.

## Open questions

- Whether a link can point at a Block in another game (a series' shared characters). Not for now.
