# Links between Blocks (shared by every Block)

**Status:** Live (2026-11-12): slices 1 to 3, links across Blocks and Pages, places, renames, placement · **Chat:**
`Village · Links between Blocks` · **Mockup:** none yet · **Code:** `src/lib/entry-links.ts` (plain
and tested: what a links field points at, what its other side is called, the other side worked
out, `blockLinks` for links across Pages), `src/data/pages/types.ts` (`FieldDef.to`, `back`,
`both`), `src/components/app/EntryLinks.tsx` (the provider and the linked piece),
`src/components/app/CharacterCard.tsx` (draws both sides), `src/app/g/[game]/workshop/FieldSetup.tsx`
(`LinkSetup`, other-side rows), `CharacterInputs.tsx` (`NotBuilt`), `EntryForm.tsx` (rename fixes) · **Database:** none (a Block's fields are already stored as jsonb, and links are
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

Under every list, links or place field of a Characters, Items or Classes Block (not Guides yet), one line:
**Names point at**: "Nothing: a plain list", "This Block", or any other Block in the game with
entries (shown as "Page · Block"). Switching keeps every entry's value, since a list and a links
field are both "Name: note" lines. When it points somewhere, a second line names the **other
side**, as it reads on the cards it names: "On Places cards, called: Items here". Left empty, there's
no other side (except the defaults for Made from, Upgrades to and Leads to). A field pointing at its
own Block can instead show **both ways, under this name** (on by default for Relationships). A place
field (a character's Location) offers "Nothing: just words" or another Block: then its one name, under
the card's name with the pin, opens that entry; it can name an other side too ("People here").

The Block it points at gets a row for it in its own Set up, among its fields ("Items here · Worked out
from Items' Where to get it. Named in its Set up"), with an on/off switch and up and down arrows, so
its builders choose where it sits on their cards or hide it. Until they move it, it shows after the
card's own fields. The row is kept in that Block's fields as `@from:<block>.<field key>`, which
`fieldsOf` leaves out, so nothing else mistakes it for a field. (A map Collection has no Set up yet,
so Places can't place theirs.)

### For contributors (typing an entry)

The same "Name: note" lines as every links field today ("Nemea Cavern: in a chest", "Iron Ore: 3").
Names are suggested from the Block it points at, and the boxes say "Name" and "A note" rather than
"Which item" or "Who". A name that's in no entry there yet gets the split outline, "Not in Places
yet", and **Add it**, which opens the Workshop in a new tab with that entry started and the name
filled in, so the form being written stays as it is.

**Renames.** Fixing an entry's name shows who links to the old one ("2 entries link to Old Mine:
Fire Gem, Ice Gem") with a ticked box: "Also suggest changing their links to Deep Mine, each as a
small Draft of its own". Drafts are one entry each, so the fixes go along as their own Drafts (up to
10; more is a job for a batch), voted on like any change, notes kept.

### For players (a card)

Linked entries show as small pieces in their Page's color with the note beside them; a tap opens
that entry, on its own Page if need be. A name that matches no entry there (or a spoiler one) shows
as a piece with initials that doesn't open. A list longer than 8 shows the first 8 and "See all 40".
A place link is the name itself, underlined, beside the pin. An other side from the same Block sits right after the
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
   Where); several are a list of pieces.
4. **Spoilers and routes carry over.** Spoiler entries never show on the other side, nor open from a
   link; an other side follows the player's route. Links typed on a card always show, since its
   writer put them there.
5. **Linked by name, inside the Block it points at.** Two Blocks can share a name (a town and a
   character) without mixing up. A name matches whatever its case. Renaming an entry offers to send
   fixes for the lines that point at it.
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
| Location | Characters | just words until a builder points it at Places (one link with a pin) | People here |
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
3. **Polish** (2026-11-12): a place field can point at a Block (one link with a pin); "not built
   yet" outlines and Add it in the entry form; renames offer link fixes as their own Drafts; lists
   past 8 get "See all"; other sides get rows in the Set up of the Block they show on, to move or
   hide.

**Later:** other sides on Collections other than maps (Foes, until World makes them a fields Block);
Places' own Set up rows once Places is a fields Block; Guides' "Names point at".

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
- 2026-11-12: An other side is placed by a row in the fields of the Block it shows on, keyed
  `@from:`, which `fieldsOf` leaves out. Why: builders place it like any field, and no new column
  (no database change); filtering in one place keeps the entry form, samples and spreadsheets from
  seeing it.
- 2026-11-12: A rename sends link fixes as separate Drafts, not one. Why: a Draft is one entry; each
  fix is voted on and can be rolled back on its own.
- 2026-11-12: Add it opens a new tab. Why: the Workshop has one form at a time, and switching would
  risk the one being written.
- 2026-11-12: A mirrored Relationships name drops its note. Why: notes describe the link from the
  writer's side.

## Open questions

- Whether a link can point at a Block in another game (a series' shared characters). Not for now.
