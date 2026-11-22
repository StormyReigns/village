# The Staff room

**Status:** First version live 2026-11-22 (Matt ran `20261205000000_staff_room.sql`) ·
**Code:** `src/app/staff/page.tsx`, `src/components/staff/StaffRoom.tsx` · **Database:**
`supabase/migrations/20261205000000_staff_room.sql`, tested in `supabase/tests/staff-check.mjs`

One shared place for everyone who moderates, at `/staff`, linked from the Moderator menu in the top bar.

## What it's for

Matt (2026-11-22): staff share a hub, centered on a chat, that shows recent updates across all apps,
recent changes by moderators, and general moderator chat and coordination. Like the Workshop's three
panels, left to right: **mod tools, site stats and navigation** (expected to grow), **the staff chat**,
**the site feed**.

### The moment

A moderator opens it at the start of a session, or when pinged: "what happened since I was last here, is
anything waiting for me, and is anyone asking for help?" Done looks like: they've seen what's new, picked up
what's theirs, and answered anyone who asked. A few minutes, usually on a computer; on a phone, one panel at
a time with the chat first.

## What staff see

- **Left, tools:** "Needs you": each game you moderate with Drafts waiting, flags and Notice Board items, each
  opening that Workshop. "The village": villagers (new this week), active this week, games live and being
  built, entries published this week. "Go to": every game's Workshop and app, Start a game, Town Hall.
- **Middle, the staff chat:** only staff can read or write it. Replies, links, taking back your own message
  (a Village-wide moderator or the Founder can take back any), 20 messages a minute at most, live.
- **Right, the site feed:** newest first, filterable (Everything, Changes, Moderators, Reports, Games and
  Builders), "Older" pages back. Each line says who did what, in which game, and links to it:
  - changes in the apps: entries published, removed, brought back;
  - moderator actions: Drafts declined or hidden, chat messages hidden, flags handled;
  - reports: flags and "Was this right?" reports as they come in;
  - new games and Builders: games started and launched, a villager's first Draft.

## Who's staff

Every moderator, of any game, and the Founder (Matt, 2026-11-22: "Every moderator"). Everyone sees the whole
feed and chat; their tools still only act on the games they moderate. `is_staff()` decides, in the database.

## How the feed works

It's read from what the database already records (Drafts' decisions, `removed_by` on chat, flags, reports,
games' `created_by` and `launched_at`), so nothing new is logged and nothing in the apps changed. Things that
leave no trace yet don't appear: setups saved directly by a moderator, a game taken down, a poll ended early.

## Decisions

- 2026-11-22: open to every moderator; all four kinds of feed lines; named "Staff room" at `/staff` (Matt).

## Later

- Moderator actions that leave no trace today (direct setup saves, take-downs, polls ended), via a small log.
- Unread marks on the staff chat, and a ping in the inbox for a reply.
- Per-game staff notes, handover ("I'm away this week"), and who's on.
