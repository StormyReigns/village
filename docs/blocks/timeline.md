# Block: Timeline

**Status:** Live, first version; Set up added 2026-11-21 · **Chat:** none yet (started from the Builder-readiness
chat) · **Code:** `Timeline` in `src/components/app/Blocks.tsx`, `src/components/app/ListFields.tsx`,
`TIMELINE_FIELDS` / `extraFields` in `src/lib/fields.ts`

## What it's for

The game in order: the story's parts (Fortune's Weave · Story) or the dungeons (Ocarina · Dungeons). The player
picks it up between parts, planning: "what's next, and what will I find there?" Done is knowing the next part,
its boss and what it gives, in under a minute.

## What a player sees

A path of cards, each with its place in the order in a piece. "Part I: The mine" puts "Part I" above the title.
Fields from Set up show as short lines between the title and the description ("Boss · Queen Gohma", "You get ·
Fairy Slingshot · Kokiri Emerald"). Spoiler fields stay covered until tapped. Route-only parts carry their route.

## Fields

Nothing is set up by default, and then it's exactly as before. Set up offers (`TIMELINE_FIELDS`), all off
until switched on: When (when), Where (place), Boss (short text), You get (list), and the Description (on).
Builders add their own of the same kinds as a Checklist. The order stays each entry's own Order number.

## Builders

Set up opens on the Workbench with a sample card ("Chapter 3: The old mine"). Moderators save; anyone else
signed in sends it as a setup Draft (docs/workshop.md). Once set up, adding or fixing an entry asks for each
field by name.

## Decisions

- 2026-11-21: Set up added, from Matt's Ocarina early-Builder review: fields as short lines under the title,
  starters When, Where, Boss, You get. Why: the answer ("which boss, what do I get") is on the card without
  opening anything.

## Open questions

- Should a Timeline mark where the player is (a tick per part, like a Checklist)?
