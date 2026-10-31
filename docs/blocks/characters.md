# Block 1: Characters

**Status:** Refined, still being polished · **Chat:** `Village · Block: Characters` (the
chat that built it, renamed from `Village · Brand & Blocks`) · **Mockup:** board 18 of the
[Block Silhouettes canvas](https://claude.ai/artifact/5Zz5xxgX5BFR1Y8PkMyjJ3) ·
**Code:** `src/components/app/Characters.tsx`, `CharacterCard.tsx`, `src/lib/fields.ts`,
`src/app/g/[game]/workshop/FieldSetup.tsx` · **Live on:** Fortune's Weave · Units

## What it's for

The people in a game: who they are, where and when you meet them, how to get them on your
side, and how they compare. Players pick it up mid-game to answer "can I recruit this
person, and how?", "who is this?" or "who's strongest for this job?". Nearly every
fantasy or adventure game has a cast, which is why it's Block 1.

## What a player sees

- **Profiles** (the default): a strip of small pieces across the top to jump between
  characters, with one profile card below. Swipe the card sideways for the next one:
  it follows your finger, a short swipe springs back, and a long one slides it off while
  the next slides in. Up and down still scrolls the page.
- **List**: rows to scan, sort and filter. Tapping a row opens the details panel.
- Each device remembers Profiles or List for each Block.
- Search, filter chips (from the Block's first tag, e.g. Group) and sorts (A to Z, Z to A,
  by group, and by any stat).
- The address holds the character, so links and share cards open straight to them.

## The card

Laid out by the Block's fields (Matt's layout, 2026-10-29):
- **Portrait** as a piece: game art when there is some, else the group's symbol (e.g. a
  flame for Fiery Mane), else initials.
- **Name** in bold, with a short field beside it (Age).
- **Tags** under the name as pills (Role or class, Group, yes/no fields).
- **Location**, with **Time of arrival** beside it (a chapter, a date, a time).
- **Charts** (Stats, Growths...): a web chart just right of the portrait (the first chart
  with one), and a row of number boxes, "STR" over each, colored from gray to the Page's
  color against every other character. Tapping a box opens the full heatmap of everyone,
  sorted by that stat, with this character picked out. Builders can switch the web or the
  boxes off for each chart.
- **Description** as the main body, then the other fields in the builders' order.
- Empty fields don't show. Spoiler fields stay hidden until tapped. Route-specific values
  show for the player's chosen route.

## Fields

Every Characters Block starts from these common fields (`COMMON_FIELDS`); all are optional.

