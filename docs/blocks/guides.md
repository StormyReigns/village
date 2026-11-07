# Block 3: Guides

**Status:** Live, first version (2026-11-06), designed with Matt · **Chat:**
`Village · Block: Guides` · **Mockup:** none yet · **Code:** `src/components/app/Guides.tsx`
(the list, one guide, `GuideCard`), `src/lib/guides.ts` (steps, spoiler and picture marks),
the guide fields in `src/lib/fields.ts` (`GUIDE_FIELDS`, the Steps kind), the steps input in
`CharacterInputs.tsx` (`StepRows`), and Set up in `FieldSetup.tsx` · **Database:**
`supabase/migrations/20261106000000_guide_pictures.sql`, then
`20261106000100_guides_in_short.sql`, then `seed-app.sql` (all run by Matt, 2026-11-06) · **Live on:** Fortune's Weave ·
Guides · How to (5 guides); Ocarina of Time · Guides · How to (empty)

Built on Characters and Items: the same fields model (`src/lib/fields.ts`), the piece, the
card parts and the Workshop editors (`EditorShell`, `split`, `FieldSetup`, the entry form).
Guides adds steps you can follow along with, an answer up front, and spoilers step by step.

## What it's for

The "how do I…?" Block. A player picks it up when they're stuck or about to try something:
a fight they keep losing, something they don't know how to do (recruit someone, change
class, reach a place), or a choice they want to get right. The game is paused or on the
retry screen, the phone is in one hand and the controller in the other, and they glance back
at the phone while they play. They want a plan they can act on, without spoiling what comes
after.

### The moments (from the intuitive-design steps)

| | Stuck on a fight: "how do I beat this?" (primary) | Lost: "how do I do this?" | Choosing: "what's the best way to…?" | New: "what should I know?" |
|---|---|---|---|---|
| **Trigger** | Lost a battle, or retrying it for the third time | A quest, a recruit or an unlock needs something they don't know how to do | Between chapters: planning builds, money, classes | Just started the game, or reached a new system |
| **State** | Frustrated, wants a plan, not a lecture; scared of spoilers past this fight | Mildly stuck, ready to follow along | Relaxed and curious, reads more | Curious, a little overwhelmed |
| **What they know** | The chapter or the boss, and the units they have | What they want ("recruit Fabio", "change class") | The goal ("more gold", "best class for Fabio") | Very little; everyday words |
| **Surroundings** | Retry screen; glances at the phone during the fight | Switching between game and phone at every step | On the couch, game paused | Game paused |
| **Done looks like** | A plan for the next try: who to bring, what to do first, what to avoid | Did each step and it worked | Picked an approach | Knows the three to five things that matter |
| **Time** | 30 seconds to the gist, then glances | A few minutes, step by step | Several minutes | A few minutes |

