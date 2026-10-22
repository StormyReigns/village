@AGENTS.md

# Village: notes for working on this project

Matt is building this. He relies on Claude for the tech; explain choices in plain words.

## What it is

Community-built companion apps for games, with a village theme. Two layers:
- **Workshop** (community layer): one chat per game, block chips across the top ("All"
  first, with counts, plus the Notice Board), and a Drafts panel whose cards are live
  previews of the app card, showing what changes against Stable.
- **Game app** (top layer): Pages (topics, like "Units and classes") made of Blocks.
  Blocks are preset types, nothing freeform: Collection (icon grid, tap for a detail
  panel, built-in search, A-Z sort and filters), Guide, Checklist, Timeline. New Block
  types come from community requests and are built by us. Collection entries have Name,
  Icon, Description, "+" labeled sections, and filter categories set by the Block.
  Routes (e.g. Flame Lords) are a game setting: a Block can "differ by route", and the
  page then shows a route switcher. Workshop chips are Pages. Entry edits are Drafts;
  Block and Page changes are Drafts with a longer vote plus moderator approval.
  (Agreed 2026-10-21; replaces the per-game block presets in `src/lib/blocks.ts`.)

## Decisions to keep

- **Releases**: Stable by default, Preview for opt-in, rollback per card by moving a
  pointer. Revisions are append-only. The game patch version is tracked separately.
- **Votes**: facts get "I can confirm" / "Seems wrong" and are settled by a source and
  review. Opinions get up/down votes. Totals stay hidden until 5 votes ("leaning yes").
- **Sorts**: Standouts (default; `src/lib/standouts.ts`, mirrored by
  `public.wilson_lower` in SQL), New, Needs votes, Shipped.
- **AI-drafted cards** always need the author's "yes" before posting.
- **Rewards**: the "Village Rewards" doc
  (https://claude.ai/code/artifact/441b94bc-cc93-46a7-952d-da63d5684254). Two-part
  titles (tenure plus role), gray/colored/glowing badges, weekly Market Day.
- **Launch mode** starts open and tightens as needed. From day one: an AI spam check,
  a report button, spoiler tags, rate limits, and a "Theory" label on unconfirmed finds.
- **Look**: soft and illustrated, never plain-text. The village theme goes in the frame;
  Drafts and cards look like the game's app.
- **Data**: our own words, sources cited, no game art or leaks; contributions under CC BY-SA.

## Working notes

- Next.js 16 with Cache Components: `params` are promises. Read URL data inside
  `<Suspense>`. Compute dates in client components so pages can prerender.
- Run `npm test` after changing the schema or Standouts; `npm run build` before committing.
- The folder name has a capital V, so npm-created packages go in lowercase subfolders.
