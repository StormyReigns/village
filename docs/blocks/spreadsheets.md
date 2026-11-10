# Spreadsheets (an integration)

**Status:** Download live (2026-11-09); paste-in built (2026-11-10), sending waits for the batch SQL ·
**Chat:** `Village · Spreadsheets` · **Mockup:** none yet · **Code:** `src/lib/sheets.ts` (a Block's
columns: how Download reads each one and how pasting writes it back; CSV and copied rows; tested),
`src/lib/xlsx.ts` (a small .xlsx writer, no library; tested), `src/lib/paste.ts` (reading pasted
rows, guessing columns, matching rows; tested), `src/lib/xlsx-read.ts` (reading an uploaded .xlsx,
no library; tested), `src/components/sheets/SheetButton.tsx` (the Download menu), and in the Workshop `PasteSheet.tsx` (the
paste editor), `BatchCard.tsx` (a batch in Drafts) and `useBatches.ts` (loading and acting on
batches) · **Database:**
nothing for Download; `supabase/migrations/20261112000000_draft_batches.sql` for batches (waiting
reviewed by the hub; Matt runs it), checked by `supabase/tests/batches-check.mjs` in `npm test`.

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

## Level 2: Paste in (agreed 2026-11-09, building)

### The moment

A builder has a sheet open in another tab: their own, or a well-known fan sheet whose maker said
yes. A Block in the app is half empty or out of date. They want to select the rows, copy, paste,
check Village understood the columns, glance at what will change, and send. A few minutes, not an
evening of forms. Then voters look at the batch once, spot-check a few rows they know, and a
moderator publishes it.

### Where

In the Workshop, under **In the app**, each Block (the ones Download offers) gets a **Paste**
button beside Add. The app's Download menu ends with "Fixed something? Paste it back in the
Workshop", which opens that Block's paste screen. It opens in the work column like the other editors, on the Workbench, with the
chat still beside it. On a phone it fills the screen. (Pasting 60 rows is mostly a computer job,
but it works on a tablet or phone too.)

### The screen, top to bottom

One screen that fills in as you go, not a wizard of separate pages:

1. **Paste box.** "Copy the rows in Excel or Google Sheets, headers included, and paste here", or
   **Choose a file** (.csv or .xlsx; for an .xlsx with several sheets, pick one). A link: "Start
   from our sheet" downloads this Block's own sheet, so the columns already match.
2. **Columns.** One row per sheet column: its header, two sample values, and a menu with Village's
   choice for it ("ATK → Attack", "Leave out"). Guessing goes: exact field name (our own download),
   the field's key, a stat's short name ("ATK", "Str", "Lv", "HP"), then a close spelling. Columns
   it can't place say "Leave out" in gray until the builder picks. Name must be matched to
   something; id, Source, Appears on, the "(as Theodora)" columns, Spoiler and Confirmed are
   understood too. Link is ignored. The choice is remembered on the device for that Block, so the
   same sheet next week needs no matching.
3. **Rows.** Matched to the app by id first, then by name (ignoring case, spaces and accents).
   Four groups, with counts:
   - **New · 12**: entries that will be added. Each opens to show its fields.
   - **Changes · 23**: entries that will be fixed, each with the same "What changes" lines a Draft
     shows (old → new).
   - **Same as the app · 25**: folded away.
   - **Can't use · 2**: a plain reason each ("No name", "Might isn't a number: 'high'", "Playable
     or NPC must be Playable or NPC", "Two rows are both called Cai"). Fix the sheet and paste
     again, or leave them out.
   Every New and Changes row has a tick, on by default, to leave single rows out.
4. **Credit.** Where it's from (required): "Fan stat sheet by Mira", plus a link if there is one.
   If the sheet has its own Source column, each row keeps its own and this fills the gaps. A tick:
   "I made this sheet, or its maker is happy for it to be shared under CC BY-SA."
5. **Send.** "Send 35 changes for review". It becomes one batch in Drafts.

### How a cell becomes a value