| Field | Kind | On by default |
|-------|------|---------------|
| Age | short text, beside the name | yes |
| Role or class | tag | yes |
| Location | place | yes |
| Time of arrival | when | yes |
| Stats | chart (the Block's stats) | yes |
| Skills | list ("Name: what it does") | yes |
| Description | long text | yes |
| How to recruit | long text | yes |
| Relationships | links to other characters | yes |
| Likes and gifts | list | no |

Builders can add their own fields of any kind: short text, number, tag, place, when,
list, other characters (links to characters in the same Block), long text, yes or no
(a pill with a tick when yes), or chart. A Block can have several charts (Base stats and
Growths, say), each with its own stat names.

Values live on entries as they always have: tags as categories, the description as the
description, stats as stats, everything else as sections named by the field's key. The
first chart (`@stats`) uses the Block's `stats`; any other chart keeps its own stat list
on its field, with keys that start with the field's key and a dot ("Growths.hp"), so every
chart's numbers sit side by side in an entry's `stats` and the heatmap helpers work as is. A
field's key never changes, so renaming a field keeps every entry's value, and Drafts work
unchanged.

**Fortune's Weave · Units** uses the common fields plus Group (tag), with "How to recruit"
kept as `Recruit` and "Likes and gifts" switched on as `Likes`. Each faction has a symbol.

## Builders

In the Workshop, **Set up** on a Characters Block opens the field setup: switch fields on
or off, rename, reorder, mark spoilers, and add new ones. A **John Doe** preview beside it
shows the card those choices make, before anyone adds a real character. While adding a
field, a small example card shows that kind of field with the name typed so far (under the
preview on wider screens, inside the add box on a phone). Stat names come with a
**Suggestions** menu: whole sets (Tactics RPG, Classic RPG, Tabletop, Action RPG, Monster
battler) or one stat at a time. The how-to text sits behind an "i" beside the title. On a
phone the setup fills the screen as a split: the fields on top and the preview underneath,
each scrolling on its own; a button on the preview's bar makes it bigger or tucks it away.
Anyone can try a setup; for now only the game's moderators can save it.

**Adding or fixing a character** (the Workshop's entry form) follows the same lessons:
the fields come in the order the setup puts them on the card, each with an input that
suits its kind. Lists and other characters are one row per item with "Add another" (the
character's name is offered from the Block), yes or no is a Yes / No / Not sure choice,
stats are a compact grid, and tags and short values offer what other characters already
use as one-tap chips. On a phone it's the same split as the setup: the form on top, the
live preview (with what changes) underneath. On desktop the preview stays in view.
Code: `src/app/g/[game]/workshop/CharacterInputs.tsx` and the shared `split.tsx`.

## Decisions

- 2026-10-29: Characters is Block 1, and fantasy/adventure comes first. Why: building every
  genre's Blocks at once spread the work too thin to get any one right.
- 2026-10-29: Profiles by default with a List toggle, remembered per device and Block.
  Why: one character at a time suits "who is this?", and a list suits comparing.
- 2026-10-29: a strip of small pieces above the profile card to jump between characters.
- 2026-10-29: stats as a chart that can scroll or open bigger. Why: convenience, it saves
  space, and it suits future integrations. (Replaced 2026-10-31, below.)
- 2026-10-29: every field is optional; builders pick from common fields and add their own.
- 2026-10-29: voting on field setups, and a "Community take" section, are left out for now.
  Moderators save setups until voting exists.
- 2026-10-29: game art is preferred, credited, and left out only for legal reasons.
- 2026-10-29: the card swipes sideways and keeps the page still. Why: on a phone, swiping
  through the cast is the natural move.
- 2026-10-31: a piece is never blank: initials, art or a symbol, and where nothing sits on
  it, "village" is cut out.
- 2026-10-31: "Add your own field" shows an example of the chosen kind on a small John Doe
  card. Why: the kind names alone (Links, Yes or no) don't say how a field will look.
- 2026-10-31: the setup's how-to text moved behind an "i" (hover, focus or tap), and stat
  names got a Suggestions menu that floats over the setup. Why: less to read up front, and
  quicker stats without taking more room.
- 2026-10-31: on phones the setup is a top and bottom split (fields above, preview below),
  each scrolling on its own. Why: building and seeing the result at the same time, without
  scrolling past one to reach the other.
- 2026-10-31: the field kind "Links" is now called "Other characters", and yes or no pills
  carry a tick. Each kind's example uses a likely name (Recruitable, Family, Skills), shows
  several items where a kind holds several, and has a line on how it behaves. Why: "Links"
  read as web links, and a yes looked like a tag.
- 2026-10-31: the character form got the same treatment: inputs by kind (rows for lists,
  a choice for yes or no, chips of values already used), fields in the setup's order, and
  the phone split with the live preview. Why: the lessons from the setup apply to the
  people filling characters in, who do it far more often.
- 2026-10-31: charts are a web beside the portrait plus heat-colored number boxes that open
  the full heatmap, each switchable per chart; bars are gone. A Block can have any number of
  charts. Why: webs are what players expect, the heat colors answer "how does this one
  compare", and games like Fire Emblem need both base stats and growths. Matt: Characters
  is the foundation; if other Blocks need adjusting because of it, that comes later.

## Open questions

- Whether characters missing a note for the chosen route should hide on that route.
- Voting on Block setups: how long the vote runs, and who approves.
- The Classes Block on the same Page has no stats or skills data yet.

## Later

- Every Page gets a search bar (Matt's intent, 2026-10-29).
- Community take and voting on characters.
