# Spreadsheets (an integration)

**Status:** Download live (2026-11-09); paste-in designed · **Chat:**
`Village · Spreadsheets` · **Mockup:** none yet · **Code:** `src/lib/sheets.ts` (a Block as rows
and columns, CSV and copied rows; tested), `src/lib/xlsx.ts` (a small .xlsx writer, no library;
tested), `src/components/sheets/SheetButton.tsx` (the Download menu) · **Database:** nothing for
Download; a migration for batches (level 2), reviewed by the hub.

Not a Block: a way in and out of every Block for people who live in Excel and Google Sheets.
Written up here with the Blocks because it's built like one.

## What it's for

Matt (2026-11-09) is a spreadsheet geek, and so are a lot of the people who build fan wikis:
the best stat sheets for most games are Google Sheets someone has kept for years. Village should
be the friendliest home those people have ever had, in both directions:
- **Out**: any Block as a real sheet, to sort, filter, chart and theorycraft with.
- **In**: paste 60 rows from a sheet and get 60 entries filled in or fixed, reviewed by the
  community as one batch, instead of typing them one form at a time.

### The moments (from the intuitive-design steps)

| | Crunching: "let me work this out" (primary, out) | Linking: "keep my sheet in sync" | Filling in: "I already have all this in a sheet" (primary, in) | Reviewing: "is this batch right?" |
|---|---|---|---|---|
| **Who** | A player who theorycrafts (best unit for a job, damage maths) | A sheet keeper with formulas that build on the data | A builder with a fan sheet, theirs or a friend's | A voter, then a moderator |
| **Trigger** | The app answers one question at a time; they want all of it at once | They're tired of copying numbers across by hand | A Block is half empty, and the numbers are already in a sheet | A batch shows up in Drafts |
| **State** | Curious, settling in | Practical | Keen, a bit impatient ("don't make me type 60 rows") | Careful, but won't check 60 rows one by one |
| **What they know** | Excel or Sheets, very well | IMPORTDATA or Data → From Web | Their sheet's columns, not Village's field names | The game, maybe one or two of the rows |
| **Done looks like** | The sheet is open with numbers that sort as numbers, headers frozen, filters on | A formula that refreshes itself | One Send, and the batch is waiting for votes | Spot-checked a few rows, voted, flagged the one that's off |
| **Time** | Seconds to get the file | A minute, once | A few minutes for a whole sheet | A minute or two per batch |

What this means for the design:
- **It must feel like a spreadsheet person made it.** Numbers are numbers, the header row is
  frozen and bold, filters are on, accents survive Excel, columns are a sensible width, and the
  column names are the ones in the app (Might, not `might`).
- **What you download, you can paste back.** Same columns both ways, with the entry's id, so a
  round trip (download, fix in Excel, paste back) just works and only sends what changed.
- **Fastest path first.** "Copy rows" puts the Block on the clipboard ready to paste into any
  sheet: no file at all.
- **Batches are reviewed as one, but rows stay visible.** Voters see the whole batch as a
  table of changes, vote once, and can flag a single row.
- **Credit travels with the data**, both ways (CC BY-SA, sources cited).

## Level 1: Download (the first slice)

### Where

A small **sheet button** (a grid icon) in every Block's header, beside Share, on Blocks with
entries (Characters, Items, Collections, Checklists, Timelines; not Guides or Tier lists for now).
It opens a little menu:

- **Excel (.xlsx)**: a real Excel file (opens in Excel, Google Sheets, Numbers, LibreOffice).
- **CSV**: plain text that opens anywhere.
- **Copy rows**: copies the table so it pastes straight into Excel or Google Sheets as cells.
- **Include spoilers** (a tick at the top): off unless the player has already shown spoilers.

On a phone the menu is a sheet from the bottom, the same three choices; Excel and CSV save the
file the phone's way.

### What's in it

One row per entry, in the Block's own order. Columns, left to right:

| Column | What it holds |
|---|---|
| **Name** | The entry's name |
| one per field | In the Block's field order, under the field's name as players see it (Type, What it does, Where to get it, Made from…). Switched-off fields are left out. |
| one per stat | For each chart, one column per stat, as numbers: Might, Hit, Weight, Crit. A second chart's stats are named after it: "Growths: HP". |
| **Appears on** | Only on Blocks that differ by route: "Every route", or the routes it's on. |
| one per route value | Route-specific values get their own column: "How to recruit (as Theodora)". |
| **Source** | Where the facts come from, as the entry gives it. |
| **Link** | The entry's address in the app. |
| **id** | The entry's id (`goliath`), so a sheet can be pasted back in and match the right entry. Last, so it's out of the way. |

