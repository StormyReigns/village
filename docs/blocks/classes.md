# Block 8: Classes

**Status:** Building slice 1 (2026-11-11) · **Chat:** `Village · Block: Classes` · **Mockup:** none yet ·
**Code:** `src/components/app/Classes.tsx` (the ladder, List, Compare), `src/lib/classes.ts` (exam
ranks, tier order, next steps; plain and tested in `classes.test.ts`), the class card in
`CharacterCard.tsx`, the class fields in `src/lib/fields.ts` (`CLASS_FIELDS`), starter data in
`src/data/pages/fortunes-weave-classes.ts` · **Database:**
`supabase/migrations/20261114000000_classes_block.sql` (made by `scripts/build-classes-migration.ts`),
then `seed-app.sql` · **Live on:** Fortune's Weave · Classes (its own Page since 2026-11-11, indigo,
Shield symbol, second after Units) · **Replaces:** a "slots" Collection of 12 entries

Built on Characters (Block 1) and Items (Block 2): the same fields, piece, card, heatmap and Workshop
editors. Classes adds the ladder and the path between classes.

## What was there

One "slots" Collection with a Tier filter and 12 entries. Only 8 were classes (the secret ones:
Dancer, Ranger, Troubadour, Caladrius, Dragoon, Guardian, Cataphract, Blacksmith). The other 4 were
tier summaries ("Beginner classes"...) listing their classes as text. So most classes couldn't be
found, opened, linked or compared.

## How classes work in Fortune's Weave

