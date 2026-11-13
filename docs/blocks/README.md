# Blocks

Blocks are the heart of Village: every game's app is Pages made of Blocks, and how good a
Block feels decides whether players keep the app open while they play. So each Block is
designed and refined on its own, with its decisions written down here.

## How we work on Blocks

- **One file per Block** in this folder, following [`_template.md`](_template.md). It is the
  source of truth: what the Block is for, its fields and layout, every decision with its
  reason, and what is still open.
- **One chat per Block**, named `Village · Block: <name>` and kept in the Village group of
  the sidebar. A Block chat reads its file first, updates it whenever something is decided,
  and reports to Matt directly. A long chat can be closed and a fresh one started from the file.
- **The hub** (`Village · Main`) keeps this roadmap and reviews database changes only (new
  migrations, RLS, triggers, SQL functions) before Matt runs them; see [`../hub.md`](../hub.md).
  Shared code (the piece, `src/lib/fields.ts`, the entry panel, the Workshop) needs no go-ahead.
  Check `git status`, stage only your own files by name, and name the shared files in the commit.
- **Building at the same time** is fine when chats touch different files. Two chats never edit
  the same file at once; if you're unsure, check `git status` and ask in your chat.
- **Genre first**: fantasy and adventure (Fortune's Weave, Ocarina of Time) until those
  Blocks are settled. Other genres come later.

## Roadmap

Status: **Refined** (designed with Matt and built), **Live, first version** (works, not yet
designed properly), **Idea** (not built).

| # | Block | Status | Where it's used now | Spec |
|---|-------|--------|---------------------|------|
| 1 | Characters | Refined, still being polished | Fortune's Weave · Units | [characters.md](characters.md) |
| 2 | Items | Live, first version | Fortune's Weave · Items, Weapons and magic | [items.md](items.md) |
| 3 | Guides | Live, first version (designed with Matt) | Fortune's Weave · Guides · How to | [guides.md](guides.md) |
| 4 | Questions (replaces Mysteries) | Live, first version (designed with Matt) | Every Page's top bar; Workshop | [questions.md](questions.md) |
| 5 | Videos | Live, first version (designed with Matt) | Any entry; a big card on guides | [videos.md](videos.md) |
| 6 | Tier lists | Live, first version (designed with Matt) | Fortune's Weave · Units · Unit tiers | [tier-lists.md](tier-lists.md) |
| 7 | World: Places (a real map), then Foes | Building (2026-11-09): the map, designed with Matt | Fortune's Weave · World · Dungeons and places | [world.md](world.md) |
| 8 | Classes | Live, first slice (2026-11-11, designed with Matt): the tier ladder and class card | Fortune's Weave · Classes | [classes.md](classes.md) |
| – | Links between Blocks (shared) | Live (2026-11-12): slices 1 to 3 | Every Block with a links field | [entry-links.md](entry-links.md) |
| – | Wiki links (integration) | Live (2026-11-10) | Every character, item and class card | [wiki-links.md](wiki-links.md) |
| – | Discord posts and Communities (integration) | Live (2026-11-10) | Notice Board (moderators); each game's home | [discord.md](discord.md) |
| – | Spreadsheets (integration) | Live (2026-11-10): download, paste-in batches | Every Block with entries; Workshop | [spreadsheets.md](spreadsheets.md) |
| – | Phone app (integration) | Live (2026-11-09): install, offline reading | The whole site | |
| – | Collection: slots and rows | Live, first version | Foes | |
| – | Checklist | Live, first version | Last chances | |
| – | Timeline | Live, first version | Story | |

Pick the next Block with Matt, give it a number here, and start its file from the template.
