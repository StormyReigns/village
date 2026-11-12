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
  Stable pointer, and make it safe to run twice.
- **The SQL Editor only shows the last result.** Put all the checks Matt should read in one final select.
- **Say the run order at the top** (this, then `seed-app.sql`), and what happens if it's reversed.
- **Server calls to outside sites:** allow only known hosts, validate ids, cache, use short timeouts.
- **Community text in downloads:** never let a cell run as a formula.

## State on 2026-11-12

Live: Blocks 1 to 8 (Characters, Items, Guides, Questions, Videos, Tier lists, World map, Classes
with units linked both ways), and the integrations: the phone app, Discord posts and Communities,
Spreadsheets download and paste-in batches, and wiki links. The roadmap is in `docs/blocks/README.md`.

Open, waiting on Matt:
- **Tests only Matt can do (signed in or on his phone):**
  - submitting and withdrawing a tier list, a personal list, and switching the tier badge off;
  - sending a real paste-in batch;
  - the pop-out video player and the chat's bottom bar on an iPhone;
  - the phone app's offline reading.
- **The Notice Board:** the idea of showing it to moderators only and renaming it "Reports" was never answered.
- **Patch watch:** waits for a game that patches.
- **Classes slice 3** and **World Foes:** next in their specs, when Matt wants them.
- **Later:** voting on Block setups, dark mode, banner art, measurement and a weekly report.

## Chats

Each Block chat is named `Village · Block: <name>`, and integrations are `Village · <name>`. Find
them in the sidebar or with ListAgents. The old hub chat (very long) is kept as history, renamed
"Village · Main (old)".
