@AGENTS.md

# Village: notes for working on this project

Matt is building this. He relies on Claude for the tech; explain choices in plain words.

## What it is

Community-built companion apps for games, with a village theme. Two layers:
- **Workshop** (community layer): one chat per game, Page chips across the top (a symbol
  each, "Everything" first, with counts, plus the Notice Board), and a Drafts panel whose cards are live
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
- **Look** (agreed 2026-10-25; replaces "soft and illustrated"): clean and slightly goofy,
  for every kind of gamer. The frame is flat and quiet; the piece is the brand. Mockups:
  the "Block Silhouettes" canvas (https://claude.ai/artifact/5Zz5xxgX5BFR1Y8PkMyjJ3),
  boards 13 to 15. Rolled out across the site 2026-10-25; the village theme lives in the
  words (Workshop, Notice Board, Market Day). One illustration: the front page banner
  (`public/village/banner.jpg`, added 2026-10-26), which is that page's header.
- **Data**: our own words, sources cited, no game art or leaks; contributions under CC BY-SA.

## Brand rules

- **The piece** (`src/components/Piece.tsx`): one cut-corner block with dovetail sockets
  (top, left) and tabs (bottom, right). Only scaled, never stretched. It is the logo, every
  entry, every Page symbol's backing, and tick boxes. Pages and Blocks are never pieces.
- **The slice**: one band through the middle always slides right by the same amount, on
  the piece and on the "village" wordmark.
- **Text never crosses the slice**: inside a piece only short initials or a symbol, sitting
  below the band. Names go under the piece in ink, like an app-icon label.
- **Pieces never lock together in layouts**: leave a clear gap so tabs don't reach a
  neighbour.
- **Solid = built, split outline = not built yet**: an empty slot, an unticked box or "add"
  is an outline with pink (#ff2bd6) and violet (#8b3dff) offset copies. The split is also
  the loading look, and the banner logo on the front page (`glitch` on `Piece` and
  `Wordmark`) is its one loud use. Other solid pieces are one color.
- **Colors**: ink #15171c and signal yellow #FFC53D frame every screen (ink top bar,
  yellow piece logo). Yellow means "act on this" or "your choice". One standard color per
  Page in every game; a game's genre may shift the shade, never the hue. Each game picks a
  `shade` in `src/data/games.ts` (standard, cozy, fantasy, shooter, openworld; table in
  `src/lib/shades.ts`); `GameShade` applies it to that game's screens only, and share
  pictures use it too. Fortune's Weave and Ocarina of Time are fantasy.
- **Three levels**: a Page is its color as a light tint behind the screen, a Block is a
  white panel, an entry is a solid piece in the Page color. Each Page has its own symbol;
  in navigation the current one sits inside a piece.
- **Type**: Rubik only, heavy for names, regular for reading.
- **In code**: `Piece` (any width or `size="fill"`, `outline`, `image`), `NavSymbol` and
  `EntryIcon` for Page symbols and entries, `Wordmark` and `TopBar` in `Logo.tsx`, colors
  as CSS variables in `globals.css` (`--signal` is the yellow, `btn-primary` the main
  button). Check shapes at `/lab/brand`. Share pictures (`src/lib/og-card.tsx`) draw the
  piece with plain SVG and use the Rubik files in `src/lib/og-fonts` (next/og can't use
  the variable font).

## Working notes

- Next.js 16 with Cache Components: `params` are promises. Read URL data inside
  `<Suspense>`. Compute dates in client components so pages can prerender.
- Run `npm test` after changing the schema or Standouts; `npm run build` before committing.
- The game app reads from the database (`src/lib/app-data.ts`, cached, refreshed when a
  moderator publishes). Starter Pages live in `src/data/pages/`; `npm run db:seed-app`
  turns them into `supabase/seed-app.sql`, which is safe to rerun and never overwrites
  community edits. Matt runs SQL in Supabase's SQL Editor; the build needs it applied.
- The folder name has a capital V, so npm-created packages go in lowercase subfolders.
