# Block 8: Classes

**Status:** Live, slice 1 (2026-11-11), made general for any game the same day · **Chat:** `Village · Block: Classes` · **Mockup:** none yet ·
**Code:** `src/components/app/Classes.tsx` (the ladder, List, Compare), `src/lib/classes.ts` (a
Block's shape: bands, skill ranks, Leads to; the path between classes; plain and tested in `classes.test.ts`), the class card in
`CharacterCard.tsx`, the class fields in `src/lib/fields.ts` (`CLASS_FIELDS`), Fortune's Weave's
own setup and starter data in `src/data/pages/fortunes-weave-classes.ts` (`CLASS_SETUP`) · **Database:**
`supabase/migrations/20261114000000_classes_block.sql` (made by `scripts/build-classes-migration.ts`),
then `seed-app.sql` · **Live on:** Fortune's Weave · Classes (its own Page since 2026-11-11, indigo,
Shield symbol, second after Units) · **Replaces:** a "slots" Collection of 12 entries

Built on Characters (Block 1) and Items (Block 2): the same fields, piece, card, heatmap and Workshop
editors. Classes adds the ladder and the path between classes.

## Any game with classes, not just Fire Emblem

Matt, 2026-11-11: "Will this tool still make sense for an app made for FFVII, WoW, etc?" Slice 1 was
shaped around Fire Emblem (a fixed Tier ladder, paths from exam ranks, growth modifiers). So the
Block now takes its shape from its own setup, and nothing in the code names a game:
- **The bands are the Block's first tag**, ordered by the bands' header cards (Items groups the same
  way). Builders choose it by putting a tag first in Set up.
- **"Leads to"** is a links field builders fill in (a promotion, a job, a spec, a subclass), with a
  note after a colon ("Paladin: at level 30"). **"Comes from"** is worked out on the other side,
  matching names without caring about capitals, and never from a band's header card. A name that
  matches no class stays plain text, like Items' "Made from".
- **Skill ranks are spotted, not named**: when nearly every class's value in a list field is
  "Skill: Rank" lines ("Swords: B"), the tiles show them, the card shows them as chips, and the path
  also follows the skills a band at a time. Any other list (sentences, levels, quests) leaves that off.
- **The common fields have plain names** (below); a game renames them in Set up.

How some games would set it up:

