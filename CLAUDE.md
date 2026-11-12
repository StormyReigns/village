@AGENTS.md

# Village: notes for working on this project

Matt is building this. He relies on Claude for the tech; explain choices in plain words.

## What it is

Community-built companion apps for games, with a village theme. Two layers:
- **Game app**: Pages (topics, like "Units" or "Classes") made of preset Blocks (Characters,
  Items, Classes, Guides, Tier lists, Collection, Checklist, Timeline...), nothing freeform.
  Entries are pieces. Routes (e.g. Flame Lords) are a game setting a Block can differ by.
  Data lives in the database (`src/lib/app-data.ts`). A Block's card layout comes from its
  `fields` (`src/lib/fields.ts`), set up by builders in the Workshop ("Set up").
- **Workshop**: one per game. A chat beside a work column ("Drafts" and "In the app"),
  with Pages as folder tabs. Entry edits are Drafts, voted on and published by moderators.

What each Block does, and where it's used: the roadmap, `docs/blocks/README.md`, and one spec per
Block in `docs/blocks/` (the source of truth: read the Block's spec before working on it).
Integrations (phone app, Discord, Spreadsheets, wiki links) have specs there too.

## How we work (leaner from 2026-11-12)

- **One chat per Block or integration** (`Village · Block: <name>`). It reads its spec first,
  keeps it updated, and reports to Matt directly.
- **The hub** (`Village · Main`) keeps the roadmap and reviews **database changes only** (new
  migrations, RLS, triggers, SQL functions) before Matt runs them. Its notes, and the review
  checklist, are in `docs/hub.md`.
- **Shared code needs no go-ahead.** Check `git status` first, stage only your own files by name,
  and name the shared files you touched in the commit message.
- **One check per change.** Whoever pushes checks the deploy and the live site, once.
- **Model by task.** The big model for design and database work, Sonnet for small fixes and notes.
  When a chat gets long, start a fresh one from its spec.

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
  Page in every game (seven: berry, sun, plum, sky, teal, leaf and indigo, added for Classes 2026-11-11); a game's genre may shift the shade, never the hue. Each game picks a
  `shade` in `src/data/games.ts` (standard, cozy, fantasy, shooter, openworld; table in
  `src/lib/shades.ts`); `GameShade` applies it to that game's screens only, and share
  pictures use it too. Fortune's Weave and Ocarina of Time are fantasy.
- **Three levels**: a Page is its color as a light tint behind the screen, a Block is a
  white panel, an entry is a solid piece in the Page color. Each Page has its own symbol;
  in navigation the current one sits inside a piece.
- **The Workbench** (agreed 2026-10-31): editors in the Workshop sit on a faint dot grid with
  white boxes edged in ink and a yellow ring on the box being typed in (`workbench` in
  `globals.css`). Previews never get special styling: they look exactly like the app (a Page
  tint behind white cards). Dots mean "you're building"; a Page tint means "this is the app".
  On a phone the preview is a sheet under the editor with a drag handle (`split.tsx`). The
  frame is `EditorShell.tsx` (main action and X pinned at the top; closing with unsaved
  changes asks Save draft or Discard). Built into Set up and the character form first; the
  rest of the Workshop follows.
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
  After an SQL data change, delete `.next/cache/fetch-cache` before a local build, or it reuses old
  database answers.
- A Vercel deploy stuck on "pending" can finish later and replace newer ones on the live site
  (2026-11-09). After a stuck deploy, check the live site has the newest code, not just the
  latest commit's status; if it rolled back, push an empty commit.
- The phone app's service worker (`public/sw.js`, production builds only) also runs on the local
  `village-prod` server. After a rebuild, if a page looks old there, unregister it (DevTools →
  Application, or `navigator.serviceWorker.getRegistration().then(r => r?.unregister())`) and reload.
  On the live site pages always come from the network first.
- Vercel skips building commits that only change `docs/` or `*.md` files (`vercel.json`,
  `scripts/vercel-ignore.sh`), to stay inside the free plan's 10 GB of kept deploys. Rebuild commits
  and empty commits still build. A notes-only commit's GitHub status may say "skipped" or stay empty.
- The game app reads from the database (`src/lib/app-data.ts`, cached, refreshed when a
  moderator publishes). Starter Pages live in `src/data/pages/`; `npm run db:seed-app`
  turns them into `supabase/seed-app.sql`, which is safe to rerun and never overwrites
  community edits. Matt runs SQL in Supabase's SQL Editor; the build needs it applied.
- The folder name has a capital V, so npm-created packages go in lowercase subfolders.
