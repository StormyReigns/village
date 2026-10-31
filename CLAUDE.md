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
- **Building it** (from 2026-10-29): one genre first (fantasy and adventure), one Block at a
  time. Block 1 is **Characters** (`src/components/app/Characters.tsx`): Profiles (a strip
  of pieces above one card) by default, or a List; each device remembers which, per Block.
  The card is laid out by the Block's `fields` (`src/lib/fields.ts`): common ones to switch,
  rename and reorder, plus builders' own, all optional. Values live on entries as they
  always have (tags as categories, the rest as sections under the field's key), so Drafts
  work unchanged. Builders set fields up in the Workshop ("Set up", with a "John Doe"
  preview); moderators save for now, voting on setups comes later.
- **Block specs** (`docs/blocks/`, from 2026-10-31): one file per Block, the source of truth
  for its purpose, fields, layout, decisions and open questions; the roadmap and how we
  work are in `docs/blocks/README.md`. Each Block gets its own chat ("Village · Block:
  <name>"), which reads its file first and updates it as things are decided. Changes to
  parts every Block shares (the piece, `src/lib/fields.ts`, the entry panel, the Workshop,
  the database) go through the hub chat, "Village · Main". Only one Block chat builds at
  a time.

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
- **Data**: our own words, sources cited, no leaks; contributions under CC BY-SA. Game art
  (portraits, icons) is preferred, credited to its source, and left out only where using it
  would be a legal problem (agreed 2026-10-29; replaces "no game art"). Without art, an
  entry's piece shows its group symbol or initials.

## Brand rules

- **The logo** (agreed 2026-10-29): a navy house with a yellow flag in a ring of five genre
  tiles (fantasy, shooter, open world, platformer, racing), Matt's picture
  `public/village/logo.png`, next to the "village" wordmark. It is used in the top bar, the
  front page banner, the tab and phone icons, and the corner of share pictures. Matt's
  one-color version is for later; it turns to noise below about 64px. A designer brief for a
  cleaner redraw: https://claude.ai/artifact/DLc7FovwZVqYeShr4JQgwJ
- **The piece** (`src/components/Piece.tsx`, outline in `src/lib/piece.ts`): the logo's
  silhouette, the house in its ring of genre tiles, as one flat shape (Matt's
  `logo-silhouette-*.svg`, agreed 2026-10-31; replaces the cut-corner dovetail block). Only
  scaled, never stretched. It is every entry, every Page symbol's backing, and tick boxes.
  Pages and Blocks are never pieces. Entries show a group symbol (a Block's `symbols`, e.g.
  one per faction) when set, else initials.
- **Never blank**: a solid piece with no picture, symbol or initials has "village" cut out
  of it (a lone "v" under 64px), plain: the letters just show what's behind, no added
  color, with the wordmark's slice. The cutout is made once by `scripts/build-cutout.ts`
  into `src/lib/piece-cutout.ts`; rerun it if the outline changes.
- **The slice**: one band through the middle of the letters slides right, on the "village"
  wordmark and the cutout. The one signature motion: when something turns solid (a tick), a
  band of the piece snaps into place (`snap` on `Piece`).
- **Inside a piece** only short initials or a symbol, in the middle. Names go under the
  piece in ink, like an app-icon label.
- **Pieces never touch in layouts**: leave a clear gap between them.
- **Solid = built, split outline = not built yet**: an empty slot, an unticked box or "add"
  is an outline with pink (#ff2bd6) and violet (#8b3dff) offset copies. The split is also
  the loading look. Solid pieces are one color. (`glitch` on `Piece` and `Wordmark`, a
  yellow and violet split, was the old banner logo's look and is unused for now.)
- **Colors**: ink #15171c and signal yellow #FFC53D frame every screen (ink top bar,
  yellow main button). Yellow means "act on this" or "your choice". One standard color per
  Page in every game; a game's genre may shift the shade, never the hue. Each game picks a
  `shade` in `src/data/games.ts` (standard, cozy, fantasy, shooter, openworld; table in
  `src/lib/shades.ts`); `GameShade` applies it to that game's screens only, and share
  pictures use it too. Fortune's Weave and Ocarina of Time are fantasy.
- **Three levels**: a Page is its color as a light tint behind the screen, a Block is a
  white panel, an entry is a solid piece in the Page color. Each Page has its own symbol;
  in navigation the current one sits inside a piece.
- **Type**: Rubik only, heavy for names, regular for reading.
- **In code**: `Piece` (any width or `size="fill"`, `outline`, `image`), `NavSymbol` and
  `EntryIcon` for Page symbols and entries, `LogoMark`, `Wordmark` and `TopBar` in `Logo.tsx`, colors
  as CSS variables in `globals.css` (`--signal` is the yellow, `btn-primary` the main
  button). Check shapes at `/lab/brand`. Share pictures (`src/lib/og-card.tsx`) draw the
  piece with plain SVG and use the Rubik files in `src/lib/og-fonts` (next/og can't use
  the variable font) and the logo in `src/lib/og-art`. The tab and phone icons are the
  plain files `src/app/icon.png` and `apple-icon.png`.

## Working notes

- Next.js 16 with Cache Components: `params` are promises. Read URL data inside
  `<Suspense>`. Compute dates in client components so pages can prerender.
- Run `npm test` after changing the schema or Standouts; `npm run build` before committing.
- The game app reads from the database (`src/lib/app-data.ts`, cached, refreshed when a
  moderator publishes). Starter Pages live in `src/data/pages/`; `npm run db:seed-app`
  turns them into `supabase/seed-app.sql`, which is safe to rerun and never overwrites
  community edits. Matt runs SQL in Supabase's SQL Editor; the build needs it applied.
- The folder name has a capital V, so npm-created packages go in lowercase subfolders.
