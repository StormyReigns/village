# Links between Blocks (shared by every Block)

**Status:** Building (2026-11-12): slice 1, one way to link, today's links moved onto it · **Chat:**
`Village · Links between Blocks` · **Mockup:** none yet · **Code:** `src/lib/entry-links.ts` (plain
and tested: what a links field points at, what its other side is called, the other side worked
out), `src/lib/fields.ts` (`FieldDef.to`, `FieldDef.back`), `src/components/app/CharacterCard.tsx`
(draws both sides) · **Database:** none (a Block's fields are already stored as jsonb, and links
are text lines on entries).

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

A field of the kind **Links** points at a Block: this same one (Relationships, Made from, Leads
to) or any other Block in the game (Places, Characters, Items, Classes). It has two names:
- its own, on the cards that type it: "Where to get it";
- its **other side**, on the cards it names, worked out: "Items here". No other-side name, no
  other side (Relationships today).

The other Block's Set up shows the other side as a row of its own ("Items here, worked out, from
Items"), on by default, which its builders can move or switch off like any field. (Slice 2.)

### For contributors (typing an entry)

The same "Name: note" lines as every links field today ("Nemea Cavern: in a chest", "Iron Ore: 3").
Names are suggested from the Block it points at. (Slice 3: a name that's in no entry yet shows as
the split outline, "not built yet", with "add it".)

### For players (a card)

Linked entries show as small pieces in their Page's color with the note beside them; a tap opens
that entry, on its own Page if need be. The other side shows under its own heading, right after
the field it comes from on the other Block, in the order that Block's builders set.

## Rules

1. **Typed once, shown on both sides.** Type it where the fact is usually written down: items name
   their places, foes name where they are, classes name who can take them. If both sides do type
   it, the lists merge and nobody sees a name twice.
2. **Both ways the same** (Relationships): when a field's other side has its own name, that's the
   heading; a field can instead show both ways under one heading (Alice lists Bob, so Bob's card
   shows Alice too). (Slice 2.)
3. **One or many.** A single link sits under the name with a pin (a character's Location, a foe's
   Where); several are a list of pieces. (Slice 3.)
4. **Spoilers and routes carry over.** An entry hidden as a spoiler or off the player's route stays
   hidden on the other side too.
5. **Linked by name, inside the Block it points at.** Two Blocks can share a name (a town and a
   character) without mixing up. A name matches whatever its case. (Slice 3: renaming an entry
   offers to update the lines that point at it, in the same Draft.)
6. **Worked-out matches are not links.** "Classes for Ash" and "Who suits it"
   (`src/lib/class-fit.ts`) come from shared numbers, not from anyone typing a link. They stay their
   own feature; later they can use "Who can take it" to leave out classes a unit can't take.

## Today's links, on the one pattern

| Field | Block | Points at | Other side |
|---|---|---|---|
| Relationships | Characters | itself | none (slice 2: both ways the same) |
| Made from | Items | itself | Used to make |
| Upgrades to | Items | itself | Upgrades from |
| Leads to | Classes | itself | Comes from (plus the path worked out from skill ranks, `src/lib/classes.ts`) |
| Where to get it | Items | Places (slice 2; text until then) | Items here |
| Where | Foes | Places (World spec) | Foes here |
| Location | Characters | Places (slice 3, one link with a pin) | People here |
| Who can take it | Classes | Characters (slice 2) | Classes |

Blocks set up before this keep working: a links field with no `to` points at its own Block, and
the other sides above have defaults by key, so Made from still shows Used to make without anyone
touching Set up.

## Slices

1. **One way to link** (2026-11-12, this): `FieldDef.to` and `FieldDef.back`; one helper that works
   out every other side (`otherSides` in `src/lib/entry-links.ts`); the card draws both sides the
   same way. Items' Used to make and Upgrades from, and Classes' Comes from, moved onto it. No
   visible change.
2. **Across Blocks**: in Set up, a links field picks the Block it points at and names its other
   side; the other Block's Set up gets the worked-out row. A server-side helper hands each card its
   links across Pages (the way `classKin` hands over units and classes), with each entry's Page,
   color and picture, so a tap opens it there. Then Items → Places and Classes → Characters.
   Relationships both ways the same.
3. **Polish**: one link with a pin under the name; "not built yet" outlines and "add it" in the
   Workshop; renames offer to update links; a long other side (a big town's 40 items) shows the
   first few with "see all".

## Decisions

- 2026-11-12: One field kind, Links, points at any Block (or its own), with an optional name for
  the other side. Why: every link so far was one-off code, and Places would have added more.
- 2026-11-12: Links stay "Name: note" text lines, matched by name inside the Block they point at.
  Why: they're typed, pasted from spreadsheets and edited as Drafts like everything else; no new
  tables, no database change.
- 2026-11-12: The stat match between units and classes stays separate. Why: it's worked out from
  numbers, not typed, and only makes sense for some games.

## Open questions

- Where the other side sits on the card when its Block hasn't placed it: at the end, before Videos
  (proposed), or after a field the builder picks. Matt, in slice 2.
- Whether a link can point at a Block in another game (a series' shared characters). Not for now.
