# Block: Checklist

**Status:** Live, first version; Set up added 2026-11-21 · **Chat:** none yet (started from the Builder-readiness
chat) · **Code:** `Checklist` in `src/components/app/Blocks.tsx`, `src/components/app/ListFields.tsx`,
`CHECKLIST_FIELDS` / `rowFields` / `groupField` in `src/lib/fields.ts`, `src/lib/deadline.ts`

## What it's for

Things to tick off: Last chances (things you can miss forever, each with a deadline) and Collectibles (Gold
Skulltulas, Pieces of Heart). The player picks it up mid-game, a little anxious, about to leave a place or end
a chapter: "did I miss anything here?" Done is seeing what's left here, ticking it, and going back to playing,
in under 30 seconds.

## What a player sees

- A ring with how many are done, then one row per thing: a tick box (a piece: split outline until ticked,
  then solid with the snap), the name, the deadline with an hourglass, and up to two fields from Set up as
  small chips (a place with a pin, a time with a clock, a tag as a pill, anything else "Name: value").
- With deadlines: in deadline order, the first one marked "Next up" (`src/lib/deadline.ts`). Choose-one last
  chances list each option and who in your party it helps.
- With no deadlines and a group field set: grouped by it, in the field's own order of choices, each group
  saying "1 of 3 left".
- Ticked ones go to "Done". Tapping a row opens every field.

## Fields

Nothing is set up by default, and then it's exactly as before. Set up offers (`CHECKLIST_FIELDS`):

| Field | Key | Kind | On by default | Where it shows |
|-------|-----|------|---------------|----------------|
| Deadline | `Before` | when | yes | the hourglass on the row; sorting and "Next up" |
| Where | `Where` | place | no (on the row once switched on) | a chip; can group the list |
| How to get it | `How to get it` | long text | no | when tapped |
| Reward | `Reward` | list | no | when tapped, or a chip |
| Description | the entry's description | long text | yes | when tapped |

Builders add their own: short text, number, tag, place, when, list, long text, yes or no. The deadline keeps
the key every Last chance already uses, so renaming it keeps its sorting.

## Builders

Set up opens on the Workbench with a sample ("Silver token") as a row, plus what tapping it shows. The rows
button on a field puts it on each row (two at most). A place or tag field has "Group the list by … when
nothing on it has a deadline" (one at most). Moderators save; anyone else signed in sends it as a setup Draft
(docs/workshop.md). Once set up, adding or fixing an entry asks for each field by name.

## Decisions

- 2026-11-21: Set up added, from Matt's Ocarina early-Builder review. Two fields on the row, the rest on tap;
  a list with no deadlines groups by a place or tag; starters Deadline, Where, How to get it, Reward (Matt
  picked all four suggestions). Why: Collectibles have no deadlines, only places, and "the ones in this
  dungeon" is the question. Rows stay quick to scan.

## Open questions

- Grouped lists have no "Next up". Should the player's current place come first (from the map, or a pick)?

## Later

- Counts per place on the World map ("3 Skulltulas left here").
