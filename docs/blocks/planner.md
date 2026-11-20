# Block 9: Planner

**Status:** Slices 1, 2 and 2b live; slice 3 built (2026-11-14): Set up, and sharing once its SQL is run · **Chat:** `Village · Block: Planner` ·
**Mockup:** in the chat (2026-11-14) · **Code:** `src/lib/planner.ts` (setup, the party, the next-step
line, the roster for the Party Page; tested in `planner.test.ts`), `src/components/planner/` (`Planner.tsx`
the Block and its picker, `BuildPlan.tsx` a unit's plan and its class and gear pickers, `sources.ts` the
Classes ladder as the Planner reads it, `usePlan.ts` saving on the device and to the account), the Blocks it
picks from handed down by the Page route (`plannerRosters`) through `PageView`, and `lead` on `EntryPanel` ·
**Database:** `supabase/migrations/20261115000000_planner.sql` (passed hub review 2026-11-14), then
`seed-app.sql` (adds Fortune's Weave · Party); slice 2: `20261116000000_planner_builds.sql` (passed hub review 2026-11-14; a step's tier must be one of its
class's own tags, so plans hold no player text, ready for sharing later)

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
2. **Slice 2: a member's plan** (built 2026-11-14). Class steps (with "Classes for <name>" as the first
   picks) and gear slots, the "Your plan" section on the unit's card, the line moving on to gear and
   class steps. Saving builds to the account needs `20261116000000_planner_builds.sql`.
2b. **Slice 2b: around the app** (live 2026-11-14). "In your party" marks on Units and on planned items, the "Your party"
   card on the game's home, dragging to reorder. (Split from slice 2 to keep it reviewable.)
3. **Slice 3: Set up and sharing.** The Planner's Set up in the Workshop (roster, size, class
   steps, slots); Share with a picture; abilities as a slot (once skills are entries somewhere).

## Slice 3 (built 2026-11-14, Matt: "Do it here")

**Set up in the Workshop.** The Workshop leaves Planner Blocks out today (`workshop/page.tsx`). Slice 3 brings the
Party Page back as a tab there with one thing on it: **Set up** for the Planner, in the shared `EditorShell` on
the Workbench, with the app's look as the preview (a sample party of three from the roster with their lines, and
one unit's plan). What it sets, all in `plan_setup`:
- **Roster**: which Characters Block (a list of the game's Characters Blocks).
- **Party size**: a number, or "No limit".
- **How to get a unit**: the roster's fields to join on the line, in order (chips to tick and arrows to move).
- **Class steps**: a Classes Block, or "None".
- **Gear slots**: add, rename, remove; each with its Items Block, an optional tag limit (Type: Weapon) and a count
  from 1 to 10. A slot's key never changes once made, so renaming keeps everyone's plans.
Moderators save it, like every setup (they already write `game_blocks` directly, as Field setup and the map do),
so Set up needs no new SQL. Worth asking the hub whether `plan_setup` should get a shape check in the database.

**Share a party.** A Share button in the Party list's header, like a tier list's: it makes this route's plan
readable by its link and opens the phone's share menu (or copies the link). The link opens a read-only party in
Village (`/g/<game>/plans/<id>`; `src/lib/plan-share.ts`, the share picture `src/lib/og-party.tsx`): "Matt's Theodora run", the units with their class steps and gear, and
"Make your own". A share picture shows the party's pieces. "Its link is shared · make it private" under the list.
This needs SQL (`20261118000000_planner_share.sql`, passed hub review 2026-11-14): `party_plans.shared`, a select policy for shared rows, `share_party_plan(block, route,
on)`, and a way to read a shared plan with its maker's display name. Plans already hold no free text (a step's
tier is checked against its class), so the only words shown are the maker's display name.