Real-world signal (general knowledge of how players ask, not a fresh study): questions are
phrased by situation ("can't beat chapter 9 on hard", "how do I get to the island", "best way
to farm gold"), not by system. The usual complaints about wikis and walkthroughs: walls of
text before the answer, spoilers in the very next line, losing your place when you switch
back to the game, and long videos when one step was missing.

What this means for the design:
- **The answer comes first.** Every guide opens with "In short": two or three lines that are
  enough for most players ("Bring two archers, kill the healers first, the boss never
  moves").
- **Steps you can follow along with.** Each step is ticked off as you do it, and the next one
  stands out, so switching back to the game never loses your place. Kept on the device.
- **Warnings before the steps, not after.** "Watch out" (a missable, a unit who mustn't die)
  sits above step 1, where it can still help.
- **Spoilers step by step.** Any step or part can be covered until tapped, so a player who
  wants a nudge doesn't see the whole solution.
- **One guide at a time.** A list to find the guide, then the guide alone, big enough to read
  at a glance. Not every guide open on one long page.
- **Found in the player's words.** Search looks in titles and text, so "chapter 9", a boss's
  name or "Fabio" finds the guide; kinds ("Beat a fight", "How to"...) narrow it.
- **Linked to the rest of the app.** Names of characters, items and places in a guide are
  already links (`RichText`); "You'll need" shows the ones that matter as pieces.

## What a player sees

- **The list** (the default): one row per guide, in the builders' order. Each row: the
  guide's piece (the Block's symbol, or a group symbol when a Kind is set up with symbols),
  its name, the first line of "In short" (or of the first step that isn't a spoiler), and a
  quiet line like "Chapter 9 · 5 steps". With more than three guides, a search box ("What are
  you stuck on?") sits on top; it looks in names and text. When a tag (Kind, Difficulty) has
  two or more values, chips under it narrow the list. A search that finds nothing offers
  close names and "Write this guide in the Workshop".
- **One guide**: tapping a row opens the guide in place of the list, and the address holds it
  (`?e=how-to.change-class`), so links, share cards and the phone's back button work. On top:
  "All guides", "2 of 5", share, and arrows to the previous and next guide. Then the guide:
  its name (with any short fields beside it, tags and when under it), then every part in the
  builders' order. The starter order: "In short" in a box tinted the Page color, "Watch out"
  in a red box, the numbered steps down a line in the Page color, and the tip as the sticky
  note. Under the guide: "Fix this guide" (opens the Workshop form) and "Next: <name>".
- **Steps**: a spoiler step shows as the chat's "Spoiler · tap to show" until tapped, its
  picture included. A picture sits under its step; tapping it shows it over the whole screen.
- Spoiler fields are covered until tapped; a whole-guide spoiler opened from a link asks
  first. Route-specific parts show for the player's route (every route's version, named,
  when "All" is picked), and a guide for one route only hides on the others.

## Fields

Every Guides Block starts from these common fields (`GUIDE_FIELDS`); all are optional.
Values live on entries as they always have, so the four guides already live keep working:
their "Steps" and "Tip" sections are these fields.

| Field | Key | Kind | On by default | Where it shows |
|-------|-----|------|---------------|----------------|
| Kind | `Kind` | tag (Beat a fight, How to...) | no | a pill under the name; chips on the list |
| Difficulty | `Difficulty` | tag (Normal, Hard...) | no | a pill under the name; chips on the list |
| When | `When` | when ("Chapter 9", "Part II") | no | under the name with a clock, and on the row |
| In short | the entry's description | long text | yes | first, in a box |
| Watch out | `Watch out` | list | yes | a red box, before the steps |
| Steps | `Steps` | steps | yes | numbered down a line |
| Tip | `Tip` | long text | yes | the sticky note after the steps |
| What you get | `What you get` | list | no | its own heading |

Builders can add their own fields of these kinds: short text, number, tag, place, when, list,
other guides, long text, yes or no, toggle, or **Steps**. Charts aren't offered in Guides,
and Steps is offered in Guides only. A Guides Block with no setup of its own uses these
fields, so Ocarina of Time's empty Block is ready too.

How steps are kept (`src/lib/guides.ts`): one step per line of the `Steps` text. A spoiler
step is wrapped in `||`; a picture is a `[picture:game/person/file]` mark at the end of the
line. A picture mark only counts when it names a file in the `guide-pictures` bucket in that
exact shape (no web addresses, no `..`); anything else is dropped. "What changes" in the
Workshop spells the marks out ("2. (spoiler) Behind the altar (picture)").

## Builders

- **Set up** on a Guides Block (in the Workshop's "In the app" tab) opens the same field
  setup as Characters and Items, on the Workbench, with a sample guide ("Beat the bridge
  fort") as the preview, a spoiler step included. Adding a field shows an example with
  guide-like names (What you get, Missable, See also). Moderators save setups for now.
- **Writing or fixing a guide** uses the same form as characters and items: fields in the
  guide's order, "In short" with the hint "What would you tell a friend, in two lines?",
  Watch out as one box per row, and the steps as rows. Each step has up and down, a Spoiler
  switch, a Picture button (signed in; photos are redrawn and stripped of location data, as in
  the chat, 5 MB at most), and remove. Enter starts the next step. The live preview beside it
  (a sheet on phones) is the guide exactly as players see it.

## Starter data

Fortune's Weave's five guides each get an "In short" line written from what their steps
already say (`IN_SHORT` in `src/data/pages/fortunes-weave.ts`). On the live site they arrive
through `20261106000100_guides_in_short.sql`: a new revision on Stable, only for guides still
exactly as they started. No new fight guides from us without a source; those are the
community's to write, or we add them with sources cited. Ocarina of Time's Guides Block stays
empty for now.

## Decisions

- 2026-11-06: Guides is Block 3 (picked by the hub). Why: Characters and Items are idle, and
  "how do I…?" is the question players reach for most when stuck.
- 2026-11-06: a list, then one guide at a time (Matt). The list is searchable; tapping a guide
  opens it on its own in the Block, with "All guides" to go back, arrows for the previous and
  next guide, and the address holding it so links open straight to it. Why: a guide is read
  in glances mid-fight, and one long page of every guide gets lost once there are dozens.
- 2026-11-06: the first version adds "In short" at the top of every guide (Matt). Ticking off
  steps, "You'll need" and kinds wait for later. Kind, When and Difficulty are still there
  as common fields switched off, for builders who want them.
- 2026-11-06: any single step (or field) can be marked a spoiler and stays covered until
  tapped; whole-guide spoilers keep working (Matt). Why: a nudge without the whole solution.
- 2026-11-06: pictures in steps ship in the first version (Matt): an optional picture on any
  step, tap to see it bigger. They need a storage bucket for guide pictures, so a database
  change Matt runs in Supabase before the release.
- 2026-11-06: Guides join the fields system, like Characters and Items, so builders get the
  same Set up and form. "Steps" is a new field kind, offered in Guides Blocks only. Each step
  stays one line of the "Steps" text (a spoiler step is wrapped in `||`, a picture is a
  `[picture:…]` mark at the end), so the four live guides, Drafts and history work unchanged.
  "Watch out" (a list shown above the steps) is on by default: it only shows when written.
- 2026-11-06: the Block keeps its title, "How to" ("How to · Beat Chapter 9" reads fine).
- 2026-11-06: built. A guide opens in place of the list (not in the side panel), since it's
  read like a page. Set up shows for every Block laid out by fields. Characters and Items are
  unchanged (`fields.test.ts` still matches their pinned output).
- 2026-11-06: a guide's own link (/g/fortunes-weave/guides/change-class) opens that guide, and
  a guide Draft in the Workshop previews as the guide. Share cards (Discord previews) list the
  steps but say "A spoiler: open it in the app to read" for a spoiler step, and never show a
  picture mark. Why: a link shouldn't spoil what the guide itself covers.

## Open questions

- None open with Matt right now.

## Later

- Ticking off steps as you go, with the next step standing out (kept on the device).
- "You'll need": the characters and items a guide needs, as pieces linking across Blocks.
- Kinds (Beat a fight, How to, Best way, Basics) as symbols and chips.
- Other ways: several players' plans for the same fight, voted on (opinions get up and down
  votes; facts in a guide still get "I can confirm").
- "Guides for this" on a character's or item's card, from the guides that link to it (the
  card is shared, so it goes through the hub).
- Short video clips or a map spot per step.
