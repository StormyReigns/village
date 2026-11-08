# Questions (replaces the Mysteries Block)

**Status:** Designed, ready to build (2026-11-08) · **Chat:** `Village · Block: Questions` (designed in `Village · Block: Guides`)
· **Mockup:** none yet · **Replaces:** the Mysteries
Block (a "rows" Collection) on every game's Guides Page · **Code today:** Mysteries is a
Collection with a Status filter; its panel has "I know the answer" and "Share a theory"
(`EntryPanel.tsx`), and the app's home shows "Help solve" (`HomeHooks.tsx`).

Not a Block: a part of every Page, plus its own place in the Workshop. It's written up here
with the Blocks because it replaces one.

## What it's for

The moment the app doesn't have the answer. A player searched, or looked where it should be,
and it isn't there: "how does Long join?", "where's the Fire Gem?". Today they leave for a
wiki or Discord. Questions keep them here: one tap to ask, and the question becomes a task
for the people who know.

### The moments (from the intuitive-design steps)

| | Stuck: "the app doesn't say" (primary) | Knows: "I can answer that" | Building: "what's worth doing?" |
|---|---|---|---|
| **Who** | Any player | A player who's further along, or did the research | A Builder in the Workshop |
| **Trigger** | Searched or looked, found nothing | Sees a question go by in the bar | Opens the Workshop with time to help |
| **State** | Mildly stuck, a bit let down | Curious, a little proud | Ready to work, wants a clear task |
| **What they know** | Their own words ("the elephant guy") | The answer, maybe a source | How the Workshop works |
| **Done looks like** | Question posted in under 20 seconds; told when it's answered | Their answer is in the app, with their name on it | Picked a question, shipped the fix, the question closes |

What this means for the design:
- **Ask is always one tap away**, on every Page, and in the "nothing found" note of every
  search, already filled in with what they typed.
- **Before posting, show what's already there**: matching entries in the app and questions
  already asked, so a duplicate becomes "follow this one" instead.
- **The answer goes into the app**, where the next player will look first; the question then
  points there.
- **Questions are tasks in the Workshop**, with someone able to say "I'm on it".

## What a player sees

- **The bar** (Matt, 2026-11-08): a slim bar at the top of every Page, under the Page's title.
  It shows one open question about that Page at a time ("? How does Long join? ›", "1 of 3
  open about Units") and slides to the next every few seconds. It stops while a finger or the
  mouse is on it or it has focus, and stays still when the device asks for less motion. On
  the right, a yellow **Ask** button (yellow = act on this). A Page with no open questions
  shows a quiet "Got a question about Units? Ask" instead.
- **Tapping the bar** opens the Page's questions in a sheet: each with its status (Open,
  Someone's on it, Theory, Answered), how many players want to know ("+1 me too"), and for
  answered ones "Answered: see Long", linking to the entry.
- **The Guides Page** also lists every open question in the game, grouped by Page (where the
  Mysteries Block used to be), so it's the place to go and help.
- **Asking**: a short sheet. One line for the question, "Which Page is it about?" set to the
  one you're on, a spoiler tick. As they type, "Maybe it's already here" shows matching
  entries and questions; tapping a matching question adds their "me too" instead of a new
  one. Signed-in players post; signing in comes at the end, nothing typed is lost (my call).
- **When it's answered**, the asker gets a note (on the site, and in their profile's activity)
  linking to the entry.
- Spoiler questions show as "A spoiler question" in the bar until tapped, like spoiler steps.

## In the Workshop

- **Questions** is its own tab beside Drafts and "In the app" (Matt: "a unique part of the
  Workshop"). Open questions first, sorted by how many players want to know, then newest.
- **I'm on it**: a Builder picks one up; it shows "<name> is on it" to everyone, so two
  people don't answer it twice. If no Draft comes within 3 days, it opens up again (my call).
- **Answer it** opens the right form: a fix to the entry the question is about, or a new
  entry (a guide, a character), with the question shown at the top. The Draft carries the
  question, so when it ships the question closes as Answered and points to the entry.
- **Theories** (from Mysteries): talk about a question happens in its chat thread, like any
  entry's. A Builder who isn't sure yet can answer with a Draft marked "A theory"; the
  question then shows Theory until a confirmed answer ships.
- Moderators can merge duplicates, mark a question "Can't be answered yet", or remove one.
  Reports and the AI spam check apply as everywhere else.

## Data

A question isn't an entry: it has no Page content of its own. It's its own record: the
words, the Page it's about (and the entry, when it's about one), who asked, "me too"s, who's
on it, its status, and the entry that answered it. New tables in the database, so Matt runs
SQL for it. The six Mysteries of Fortune's Weave move into it with their status (Open or
Theory) and what's known so far kept as the first message in each question's thread; then
the Mysteries Block is removed from the Guides Page.

## Shared parts

Built in its own chat, `Village · Block: Questions` (the hub, 2026-11-08). Everything below
is shared, so that chat asks the hub before each file, and Village · Chat for the thread part:
- **The app shell**: the bar under every Page's title (`PageView.tsx`), and the Guides Page's
  list of every open question (where the Mysteries Block was).
- **The Workshop**: a Questions tab in `Workshop.tsx`, and loading, asking, "me too", "I'm
  on it" and closing in `useWorkshop.ts`.
- **The entry form**: a Draft that carries the question it answers (`EntryForm.tsx`), so
  shipping it closes the question.
- **The database**: new tables (questions, "me too"s, who's on it), rules for who can do
  what, and moving Fortune's Weave's six Mysteries in before removing the Block. Matt runs
  the SQL.
- **The chat**: a thread key per question, for theories and talk (`src/lib/threads.ts`,
  owned with Village · Chat).

## Decisions

- 2026-11-08: questions replace the Mysteries Block; one way to ask, not two (Matt).
- 2026-11-08: a bar on every Page with that Page's questions, and an Ask button on its right;
  the Guides Page also lists every open question (Matt). Why: questions come up about the
  thing in front of you.
- 2026-11-08: the bar shows one question at a time, sliding to the next every few seconds,
  pausing when touched and still for reduced motion; not a scrolling ticker (Matt). Why: a
  ticker is hard to read and pulls attention from the answer the player came for.
- 2026-11-08: answers go into the app as normal Drafts (a fix or a new entry); the question
  closes and points there (Matt). Why: the app stays the one place answers live.

- 2026-11-08: anyone can type a question; posting it needs signing in, and nothing typed is
  lost on the way (Matt). Why: rate limits and the spam check need an account, but the
  question shouldn't be lost to a sign-in wall.
- 2026-11-08: "I'm on it" opens the question up again if no Draft comes within 3 days (Matt).
  Why: a claim shouldn't block a question forever.
- 2026-11-08: theories and talk about a question live in its chat thread, like any entry's;
  a Draft marked "A theory" sets the question to Theory until a confirmed answer ships
  (Matt). Why: one place to talk, and the chat already does it.
- 2026-11-08: built in its own chat, `Village · Block: Questions` (the hub).

## Open questions

- None open with Matt right now.

## Later

- Notifications outside the site (email, Discord) when your question is answered.
- Rewards: answering a question others asked counts toward titles and Market Day.