How each kind of field reads in a cell:
- Short text, tags, places, times: as written. Numbers and stats: real numbers in .xlsx.
- Yes or no: "Yes" or "No". Toggles: their choice ("Playable", "NPC").
- Lists and other entries: one per line inside the cell ("Iron Ore: 3", new line, "Oak Log: 1"),
  which is what Alt+Enter makes in Excel, so it pastes back the same way.
- Long text: as written, line breaks kept.
- Collections and the other older Blocks: Name, their filters, their stats, the key fact
  (its own name, e.g. "Level"), Description, then each "+" section by its label.

### Spoilers and routes

- **Spoilers off**: spoiler entries are left out, and spoiler fields' columns are left out
  entirely (a blank column would look like "nothing known"). The file's name says
  "no spoilers".
- **Spoilers on**: everything is in, and the About sheet says so.
- **Routes**: a sheet has every route's values side by side (the extra columns above), whatever
  route the player has picked, so one file covers the whole game.

### The .xlsx, done properly

- Sheet 1 is named after the Block ("Units"): bold header row, frozen, with filters on every
  column; widths fitted to the content (capped); long text wraps.
- Numbers are stored as numbers, so they sort and chart; everything else as text (so "1-2" never
  turns into a date).
- Sheet 2, **About**: the game, Page and Block, the date it was made, whether spoilers are in,
  the link to the Block, and the credit: "Made by the [game] community on Village. Shared under
  CC BY-SA 4.0: you can reuse and change it if you credit Village and share alike." Plus a line
  on pasting it back in.
- Written by our own small code (an .xlsx is a zip of a few text files), so no new library.

### CSV

- UTF-8 with the mark Excel looks for, so accents and symbols don't turn into gibberish.
- Commas, quotes and line breaks inside cells are handled the standard way.
- No credit rows inside the CSV (they'd break sorting and pasting back); the **Link** column on
  every row points at the entry, which is the credit. The file name ends `village.csv`.
- Made in the browser from the Block already on the page: no wait, no server, and it works
  offline in the installed app.

## Level 2: Paste in (designed, not built)

In the Workshop, on a Block's "In the app" tab: **Paste from a sheet**.

1. **Paste or upload.** Paste rows copied from Excel or Google Sheets (they arrive as
   tab-separated text), or drop a .csv or .xlsx. The first row should be the headers.
2. **Match columns.** Village guesses which column is which field: exact names first (from our
   own download), then the field's key, then common short forms ("ATK" → Attack, "Def" →
   Defense, "Lv" → Level), then close spellings. Each column shows its guess with a menu to fix
   it, or "Leave out". Columns it can't place are left out until the builder picks. (AI could
   help guess later; the builder still confirms every column.)
3. **Match rows.** By id first, then by name (ignoring case and spaces). Three groups:
   - **New** (no match): will add an entry.
   - **Changes**: old → new for each field, the same "What changes" lines Drafts use
     (`changesBetween`).
   - **Unchanged**: folded away.
   Rows can be ticked off individually. A blank cell never wipes a value (a sheet with an
   empty column shouldn't erase the app); to clear a value, type `-`.
4. **Credit.** A source is required ("Fan stat sheet by Mira, link"), and a tick: "I made this
   sheet, or its maker is happy for it to be shared under CC BY-SA."
5. **Send as one batch.** Nothing goes live until the usual review.

### What a batch is (recommended)

**Many Drafts grouped together**, not one Draft holding many entries:
- Each row is an ordinary Draft (one entry, its own "What changes", its own history once
  published), so publishing, rollback and credit work unchanged.
- A new **batch** record holds them together: its title, source, who sent it, and how many rows.
- In Drafts, a batch shows as **one card**: "Units · 42 changes from Mira's stat sheet", which
  opens to a table of every row's changes.
- **Voting is on the batch**: "I can confirm" / "Seems wrong" once for the whole batch (totals
  hidden until 5, as always). Anyone can **flag a row** ("this one's off"), which sets it aside.
- **Publishing**: a moderator publishes the batch in one go (every row except flagged ones,
  which stay as separate Drafts to settle on their own), or declines it with a reason.
- **Limits**: a batch counts as one Draft against the 20-an-hour limit, holds up to 200 rows,
  and each player can send 3 batches a day.

To work out before the migration (the hub, 2026-11-09):
- **A row that clashes with a newer fix.** Each row's Draft records the revision it was based on.
  If someone else's fix to that entry is published first, that row shouldn't overwrite it:
  publishing the batch skips it and sets it aside as its own Draft, showing the new version
  beside the sheet's, to settle on its own.
- **The rate limit.** A batch counts as one against the hourly Drafts limit, with its own
  3-a-day limit, checked in the database, not just in the page.

Why not one big Draft: every part of Village assumes a Draft changes one entry (what it edits,
"What changes", the history, publishing). One Draft per row keeps all of that, and the batch is
just a folder around them.

### What it needs in the database (for the hub)

- `draft_batches`: id, game, block, title, source, author, row count, status, created_at
  (always now), decided by and when, decline reason.
- `drafts.batch_id` (nullable): which batch a Draft belongs to.
- `batch_votes`: one per player per batch, like `draft_votes`.
- `ship_batch(batch)`: moderators only; ships every open Draft in the batch that isn't flagged
  (calling `ship_draft` for each), in one go.
- `slow_down`: Drafts in a batch don't count one by one; batches have their own limit.
- Standouts for batches, from batch votes.

## Level 3: A linked Google Sheet (later)

A builder links a public Google Sheet ("File → Share → Publish to web → CSV" gives a link with
no key). Village checks it once a day, and when rows differ from the app, offers them as a batch
credited to the sheet ("From Mira's stat sheet, checked today"). The column matching is saved
once. Moderators can unlink it.

## Shared parts (ask the hub first)

- **Download**: the sheet button in the Block header (`src/components/app/Blocks.tsx`). Everything
  else is new files.
- **Paste in**: the Workshop ("In the app" tab, the batch card in Drafts: `Workshop.tsx`,
  `useWorkshop.ts`), the database (batches, votes, `ship_batch`, `slow_down`), Standouts.

## Build plan

1. **Download**: `sheets.ts` and its tests, `xlsx.ts`, the sheet button and menu (Excel, CSV,
   Copy rows). Checked on the production build, desktop and
   phone.
2. **Paste in, the matching screen**: paste or upload, column matching, row matching with
   "What changes", sent as separate Drafts at first if the batch SQL isn't in yet (for small
   pastes, under the hourly limit).
