# Block 9: Planner

**Status:** Slice 1 built (2026-11-14), waiting on its SQL · **Chat:** `Village · Block: Planner` ·
**Mockup:** in the chat (2026-11-14) · **Code:** `src/lib/planner.ts` (setup, the party, the next-step
line, the roster for the Party Page; tested in `planner.test.ts`), `src/components/planner/` (`Planner.tsx`
the Block and its picker, `usePlan.ts` saving on the device and to the account), the roster handed down by
the Page route (`plannerRosters`) through `PageView` · **Database:**
`supabase/migrations/20261115000000_planner.sql` (passed hub review 2026-11-14), then `seed-app.sql` (adds
Fortune's Weave · Party)

A player's own plan for their run: who's in their party, what each of them will become, and what
each one carries. Built from the game's other Blocks (Characters, Classes, Items), so every piece
in a plan is a real entry and opens its card. Fortune's Weave first.

## What it's for

Matt (2026-11-14): players plan parties, character builds and similar setups from the game's
Blocks, and save their own setup: who's in the party, when a character changes class and into
what, and which weapons, items or abilities each one gets. Builders set the rules per game (party
size, what can be equipped where, which Blocks feed it). At its largest, a player sees their party
as a simple list of pieces, each showing where to find or unlock that character, or the player's
plan for them; tapping one opens the character's profile with the player's own gear on it.

Today players do this in a notes app, a spreadsheet or their head, then forget it between
sessions: "who was I going to make a Sniper?", "did I already recruit Goliath?". Village already
knows every unit's recruit steps, every class's exam and every weapon's source, so a plan here can
tell the player their next step instead of just remembering a list.

### The moments (from the intuitive-design steps)

Real-world signal (general knowledge of how tactics-RPG players plan, not a fresh study): players
post "rate my team" and "help me pick my final party" threads, keep build notes in spreadsheets,
and ask "best class for X" when a unit reaches a promotion level. Common trouble: plans live
somewhere else from the facts (recruit steps, exam ranks), missable recruits are missed, and the
plan goes stale mid-run.

| | "What's next for my team?" (primary) | Setting up the run | "What should she become and carry?" | "Rate my team" |
|---|---|---|---|---|
| **Who** | A player mid-run | A player early in a run, or before a new route or Part II | Same player | An engaged player |
| **Trigger** | Starting a play session; back in town (Hightown, the exam hall, a shop) | New recruits are showing up; a new route starts; Part II lets 15 deploy | A unit hit the level for the next tier; a new weapon dropped | Their party feels settled; a Discord or Reddit thread asks |
| **State** | Wants to get on with playing; a glance | Planning, relaxed, game paused | Weighing it up | Proud, wants a reaction |
| **What they know** | Their party, roughly | The names of units they like | The unit, roughly what she's good at | Where they'll post it |
| **Surroundings** | Phone by the TV, controller down | Phone on the sofa, or a computer | Phone by the TV | Phone or computer |
| **Done looks like** | Knows the next thing to do for each unit (recruit, buy, promote) and goes back to the game | Their party is picked and saved | One class step and the gear decided | A good-looking link posted |
| **Time** | 10 to 20 seconds | 2 to 5 minutes | Under a minute | Under 30 seconds |

What this means for the design:
- **The party list is the front door, and each piece says its next step.** One line under each
  name, the first thing still to do, in the order a player meets them: recruit them (where and
  how, for the player's route), then get their gear (where to get it), then their next class
  (exam and level). With nothing left to do, it shows the plan ("Swordmaster · Killing Edge").
- **It reads the ticks the app already has.** "Recruited" on Units and "Got it" on Items are
  already saved per player (`player_marks`). The line moves on by itself as they tick, so the
  plan stays current without being edited.
- **Planned is an outline, done is solid** (the brand's rule). A planned class or weapon is the
  split outline until it's reached or got, then snaps solid.
- **Picking a class or a weapon is one tap from a short list**, led by what Village already
  suggests ("Classes for Ninae", her strengths), with the full ladder or shelf one tap further.
- **One plan per route** on games with routes, since recruits differ by route.

## What a player sees

### The party (the Block's default)

- A header line: "Your party · 6 of 15" (the builders' party size), and the route switcher's
  route ("Theodora's run").
- **The party as rows**, one per member, in the player's order: the piece (the unit's picture,
  group symbol or initials), the name in bold, and the next-step line in the Page color's ink.
  A not-yet-recruited member's piece is the split outline (not built yet); recruited is solid.
- **Add to party**: an outline row at the end ("Add a unit"), opening a picker of the roster (the
  Units Block), searchable, grouped by its first tag (Group), with units only on other routes left
  out. A full party says "Your party is full: swap someone out".
- Reorder by dragging or by the row's menu (Move up, Move down, Remove), never drag only.
- Empty: "Plan your party" with one line on what it does and a yellow "Pick your first unit".
- Saved as you go: on this device for everyone, and in the account when signed in.

### A member's plan

Tapping a row opens that unit's profile (the Characters card) with **"Your plan for Ninae"** at
the top, then the usual card below:
- **Class steps**: one slot per band of the Classes ladder (Beginner, Specialty, Advanced...), as
  pieces in a row, each with its exam under it ("Swords B"). An empty slot is an outline with
  "Pick". Picking opens the band's classes with "Classes for Ninae" first. A step can carry a short
  note ("at Lv 20"). A step turns solid when the player marks it done.
- **Gear**: the slots the builders set ("Weapon", "Item"...), each a piece; picking opens that
  slot's shelf (an Items Block, maybe one Type only). A gear piece turns solid when its item is
  "Got it", and its line says where to get it until then.
- **A note** for anything else (one short text).
- Each planned piece opens its own card (on the Classes or Items Page).

### On other Blocks (slice 2 or later)

A unit in your party shows a small "In your party" mark on Units, and an item you've planned shows
"Planned for Ninae" on its card, so the plan follows the player around the app.

## Fields

The Planner has no entries of its own (like a Tier list): it holds the builders' setup and each
player's plans. A plan, per player, per Planner Block, per route:
- **party**: the members in order, each a unit's card id;
- per member: **classes** (one per band: a class card id, a note, done or not), **gear** (per
  slot: item card ids), **note** (short text).

## Builders

A Planner Block holds its setup (`planSetup`, like a Tier list's `tierSetup`):
- **roster**: which Characters Block the party comes from (Units);
- **size**: the party's limit, or none (Fortune's Weave: 15, the Part II deploy limit);
- **classes**: which Classes Block feeds class steps, or none (a game without classes);
- **slots**: the gear slots, each with a name, the Items Block it draws from, optionally only some
  values of a tag (Type: Weapon), and how many fit (1 by default);
- **title** and **intro** ("Your party", "Plan who you'll take and what they'll become").

Until its Set up exists (slice 3), the starter data sets it, as Tier lists did.

## Where it lives

Its own Page, "Party" (short "Party"), right after Units in the bottom bar. A small "Your party" card
on the game's home showing the next three steps comes in slice 2. Why: it's the one screen a player
returns to every session, so it earns a place in the bottom bar rather than sitting under the
Units list and the tier list. Every Page needs a color and all seven are taken, so this needs an
eighth (proposed: slate, a quiet blue-gray, since the plan is the player's own notebook rather than
game content). Matt decides.

## Private, shared, voted

Private by default: a plan is a player's own notes. Slice 3 adds **Share** (a link and a picture,
as shared tier lists do). No voting on plans: they're personal, and taste is already voted on in
Tier lists. Later, the community's picks can be counted ("Most Theodora runs take Fabio") from
shared plans only.

## Build plan

1. **Slice 1: the party list.** The Planner Block type and `planSetup` in the starter data; the
   Party Page for Fortune's Weave; picking, ordering and removing units; the next-step line from
   recruit steps and the Recruited tick; one plan per route; saved on the device and to the
   account (one table, `party_plans`, one row per player, Block and route, the plan as checked
   jsonb; a save function with a rate limit). Migration reviewed by the hub first.
2. **Slice 2: a member's plan.** Class steps (with "Classes for <name>" as the first picks) and
   gear slots, the "Your plan" section on the unit's card, the line moving on to gear and class
   steps, "In your party" marks, the "Your party" card on the game's home, dragging to reorder.
3. **Slice 3: Set up and sharing.** The Planner's Set up in the Workshop (roster, size, class
   steps, slots); Share with a picture; abilities as a slot (once skills are entries somewhere).

## Decisions

- 2026-11-14: the design above, as proposed (Matt: "Yes, as proposed"). The party list is the
  front door, with a next-step line per unit read from the ticks players already keep; planned is
  an outline, done is solid; one plan per route; builders set roster, size, class steps and slots.
- 2026-11-14: its own Page, "Party", after Units, in an eighth standard color, slate (Matt). Why:
  players return to it every session; slate because the plan is the player's notebook, not game
  content.
- 2026-11-14: slice 1 saves to the account as well as the device (Matt). Why: plans get made on a
  computer and read on the phone by the TV.
- 2026-11-14: a full party blocks adding, with "swap someone out" (Matt). Why: the limit is the
  game's own, so going over would plan something the game won't allow.
- 2026-11-14: no separate abilities slot for Fortune's Weave (Matt). Why: its skills come with
  classes; abilities wait for a game that needs them.
- 2026-11-14: plans are private; sharing comes in slice 3; no voting (Matt).

- 2026-11-14: the next-step line, slice 1. Not recruited: "To recruit:" and the first sentence of each
  field the setup names (`unlock`), the player's route first (Goliath on Theodora: "Support 3, Renown 9 ·
  Deliver 3 Giant's Meat."). A unit whose route text says "joins automatically" counts as got. A unit
  with no recruit steps at all (a Flame Lord) shows its description without "To recruit", as a solid
  piece. Recruited: "Recruited". Why: Theodora read "To recruit: Flame Lord of the Wolf Obelisk" in
  the first try.
- 2026-11-14: tapping a unit opens their card over the Party Page (`?e=units.ninae`), with arrows
  through the party, links and "Classes for <name>" as on Units. Why: the player stays in their plan,
  and slice 2 puts "Your plan" on that same card.
- 2026-11-14: reorder and remove sit behind "Reorder or remove" (up, down, take out, thumb-sized);
  dragging comes later. The Recruited tick on each row is the same tick as on the unit's card.
- 2026-11-14: with "All" picked in the route switcher, the Block asks "Whose run is it?" rather than
  mixing routes. The sidebar leaves out the Party Page's count (it has no entries).

## Checked (2026-11-14)

On a local dev server with the Party Page fed from the starter data (the SQL isn't run yet), desktop and
phone (375 px): the slate Page after Units in the sidebar and the bottom bar; "Whose run is it?" on
All; picking four units on Theodora's route, grouped by faction, with spoilers held back; their lines;
the Recruited tick snapping solid; Ninae's card opening over the Page; reorder and remove; the plan kept
on the device across reloads; no sideways scroll; no console errors. Not yet checked, as it needs the
SQL and a signed-in villager: saving to the account, and a plan made on one device showing on another.

## Open questions

- None open for slice 1.

## Later

- Comparing a plan's party to the community's most-picked.
- A plan per difficulty or per playthrough ("Hard mode run"), beyond one per route.
- Patch notes: flag a plan whose picks changed in a patch.
