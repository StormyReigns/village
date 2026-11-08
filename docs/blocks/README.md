# Blocks

Blocks are the heart of Village: every game's app is Pages made of Blocks, and how good a
Block feels decides whether players keep the app open while they play. So each Block is
designed and refined on its own, with its decisions written down here.

## How we work on Blocks

- **One file per Block** in this folder, following [`_template.md`](_template.md). It is the
  source of truth: what the Block is for, its fields and layout, every decision with its
  reason, and what is still open.
- **One chat per Block**, named `Village · Block: <name>` and kept in the Village group of
  the sidebar. A Block chat reads its file first and updates it whenever something is
  decided, so the chat can be closed or restarted without losing anything.
- **The hub** (`Village · Main`) keeps this roadmap and owns the parts every Block shares:
  the piece, the fields system (`src/lib/fields.ts`), the entry panel, the Workshop, Drafts
  and the database. A Block chat that needs one of those changed asks the hub, so two chats
  never edit the same shared files.
- **One Block chat builds at a time.** All chats edit the same project folder. Designing
  ahead (mockups, field lists, questions) in another Block's chat is fine; building waits
  its turn. This matches the plan: finish one Block before starting the next.
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
| 4 | Questions (replaces Mysteries) | Designed, ready to build | Every Page's top bar; Workshop | [questions.md](questions.md) |
| – | Collection: map | Live, first version | Fortune's Weave · Dungeons and places | |
| – | Collection: slots and rows | Live, first version | Classes, Foes, Mysteries | |
| – | Checklist | Live, first version | Last chances | |
| – | Timeline | Live, first version | Story | |

Block 2 is Items (2026-11-02). Block 3 is Guides (2026-11-06), in `Village · Block: Guides`.
The order after Guides isn't decided yet. Pick the next Block with Matt, give it a number
here, and start its file from the template.