3. **Batches**: the migration (reviewed by the hub, run by Matt), the batch card, voting, flags,
   publishing as one.
4. **Linked sheets**: the daily check.

## Decisions

- 2026-11-09 (Matt): Download offers Excel (.xlsx), CSV and Copy rows. No live link for now.
- 2026-11-09 (Matt): spoilers are left out unless the player already showed them, with an
  "Include spoilers" tick. Left out means the spoiler entries and spoiler columns are gone.
- 2026-11-09 (Matt): a pasted batch is many Drafts grouped in a folder, voted on once and
  published in one go; a single row can be flagged and set aside.
- 2026-11-09 (Matt): anyone signed in can send a batch (up to 200 rows, 3 a day, a source and
  the CC BY-SA tick required); it always waits for votes and a moderator.
- 2026-11-09 (building): the sheet is made in the browser from the Block already on the page,
  and the .xlsx by our own small writer. Why: no server route, no database, no new library.
- 2026-11-09 (building, the hub): text a contributor typed never runs as a formula. In the CSV
  and Copy rows, text starting with `=`, `+`, `-`, `@`, a tab or a return gets a `'` in front
  (Excel shows it; pasting back will remove it). In the .xlsx all text is written as text, never
  as a formula, and only real numbers as numbers.
- 2026-11-09 (building): Copy rows puts tab-separated text on the clipboard, with a cell's line
  breaks kept inside quotes (the way Excel copies cells). Why: an HTML table was tried, but Chrome
  strips the hint Excel needs to keep a line break in its cell, so lists split into extra rows.
  Checked by pasting into Excel: 56 rows by 30 columns, numbers as numbers.

### Checked (2026-11-09, production build)

- Excel on this PC opens the Units, Weapons and magic and Last chances workbooks with no
  "repair" prompt: two sheets, stats as numbers, filters on, header frozen, line breaks wrapping,
  accents and emoji intact, and `=HYPERLINK(...)` typed in a cell stays plain text.
- The menu at desktop and phone size; spoilers off gives 7 Items rows, on gives 9; the CSV starts
  with the UTF-8 mark; Copy rows pasted into Excel cell for cell.
- Not checked yet: Google Sheets and LibreOffice opening the .xlsx, and a real iPhone (the
  browser pane imitates an Android phone). iPhone Safari shows downloads as a preview to share
  or save.

## Open questions (for Matt)
- Guides and Tier lists left out of Download for now (steps and tiers don't sit well in cells).
- Pictures: left out of sheets for now. Later, a Picture column with the image's address (Google
  Sheets can show it with `=IMAGE()`), never pasted back in (pictures come in through uploads).

## Later

- A live link (`=IMPORTDATA(…)` in Google Sheets, Data → From Web in Excel) that refreshes itself.
- Download a whole Page, or a whole game, as one workbook with a sheet per Block.
- A Tier list as a sheet (the community tier per entry).
- AI help guessing columns, still confirmed by the builder.