| Game | Bands (first tag) | Leads to | Skill ranks | Chart |
|------|-------------------|----------|-------------|-------|
| Fire Emblem: Fortune's Weave | Tier (Beginner to Divine) | worked out from the exams | Exam needs | Growth modifiers |
| World of Warcraft | Role (Tank, Healer, Damage) | renamed "Specs": Arms, Fury, Protection | none | usually off |
| Final Fantasy XIV | Base class or job | renamed "Becomes": Gladiator to Paladin | none | off |
| Final Fantasy Tactics | Tier, or none | typed: Squire to Knight | job levels as ranks, if written "Squire: 2" | stat multipliers |
| Final Fantasy VII | (no classes: it wouldn't use this Block; Materia belongs in Items) | | | |

The unit-and-class features of slice 2 only make sense where characters switch classes and share
stats with them (Fire Emblem, Final Fantasy Tactics, Bravely Default), so they show only when a
game's characters and classes share a chart's stats.

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
- **The path is worked out, not typed.** From the exams, a class shows "Leads to" (classes a tier
  up that build on its skills) and "Comes from". Nobody types the tree, and it can't be right in
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
  and "Best <stat>" for each of the chart's stats, which ranks every class in one list.
- **List**: rows with the piece, name, how it moves, exam and route lock, under the same bands.
- **Compare**: every class's growth modifiers as a heatmap table; tap a column to sort, a row to open.
- Each device remembers the view and the sort. The address holds the open class.

## The card

The Characters card, laid out by the class fields, with a smaller picture (as items):
- **Name**, tags under it (Tier, Moves), and "Cai, Leda only" for a route-locked class.
- A "Guides disagree" or "Not confirmed yet" note where the guides differ.
- **Growth modifiers** as heat-colored number boxes with + and −; tapping one opens every class
  sorted by it.
- **Exam needs** as chips ("Swords B"), then **Leads to** and **Comes from**: small pieces of
  the classes on either side, tappable. (Before the same day's rework: "Next steps" and "Steps before".)
- **How to unlock** (route by route where it differs), **Who can take it** ("Women only", "One unit
  at a time"), **Mastery skill**, **Skills**, the description, then the wiki link and videos as on
  every card.
- A tier's own card (from its band header) shows what the tier takes and a line about it.

## Fields

Every Classes Block starts from these common fields (`CLASS_FIELDS`), named for no game; all are
optional. The keys are the ones Fortune's Weave's classes already use, so its entries keep their values.

| Field (key) | Kind | On by default |
|-------|------|---------------|
| Tier or group (`Tier`) | tag: the bands while it's the first tag | yes |
| Role (`Role`) | tag (Tank, Healer, Damage); put it first to band by role | no |
| Stats (`@stats`) | chart, numbers only (class numbers often go below zero) | yes |
| Requirements (`Exam needs`) | list; "Skill: Rank" lines draw the path too | yes |
| Leads to (`Leads to`) | other classes, "Name: note" | yes |
| How to get it (`How to unlock`) | long text | yes |
| Who can take it | short text | yes |
| Skills and abilities (`Skills`) | list | yes |
| Community tier | tier (once a Class tiers list exists) | no |
| Description | long text | yes |

**Fortune's Weave** (`CLASS_SETUP`): Tier, Moves (On foot, Armored, Riding, Flying), Growth
modifiers, Exam needs, Leads to, How to unlock, Who can take it, Mastery skill, Skills, Description.
**A saved setup wins**: a Block whose fields are saved in the database (Fortune's Weave's were, by
slice 1's seed) keeps its own labels and fields; new common fields, like Leads to and Role, show in
its Set up switched off, for a moderator to turn on. Re-running seed-app.sql never replaces a saved
setup.

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
   and chips; the class card with its path; 58 classes of starter data. Then made general (above).
2. **Slice 2: units and classes** (below), linked both ways, shown only where characters and
   classes share a chart's stats.
3. **Slice 3**: "What can they take?" (tap the ranks a unit has and the classes they qualify for
   light up); a unit's starting class; a Class tiers list (the Tier lists Block ranking Classes);
   class art.

## Slice 2: units and classes

Designed with Matt, 2026-11-11. **Code:** `src/lib/class-fit.ts` (kin, strengths, ranking; tested in
`class-fit.test.ts`), `src/components/classes/ClassFit.tsx` (the card sections), `kin.tsx` (the
context), one line in `CharacterCard.tsx`, and the kin handed down by the Page routes and `PageView`.

- **Kin.** A Characters Block and a Classes Block in the same game pair up when their charts share at
  least three stats (Fortune's Weave: the nine growths). The server works out each Page's kin (the
  other Block's names, pictures, numbers and bands) and hands it to the cards, so nothing else loads.
  A game whose classes have no numbers in common with its characters (World of Warcraft) never sees it.
- **On a unit's card: "Classes for <name>".** Band chips (Beginner to Divine), remembered on the
  device, since players promote their army around the same time. The top 3 in the band, "Show all"
  for the rest. Ranked by default by **their strengths**: the stats they grow better than the cast's
  average, times how much each class raises them, with a short reason: what the class adds to those
  stats ("Def +25 · Str +10"). A "Rank by" menu switches to **one stat** ("Best Spd": "Spd 50 here
  (35 + 15)") (Matt: strengths by default, a stat if the player wants). Each class opens its card on
  the Classes Page, and its piece wears the Classes Page's color.
- **On a class's card: "Who suits it"**, the 5 units whose strengths it raises most, each with the
  stats why; and **"Pick a unit"**: any unit's numbers in the class, written so a stranger can read
  them ("Esmeralda as Sniper": Dex 55, with "35 + 20" under it), remembered on the device, so a player can pick Fabio once and browse
  classes with his numbers.
- **The player's route and spoilers** (the hub, 2026-11-11): units and classes follow the route picked
  in the switcher (a Theodora player isn't told about a unit only Cai can recruit), and spoiler units
  and classes stay out, by name and picture, until spoilers are shown; the band says when a whole
  band is hidden. Both sections sit at the end of the card, after its own fields. A unit whose numbers are all close to the cast's gets "no classes stand out, try
  ranking by one stat".

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

- 2026-11-11: slice 1 live (0e9d0dc, Rebuild b102202). Checked on the live site, desktop and phone (375 px): the ladder with five bands and spoiler bars, three classes a row on phones with no sideways scroll, the migrated cards (Dancer) with their new content and a wiki link, old links (/classes/dancer, /classes/master-classes) opening their cards, sorts and search, no console errors. Exam lines get three lines on a tile, so three-skill exams aren't cut off.

- 2026-11-11: made general (Matt: "Will this tool still make sense for an app made for FFVII, WoW,
  etc?"). Bands from the first tag, a typed "Leads to" with "Comes from" worked out, skill ranks
  spotted rather than named, plain common field names. Why: a Block is a preset for every game, and
  the Fire Emblem rules only fit tactics games. Fortune's Weave looks the same, with "Leads to /
  Comes from" in place of "Next steps / Steps before"; no SQL.

- 2026-11-11: slice 2 designed (Matt): "Classes for <name>" on unit cards, ranked by their strengths
  by default with one stat as the other choice, band chips remembered; "Who suits it" and "Pick a
  unit" on class cards. Only where characters and classes share chart stats.
- 2026-11-11: spoilers open a band at a time (Matt: tapping one spoiler bar opened them all, and a
  unit card's Master or Divine chip had no way to show its classes). Each band's bar on the ladder
  shows just that band; a spoiler band in "Classes for <name>" gets the same bar. The Page's spoiler
  switch still shows everything.

## Open questions

- Charm counts as a strength like any stat, so Dietrich (high Charm) gets Dancer and Priest first.
  If players find that odd, builders could mark stats that shouldn't count.
- Gender and route locks ("Women only", Dancer on Leda's route) aren't checked in suggestions yet.

- Class art: the game's class icons, credited, once uploads cover classes.
- Whether "Weapons" should be a tag of its own (a filter by weapon) or keep coming from the exam.
- Ocarina of Time has no classes. The first non-Fire Emblem game with classes is the real test of
  the general setup.

## Sources (2026-11-11)

- gameoverdrive.com.br, "Fire Emblem Fortune's Weave: todas as classes e requisitos" (58 classes,
  exam ranks, locks)
- Pocket Tactics, "Fire Emblem: Fortune's Weave classes" (class skills, movement)
- KeenGamer, "Growth rates for all characters and classes" (growth modifiers)
- allthings.how, "Fortune's Weave class guide: all tiers and masteries" (tiers, Renown, mastery skills)
- Our starter codex (Sept 18, 2026): the secret classes' unlocks
