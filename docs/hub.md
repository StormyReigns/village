# The hub: Village · Main

The hub chat keeps the roadmap (`docs/blocks/README.md`) and the parts every Block shares, and
reviews database changes before Matt runs them. This file is its hand-off note: a fresh hub chat
reads it first. Keep it short and current.

## How it works (from 2026-11-12)

Leaner, to spend fewer credits. Matt agreed on 2026-11-12.

- **Block chats talk to Matt directly.** They report outcomes to him, not through the hub. The
  hub isn't woken after every turn, so Block chats are best started by Matt, or detached from the hub.
- **Only database changes come to the hub.** That means new migrations, and changes to RLS,
  triggers or SQL functions. Shared code files (the piece, `src/lib/fields.ts`, the entry panel,
  `CharacterCard.tsx`, the Workshop, `types.ts`, `app-data.ts`) need no go-ahead. A Block chat checks
  `git status` first, stages only its own files by name, and says in its commit message which
  shared files it touched.
- **One check per change.** The chat that pushes checks the deploy and the live site. The hub
  doesn't re-verify.
- **Model by task.** Use the big model (Opus) for design, new Blocks and database work. Use Sonnet
  for small fixes, wording, notes and docs. A new chat can be started on either.
- **Fresh chats over long ones.** When a chat gets long, start a new one from its Block's spec or
  this note. Long chats cost more on every turn.

## Reviewing a migration: what has caught real bugs

- **No `row` as a variable name** in PL/pgSQL (`row.x` can fail to parse); use `vid`, `lst`...
- **Triggers on `drafts` must never block publishing.** Wrap their bodies in
  `exception when others then return new`.
- **Rate limits count `created_at`.** Players' rows get it stamped by `a0_created_at_now`
  (20261111130000). New player-written tables need that trigger, or the date forced in the slow-down.
- **Removed or moderated text must not come back** on resend, withdraw or copy. Key it per player
  (see `tier_removed_reasons`).
- **Views run as `security_invoker = true`.**
- **Draft statuses still waiting:** checking, open, approved, preview. A content migration skips
  cards with one waiting, or updates those Drafts too.
- **Update only untouched starter content** (exact jsonb match), append a revision, move the
  Stable pointer, and make it safe to run twice. A purely additive change (one key that's missing,
  nothing overwritten) may instead require the starter name plus the key being absent (20261119000000).
  For entries a seed added recently, "exactly one revision" also proves nobody touched them
  (20261119120000): every publish appends one. For older entries that earlier migrations changed,
  use "no revision with a `draft_id` or `created_by`" (20261123000000): every player publish goes
  through `ship_draft`, which sets both, and migrations set neither.
- **The SQL Editor only shows the last result.** Put all the checks Matt should read in one final select.
- **Say the run order at the top** (this, then `seed-app.sql`), and what happens if it's reversed.
- **Server calls to outside sites:** allow only known hosts, validate ids, cache, use short timeouts.
- **Community text in downloads:** never let a cell run as a formula.

## State on 2026-11-14

Live: Blocks 1 to 9 (Characters, Items, Guides, Questions, Videos, Tier lists, World map, Classes
with units linked both ways, Planner with party, builds and sharing), and the integrations: the
phone app, Discord posts and Communities, Spreadsheets download and paste-in batches, and wiki
links. The roadmap is in `docs/blocks/README.md`. All migrations up to 20261118000000 are run.

Since 2026-11-12:
- The bottom bar is one looping, swipeable row of every Page (no More tray). Matt kept it on 2026-11-20 when a review
  asked for a More tray again; don't bring the tray back without asking.
- The top of every Page is slim: a title row with the questions bar, then one row for Block
  tabs, the route drop-down and the spoiler eye. Page and Block descriptions are no longer shown.
- **No hourly limit on Drafts** (Matt, 2026-11-14; 20261117120000). The "rate limits from day
  one" rule no longer covers Drafts; batches keep 3 a day. Don't add a Draft limit back without asking.
- Entry names may be 1 character or more (Mu, Io), in Drafts and batches.
- The Workshop's "In the app" lists are A to Z.
- **Asking to remove an entry** (Matt, 2026-11-15; 20261120000000, waits on Matt's run): in an
  entry's editor, "Shouldn't be in the app? Ask to remove it" sends a Draft with `action = 'remove'`
  and a reason. Anyone signed in can ask, for anyone's entry; others vote "Yes, remove it" / "Keep it";
  a moderator approves or declines. Approving drops the entry's pointers (its versions stay) and
  declines fixes still waiting on it. A moderator can "Bring back" from the removal's Draft
  (`restore_entry`, 20261120120000): its newest version returns and the chat says it's back.
  Tests: `supabase/tests/remove-check.mjs`.
- **A tag can have a list of choices** (Matt, 2026-11-15; `choices` on a tag in `game_blocks.fields`,
  made in Set up's "Make a list" panel, `ChoiceList.tsx`). The entry form picks from it. On a Classes
  Block the band tag's list orders the ladder and its info heads each band, replacing tier header
  cards. 20261121000000 moved Fortune's Weave's five tiers into its Tier list (waits on Matt's run).

- **Last chances sort by deadline** (2026-11-20): the chapter is read from each deadline's words (`src/lib/deadline.ts`),
  so community edits keep sorting; choose-one items list each option, what it gives and who in your party it helps. Route-based
  screens wait for the saved route instead of flashing "All". 20261126000000 gives Theodora's real dates for Talimun's
  Paralogue (run 2026-11-20). **My run** on the Party Page: last chances by chapter, then recruits and class steps by
  Renown and level (docs/blocks/planner.md).
- **Builder readiness** (Matt's Ocarina early-Builder review, 2026-11-21; plan in docs/workshop.md): Page and Block
  Drafts (20261122000000) turned out to be run already. **Setups as Drafts** (20261127000000, run by Matt 2026-11-21
  without a hub review, since no hub chat was open): Builders submit Set up, Planner setup and map pictures for votes;
  `ship_setup` checks and rebuilds them and refuses a setup that changed since it was sent. Tests:
  `supabase/tests/setup-check.mjs`. **Checklist and Timeline Set up** (docs/blocks/checklist.md, timeline.md):
  20261128000000 lets setup Drafts change their fields (one line in `ship_setup`), run by Matt 2026-11-21.
  **Changing an empty Block's type** (docs/workshop.md): 20261129000000 adds a type part to `ship_setup`, run by Matt
  2026-11-21. Still to plan with Matt: starting a game (a `games` table already exists from 20261020000000 but the
  app reads `src/data/games.ts`).

Open, waiting on Matt:
- **Tests only Matt can do (signed in or on his phone):**
  - the new bottom bar and the slim Page top on a real phone, and the iPhone home-swipe gap;
  - dragging to reorder a party by touch;
  - submitting and withdrawing a tier list, a personal list, and switching the tier badge off;
  - sending a real paste-in batch;
  - the pop-out video player and the chat's bottom bar on an iPhone;
  - the phone app's offline reading.
- **The Notice Board:** the idea of showing it to moderators only and renaming it "Reports" was never answered.
- **Patch watch:** waits for a game that patches.
- **Classes slice 3** and **World Foes:** next in their specs, when Matt wants them.
- **Later:** dark mode, banner art, measurement and a weekly report.

## Chats

Each Block chat is named `Village · Block: <name>`, and integrations are `Village · <name>`. Find
them in the sidebar or with ListAgents. The old hub chat (very long) is kept as history, renamed
"Village · Main (old)".