**As built:** Set up is `PlannerSetup.tsx` in the Workshop (the Party Page shows there with only the Planner's Set
up; it isn't offered as somewhere to add entries). A shared page leaves out spoiler units, classes and items. Share
for a guest says to sign in, since the link shows your name. Until the sharing SQL runs, the Party list reads plans
without the shared column, so nothing breaks if the code goes live first. Checked on a local production build: the
Workshop's Party tab and Set up with its preview, adding a slot (not saved), Share as a guest, and an unknown link
showing Not found. Not yet checked: saving a setup (needs a moderator signed in) and sharing (needs the SQL and a
signed-in villager).

**Still later:** abilities as a slot, "most picked" counts from shared plans, a plan per difficulty.

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

- 2026-11-14: slice 2, a unit's plan. At the top of their card on the Party Page: one class step per
  tier of the Classes ladder (the Block's first tag, in its header cards' order), and each gear slot.
  A step's picker leads with the 3 classes that suit the unit most ("Classes for <name>", by their
  strengths, with the stats each raises), then every class in that tier on the player's route. Gear
  pickers group a slot's items like the Items Block (ranks best first), searchable. Planned is the
  split outline; "Reached" (a class) and "Got it" (the same tick as on the item's card) turn it solid.
  A tier is hidden as a spoiler when every class in it is one (Master, Divine), with "Show them".
  Taking a unit out of the party drops their build. Fortune's Weave: class steps from Classes, and
  "Weapons and magic", up to 3. Why: the spec as agreed; 3 is a starting count builders can change.
- 2026-11-14: the line's order, slice 2: recruit, then the first planned item not got ("Get: Steel Axe
  · Hightown armory."), then the first tier not reached ("Next class: Brigand · Axes C"), then
  "Planned: Brigand · Steel Axe" once everything is done, else "Recruited".

## Checked (2026-11-14)

On a local dev server with the Party Page fed from the starter data (the SQL isn't run yet), desktop and
phone (375 px): the slate Page after Units in the sidebar and the bottom bar; "Whose run is it?" on
All; picking four units on Theodora's route, grouped by faction, with spoilers held back; their lines;
the Recruited tick snapping solid; Ninae's card opening over the Page; reorder and remove; the plan kept
on the device across reloads; no sideways scroll; no console errors. Not yet checked, as it needs the
SQL and a signed-in villager: saving to the account, and a plan made on one device showing on another.

Live (2026-11-14, 261c5e2): the Party Page on the live site, Theodora picked, Goliath added with his
recruit line, no console errors. The SQL and seed were in by then.

Slice 2, on a local dev server with the starter setup (its SQL isn't run yet), desktop and phone: Goliath's
plan at the top of his card; Master and Divine held back as spoilers; the Beginner picker leading with
Soldier, Gladiator and Hunter for him; Gladiator picked; Levin Sword +1 added; his row reading "Get: Levin
Sword +1", then "Next class: Gladiator" once got; the build kept on the device; no sideways scroll. Not
yet checked: saving builds to the account (needs the slice 2 SQL and a signed-in villager).

Slice 2 live (2026-11-14, after its SQL and a rebuild, 1750907): Goliath's card on the live Party Page opens
with his plan, the class steps (Master and Divine held back) and Weapons and magic, 0 of 3; no console errors.
Saving builds to an account is still for Matt to try signed in.

Slice 2b, on a local production build (desktop and phone): the home card "Your party · Next for 3 of them" with
each one's step; "In your party" on Goliath's card on Units (opening his plan) and "Planned for Goliath" on
Levin Sword +1; dragging Ninae to the top by her grip; reorder rows fitting a phone once the step line hides
while reordering; no sideways scroll. Touch dragging needs a real phone (the browser here sends mouse moves).

- 2026-11-15: three changes from Matt's first look. **The picker lists units A to Z** in one grid ("too spread
  out" by faction). **Each row shows what else there is to plan**: "Classes" and gear-slot chips under its line, "+"
  and dashed while empty, then the last class ("Shido · 2 of 5") or the count ("Weapons and magic · 2 of 3"), each
  opening the unit's plan, with "Tap a unit to plan their classes and gear" above the list. **All shows "Your runs"**
  instead of a blank "Whose run is it?": one card per route with that run's party as pieces (or "Start a Leda run"),
  tapping one picks that route; with nothing planned anywhere, a three-step explainer and a real example line first.

- 2026-11-20: from a review of a second playthrough (Theodora, desktop and phone; Matt: "Do it here"). **The picker**
  shows each unit's group (and class, when the roster has a class tag) under the name, and a note when they don't join by
  ordinary recruiting: "Your Flame Lord", "Joins automatically", "Joins in Part II/III", or grayed "Only now and then" /
  "Not known how" (`joinKind` in `src/lib/planner.ts`, read from the unit's text). Filters: Everyone, You recruit, Join
  automatically, Join later, plus group and class. **Party rows**: the Recruited tick has its word under it ("Recruited" /
  "Recruited?"), and a unit still to recruit shows their portrait inside the split outline (bare outlines all looked alike on
  a phone). The party index now also keeps who still has a class to reach in each tier (`bands`), so Last chances can say
  which party members a reward helps.

## Open questions

- Weapon slot count for Fortune's Weave: 3 to start. Matt can change it.

## Later

- Comparing a plan's party to the community's most-picked.
- A plan per difficulty or per playthrough ("Hard mode run"), beyond one per route.
- Patch notes: flag a plan whose picks changed in a patch.