From the guides checked on 2026-11-11 (sources at the end), to be confirmed by the community:
- **Five tiers**, climbed in order: Beginner (5 classes), Specialty (12), Advanced (17, nine of them
  locked to a route, a quest or Part III), Master (16, six opened at a god's temple), Divine (8).
- **No fixed tree.** Any unit can try any class it qualifies for. To change class you buy the tier's
  **License** in Hightown (used up, pass or fail) and take the **Certification Exam** next to it. A
  tier needs a level and Renown (Beginner Lv 5 · Renown 1, Specialty Lv 20 · Renown 4, Advanced Lv
  35 · Renown 8, Master Lv 45 · Part III).
- **Exams are about skill ranks**: each class asks for weapon, magic or movement ranks (Myrmidon:
  Swords C; Shido: Swords B; Swordmaster: Swords A). The real path is a skill getting better.
- **Each class** has a **mastery skill** kept for good once mastered, class skills, how it moves (on
  foot, armored, riding, flying), sometimes a gender or route lock, and **growth modifiers** added to
  the unit's own growths while in it (Armored Knight: Def +25, Spd −5). Class growths use the same
  nine stats as unit growths.
- **Divine classes** need the five Keys of the Diadem (Part III), S ranks, a 100% pass chance, and
  only one unit can hold each at a time.
- A class unlocked on one route opens on every route.

What players search for: "best class for <unit>", "how to unlock <class>", "<class> requirements",
"growth rates for all characters and classes", "Divine classes", "can <unit> be a <class>".

## What it's for

The moments (from the intuitive-design steps):

| | Choosing: "what should she become?" (primary) | Unlocking: "how do I get Dancer?" | Reading: "what does this class do?" | Comparing: "Sniper or Forest Knight?" |
|---|---|---|---|---|
| **Trigger** | A unit hit the level for the next tier; at the Exam Proctor; a new recruit joined | Saw a locked class, or someone mentioned one | A class name on the exam screen or a unit's card | Two exams in reach, one License |
| **State** | Planning, a bit unsure, game paused | Mildly stuck | Curious, a glance | Weighing it up |
| **What they know** | The unit, roughly what she's good at (her best weapon) | The class's name | The class's name | Both names |
| **Surroundings** | Phone by the TV, controller down, the exam list on screen | Same | Same | Same |
| **Done looks like** | Picked a class to aim for, knows which ranks to train | Knows the route, quest and steps | Knows its skills, exam, growths | Picked one |
| **Time** | Under a minute | 20 seconds | 10 to 20 seconds | Under a minute |

What this means for the design:
- **The game's own ladder is the front door.** Classes sit in tiers in the game's order, Beginner at
  the top. Each tier's header says what it takes (level, Renown, License), so the old tier
  summaries became headers instead of entries.
- **The exam is on every tile.** "Swords B · Bows B" under the name answers "can she take it?"
  without a tap, and search finds "bows" in every exam.
- **The card leads with how to get it**: the exam's ranks and, for a locked class, its routes and
  steps. Then the mastery skill, skills, growth modifiers.
- **The path is worked out, not typed.** From the exams, a class shows "Next steps" (classes a tier
  up that build on its skills) and "Steps before". Nobody types the tree, and it can't be right in
  one direction and wrong in the other.
- **Comparing is one tap**: growth modifiers are heat-colored against every class, and Compare puts
  all of them side by side.
- **Units and classes meet in the numbers** (slice 2): a unit's growths plus a class's modifiers is
  what "best class for <unit>" really asks.

## What a player sees

- **Ladder** (the default): one band per tier, top to bottom. Each band's header is the tier's
  name, how many classes, and what it takes ("Level 20 · Renown 4 · Specialty License") over a rule
  in the Page color; tapping it opens the tier's own card. Under it the classes as pieces (initials
  until there's art), their names under them like app icons, then their exam, and a small lock with
  the routes for a route-locked class. Pieces never touch.
- **Spoilers**: Master and Divine classes (Part III) and Elephant Rider are spoilers. Their bands
  still show with their headers, and a "16 classes hidden as spoilers. Tap to show" bar.
- **Search** across names, exams, skills and unlocks; a typo offers "Did you mean". While searching,
  the bands give way to one list of matches.
- **Filter chips** by how a class moves (On foot, Armored, Riding, Flying). Sorts: A to Z, Z to A,
  and "Best <stat> growth" for each of the nine stats, which ranks every class in one list.
- **List**: rows with the piece, name, how it moves, exam and route lock, under the same bands.
- **Compare**: every class's growth modifiers as a heatmap table; tap a column to sort, a row to open.
- Each device remembers the view and the sort. The address holds the open class.

## The card

The Characters card, laid out by the class fields, with a smaller picture (as items):
- **Name**, tags under it (Tier, Moves), and "Cai, Leda only" for a route-locked class.
- A "Guides disagree" or "Not confirmed yet" note where the guides differ.
- **Growth modifiers** as heat-colored number boxes with + and −; tapping one opens every class
  sorted by it.
- **Exam needs** as rows ("Swords B"), then **Next steps** and **Steps before**: small pieces of
  the classes on either side, tappable.
- **How to unlock** (route by route where it differs), **Who can take it** ("Women only", "One unit
  at a time"), **Mastery skill**, **Skills**, the description, then the wiki link and videos as on
  every card.
- A tier's own card (from its band header) shows what the tier takes and a line about it.

## Fields

Every Classes Block starts from these common fields (`CLASS_FIELDS`); all are optional.

| Field | Kind | On by default |
|-------|------|---------------|
| Tier | tag (the ladder's bands, ordered by the tiers' header cards) | yes |
| Moves | tag (On foot, Armored, Riding, Flying) | yes |
| Growth modifiers | chart, the same nine stats as unit growths, numbers only (no web) | yes |
| Exam needs | list, "Swords: B", one rank per line (drives Next steps and Steps before) | yes |
| How to unlock | long text | yes |
| Who can take it | short text | yes |
| Mastery skill | list ("Name: what it does") | yes |
| Skills | list | yes |
| Community tier | tier (once a Class tiers list exists) | no |
| Description | long text | yes |

A tier's header card is an entry with `header: true`, its tier, an `order` (its place on the
ladder), "How to unlock" (what the tier takes) and a description. Builders can add their own fields
of any kind, as in Characters and Items.

**Fortune's Weave**: 58 classes and 5 tier cards. The four old tier summaries keep their ids
(`beginner-classes`...) as the headers, so old links open the tier's card; the eight secret classes
keep theirs.

## Builders

As in Items: **Set up** on a Classes Block opens the field setup with a sample class beside it.
**Adding or fixing a class** uses the same form: Exam needs as rows, growth modifiers as a grid,
the live preview. Moderators save setups for now.

## Build plan

1. **Slice 1** (this one): the "classes" type, the ladder with header cards, List, Compare, search
   and chips; the class card with Next steps and Steps before; 58 classes of starter data.
2. **Slice 2: units and classes**, linked both ways. On a class card, "Pick a unit" shows her growths
   in the class (her growths + the modifiers); on a unit card, "Best classes for her growths". A
   unit's starting class.
3. **Slice 3**: "What can she take?" (tap the ranks a unit has and the classes she qualifies for
   light up); a Class tiers list (the Tier lists Block ranking Classes); class art.

## Decisions

- 2026-11-11: Classes is its own Page (the hub, with Matt); this chat designs the Block.
- 2026-11-11: one entry per class, all 58; the four tier summaries become the ladder's header cards,
  keeping their ids (Matt). Why: most classes couldn't be found or opened, and a tier's requirements
  belong at the top of its band.
- 2026-11-11: Classes is a Block type of its own, built on the Characters and Items parts (Matt). Why:
  the ladder and the path between classes don't fit a character's profile or an inventory, and the
  shared parts mean one fix improves all three.
- 2026-11-11: the first slice is the ladder and the card, with the path worked out from the exams
  (Matt). Units links come next.
- 2026-11-11: start with as much data as the guides have: exam ranks, locks, skills, mastery skills,
  movement and growth modifiers for all 58, cited, with conflicts marked (Matt).
- 2026-11-11: "Next steps" and "Steps before" are worked out from the exam ranks: the previous
  tier's classes most like this one's exam, plus any whose skills this exam all asks for. Why:
  Fortune's Weave has no fixed tree, and typing one would be wrong in places and twice the work.

## Open questions

- Class art: the game's class icons, credited, once uploads cover classes.
- Whether "Weapons" should be a tag of its own (a filter by weapon) or keep coming from the exam.
- Ocarina of Time has no classes; when another fantasy game does, check the fields still fit.

## Sources (2026-11-11)

- gameoverdrive.com.br, "Fire Emblem Fortune's Weave: todas as classes e requisitos" (58 classes,
  exam ranks, locks)
- Pocket Tactics, "Fire Emblem: Fortune's Weave classes" (class skills, movement)
- KeenGamer, "Growth rates for all characters and classes" (growth modifiers)
- allthings.how, "Fortune's Weave class guide: all tiers and masteries" (tiers, Renown, mastery skills)
- Our starter codex (Sept 18, 2026): the secret classes' unlocks