- **The sheet is the truth for its own columns** (Matt): a blank cell in a column the sheet has
  clears that value, and shows as a change to review ("Skills: Fire Bolt → nothing"). If a column
  is blank on every row, Village warns before sending ("Skills is empty on all 40 rows: this
  clears Skills on 23 entries").
- **Fields the sheet doesn't have stay as they are.** A row only changes what its columns say, so
  a sheet downloaded without spoilers (no spoiler columns) never touches spoiler fields.
- **Rows the app has but the sheet doesn't are left alone.** Pasting never deletes an entry.
- **Numbers and stats** must be numbers ("14", "2.5"); "1,200" is read as 1200 for stats.
  A number field keeps what's typed if it isn't a number ("1,200 G"), as in the form.
- **Tags** take any text. **Toggles** must be one of their two choices (case doesn't matter).
  **Yes or no** takes Yes, No, Y, N, True, False.
- **Lists and other entries**: one per line inside the cell, as Download writes them.
- A leading `'` that Download added to keep text safe is taken off again.
- **Spoilers**: a new entry is a spoiler only if the Spoiler column says Yes; an existing entry
  keeps its spoiler mark unless the column says otherwise.
- Pictures can't be pasted (they come in through uploads).

### What a batch is

**Many Drafts grouped together**, not one Draft holding many entries:
- Each row is an ordinary Draft (one entry, its own "What changes", its own history once
  published), so publishing, rollback and credit work unchanged.
- A **batch** record holds them together: the Block, a title ("42 changes from Mira's stat
  sheet"), the source, who sent it, and when.
- In Drafts, a batch shows as **one card**: "Units · 42 changes from Mira's stat sheet · by
  stormy", with counts (12 new, 30 fixed). It opens to a table of every row's changes, New first.
  Its rows don't also show as separate Drafts.
- **Voting is on the batch**: "I can confirm" / "Seems wrong" once for the whole batch (totals
  hidden until 5, as always), and it sorts in Drafts by Standouts like any Draft.
- **Flag a row**: anyone signed in can say "this row's off", which takes it out of the batch and
  makes it a Draft of its own, to be voted on and settled by itself.
- **Publishing**: a moderator publishes the batch in one go, whenever they're happy with it (Matt:
  no waiting time, as with any Draft), or declines it with a reason that
  goes to the sender's inbox. Publishing skips any row whose entry changed since the batch was
  sent (someone else's fix was published first): that row is set aside as its own Draft, so the
  newer fix is never overwritten without a look.
- **Limits**: a batch counts as one against the 20-an-hour Drafts limit, holds up to 200 rows, and
  each player can send 3 batches a day. Checked by the database, not just the page.

Why not one big Draft: every part of Village assumes a Draft changes one entry (what it edits,
"What changes", the history, publishing). One Draft per row keeps all of that, and the batch is
just a folder around them.

### What it needs in the database (for the hub)

- `draft_batches`: id, game, block, title, source, author, status (open, stable, declined,
  removed), created_at (always now), decided by and when, decline reason.
- `drafts.batch_id` (nullable): which batch a Draft belongs to. Flagging a row clears it.
- `batch_votes`: one per player per batch, +1 or -1, like `draft_votes`, with scores from the same
  `wilson_lower`.
- `send_batch(game, block, title, source, rows jsonb)`: makes the batch and its Drafts in one go
  (all or nothing), checks the limits, credits the author, and dates everything now.
- `ship_batch(batch)`: moderators only; publishes every open Draft in the batch through
  `ship_draft`, skipping (and setting aside) rows whose entry has a newer Stable revision.
- `decline_batch(batch, reason)`, `flag_batch_row(draft)`.
- `slow_down`: Drafts in a batch don't count one by one; batches have their own limit.

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
2. **Paste in, the core** (built 2026-11-09): reading tabs, CSV and .xlsx (including files Excel
   itself saved), guessing columns, matching rows by id then name, each row's new content, the
   "blank on every row" warning. A downloaded sheet of every Block pastes back with nothing
   changed (tested as text, CSV and .xlsx).
3. **Batches, the database** (reviewed by the hub 2026-11-10): the migration, 37 checks. One row
   that fails to publish is set aside and the rest still go out (the hub's fix). Matt runs it.
4. **Paste in, the screens** (built 2026-11-10): Paste beside Add on each Block under "In the app",
   the paste editor (paste or a file, columns, what happens, credit, Send), "Batches from sheets"
   in Drafts (vote once, "This row's off", Publish the batch, Decline, Take it back), the batch note
   in the chat, and "Fixed something? Paste it back in the Workshop" in the Download menu
   (`?paste=<block>`). Checked on the production build at desktop and phone size up to Send;
   sending, voting and publishing can be tried once the SQL is run.
5. **Linked sheets**: the daily check.

## Decisions

- 2026-11-09 (Matt): Download offers Excel (.xlsx), CSV and Copy rows. No live link for now.
- 2026-11-09 (Matt): spoilers are left out unless the player already showed them, with an
  "Include spoilers" tick. Left out means the spoiler entries and spoiler columns are gone.
- 2026-11-09 (Matt): a pasted batch is many Drafts grouped in a folder, voted on once and
  published in one go; a single row can be flagged and set aside.
- 2026-11-09 (Matt): anyone signed in can send a batch (up to 200 rows, 3 a day, a source and
  the CC BY-SA tick required); it always waits for votes and a moderator.
- 2026-11-09 (Matt): pasting, a blank cell clears that value (the sheet is the truth for its own
  columns); columns the sheet doesn't have are left alone, and entries missing from the sheet
  are never deleted.
- 2026-11-09 (Matt): a moderator can publish a batch any time, like a Draft.
- 2026-11-09 (Matt): Paste sits beside Add on each Block in the Workshop, and the app's Download
  menu links to it.
- 2026-11-09 (Matt): column matching is rules first (names, keys, short forms, close spellings,
  remembered per Block); AI help later if the rules miss too often.
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
