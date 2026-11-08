# Questions (replaces the Mysteries Block)

**Status:** Building, steps 1 to 5 of 6 done (2026-11-08) · **Chat:** `Village · Block: Questions`
(designed in `Village · Block: Guides`) · **Mockup:** none yet · **Replaces:** the Mysteries
Block (a "rows" Collection) on every game's Guides Page · **Code today:** Mysteries is a
Collection with a Status filter; its panel has "I know the answer" and "Share a theory"
(`EntryPanel.tsx`), and the app's home shows "Help solve" (`HomeHooks.tsx`).

Not a Block: a part of every Page, plus its own place in the Workshop. It's written up here
with the Blocks because it replaces one.

## What it's for

The moment the app doesn't have the answer. A player searched, or looked where it should be,
and it isn't there: "how does Long join?", "does Cai have good STR?". Today they leave for a
wiki or Discord. Questions keep them here: one tap to ask, the question becomes a task for
the people who know, and the answer updates the app for everyone after them.

### The moments (from the intuitive-design steps)

| | Stuck: "the app doesn't say" (primary) | Knows: "I can answer that" | Building: "what needs doing?" |
|---|---|---|---|
| **Who** | Any player | A player who's further along, or did the research | A Builder in the Workshop |
| **Trigger** | Searched or looked, found nothing | Sees a question go by in the bar | Opens the Workshop with time to help |
| **State** | Mildly stuck, a bit let down | Curious, a little proud | Ready to work, wants a clear task |
| **What they know** | Their own words ("the elephant guy") | The answer, maybe a source | How the Workshop works |
| **Done looks like** | Question posted in under 20 seconds; the answer arrives in their inbox | Their answer is in the app, with their name on it | Picked the oldest question, shipped the fix, the question closes |

What this means for the design:
- **Ask is always one tap away**, on every Page, and in the "nothing found" note of every
  search, already filled in with what they typed.
- **Before posting, show what's already there**: matching entries in the app and questions
  already asked, so a duplicate becomes a "me too" instead.
- **The answer goes into the app**, where the next player will look first; the asker gets a
  short reply that points there.
- **Questions are tasks in the Workshop**: Builders see which are oldest and whether anyone
  already has a Draft going.

## What a player sees

- **The bar** (Matt, 2026-11-08): a slim bar at the top of every Page, under the Page's title.
  It shows one open question about that Page at a time ("? How does Long join? ›", "1 of 3
  open about Units") and slides to the next every few seconds. It stops while a finger or the
  mouse is on it or it has focus, and stays still when the device asks for less motion. On
  the right, a yellow **Ask** button (yellow = act on this). A Page with no open questions
  shows a quiet "Got a question about Units? Ask" instead.
- **Tapping the bar** opens the Page's questions in a sheet: each open one with how many
  players want to know ("+1 me too"), and answered ones with their reply and a link to the
  entry ("Updated Cai's STR stat for you · see Cai").
- **The Guides Page** also lists every open question in the game, grouped by Page (where the
  Mysteries Block used to be), so it's the place to go and help.
- **Asking**: a short sheet. One line for the question, "Which Page is it about?" set to the
  one you're on, a spoiler tick. As they type, "Maybe it's already here" shows matching
  entries and questions; tapping a matching question adds their "me too" instead of a new
  one. Posting needs signing in, so the answer can reach them; signing in comes at the end,
  and nothing typed is lost.
- **When it's answered**, the reply lands in the asker's **inbox** with an alert: a dot on a
  bell in the top bar, and inside, the reply with its link ("Updated Cai's STR stat for you ·
  see Cai"). Players who said "me too" get it as well.
- Spoiler questions show as "A spoiler question" in the bar until tapped, like spoiler steps.

## In the Workshop

- **Questions** is its own tab beside Drafts and "In the app" (Matt: "a unique part of the
  Workshop"). Open questions are sorted by how long they've been open, oldest first (Matt).
  Each shows how long it's been open, how many players want to know, and the Drafts already
  answering it: how many, and how long each has been open ("1 Draft, open 4 days"), so
  Builders can see where help is needed and vote on or nudge a Draft that's stuck. Every
  question stays open until it's answered.
- **Two ways to answer** (Matt), each with a short reply the asker reads:
  - **Update the app**: a fix to the right entry, or a new entry (a guide, a character), as a
    normal Draft with the question shown at the top. The Draft carries the question and the
    reply ("Updated Cai's STR stat for you"); when it ships, the question closes as answered,
    points to the entry, and the reply goes to the inbox.
  - **It's already there**: the Builder links the entry and writes the reply ("Cai's STR
    growth is 45%, one of the best: see his profile"). Nothing in the app changes, so it
    closes straight away and the reply goes to the inbox.
- Moderators can merge duplicates, reopen an answer that missed, or remove a question.
  Reports and the AI spam check apply as everywhere else.

## Data

A question isn't an entry: it has no Page content of its own. It's its own record: the
words, the Page it's about (and the entry, when it's about one), who asked and when, the "me
too"s, whether it's answered, the reply, and the entry it points to. Drafts can name the
question they answer. Each player gets an inbox of answers, with what's unread. New tables
in the database, so Matt runs SQL for it. The six Mysteries of Fortune's Weave move in as open
questions (what was known so far goes with them as a note for Builders); then the Mysteries
Block is removed from the Guides Page.

## Shared parts

Built in its own chat, `Village · Block: Questions` (the hub, 2026-11-08). Everything below
is shared, so that chat asks the hub before each file:
- **The app shell**: the bar under every Page's title (`PageView.tsx`), and the Guides Page's
  list of every open question (where the Mysteries Block was).
- **The top bar**: the inbox bell with its alert dot (`TopBar` in `Logo.tsx`), and the inbox.
- **The Workshop**: a Questions tab in `Workshop.tsx`, and loading, asking, "me too",
  answering and closing in `useWorkshop.ts`.
- **The entry form**: a Draft that carries the question it answers and the reply
  (`EntryForm.tsx`), so shipping it closes the question and sends the answer.
- **The database**: new tables (questions, "me too"s, the inbox), a link from Drafts to the
  question they answer, closing the question when such a Draft ships (`ship_draft`), rules for
  who can do what, and moving Fortune's Weave's six Mysteries in before removing the Block.
  Matt runs the SQL.

## Build plan

Built in `Village · Block: Questions`, one shippable step at a time (2026-11-08):

1. **Database** (done): `supabase/migrations/20261108000000_questions.sql`. Tables `questions`,
   `question_askers` (the "me too"s) and `inbox` (a type plus a small payload, written only by the
   database, so later news like "your Draft shipped" can use it). Drafts gain `question_id` and
   `reply`; the trigger `drafts_answer_question` closes the question when such a Draft ships
   (`ship_draft` is unchanged). RPCs: `answer_question` ("it's already there"), `reopen_question`,
   `merge_question`. Flags can point at a question. Own rate limits: 10 questions an hour, 60
   "me too"s an hour, 20 answers an hour. Plain helpers in `src/lib/questions.ts`.
2. **The bar and Ask** (done, `src/components/questions/`): the bar under every Page's title, the
   Page's questions sheet, the Ask sheet (also from a search that found nothing), every open
   question on the first Page with a guide Block, and "Help answer" on the app's front page.
3. **Workshop tab** (done, `workshop/Questions.tsx`): a third tab beside Drafts and "In the app",
   oldest first, with each question's open Drafts and how long each has been open; `?tab=questions`
   opens it. Question reports go on the Notice Board with the others (a "Reported" mark here).
4. **The two ways to answer** (done): "Update the app" opens the editor on the right entry (or a
   new one) with the question in a card at the top and "Reply to the asker" under it; the Draft
   carries both (`question_id`, `reply`), and Draft cards show "Answers: …". "It's already
   there" picks the entry, takes the reply and closes the question at once.
5. **Inbox bell** (done, `src/components/Inbox.tsx`, shown from `AccountButton.tsx`): a bell beside
   your avatar with a yellow dot while anything is unread; opening it marks everything read, and
   each reply links to the entry. On phones the avatar button drops your name (it's in its menu)
   so the bar keeps its room.
6. **Mysteries move in**: their 6 entries become open questions (what was known goes along as a
   note), and the Block leaves the Guides Page with its history kept.

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
  lost on the way (Matt). Why: the answer goes to the asker's inbox, so it needs an account.
- 2026-11-08: built in its own chat, `Village · Block: Questions` (the hub).
- 2026-11-08 (Matt, replacing three earlier calls): no theories, just questions and answers
  that update the app. An answer either updates the app ("Updated Cai's STR stat for you") or
  links what's already there with a reply. No "I'm on it" claim and no time limit: every
  question stays open until answered. The Workshop shows each question's open Drafts, how
  many and how long open, sorted by how long the question has been open, oldest first.
  Answers land in the asker's inbox with an alert. Why: simpler for everyone, and Builders
  can see for themselves where a question is stuck.
- 2026-11-08 (building): anyone signed in can answer with "it's already there"; the entry must be
  in the app, and it's rate-limited. The asker (or a moderator) can say "that didn't answer it",
  which opens the question again and clears the answer (the hub). Why: answering should be easy,
  and a wrong answer is one tap to undo.
- 2026-11-08 (building): inbox items carry ids and a short excerpt only; the question's words are
  read from the question, so a removed one doesn't linger in anyone's inbox (the hub).
- 2026-11-08 (building): the AI spam check isn't built anywhere yet; questions get it when chat
  and Drafts do. Until then: reports, spoiler tags and rate limits.

- 2026-11-08 (building, the hub): the bar keeps its slot while it loads and fades in there, so
  the Blocks never jump; it isn't read aloud on every slide; with reduced motion it never slides
  and shows back and next arrows instead; spoiler questions read "Spoiler · tap to show". The
  list of every open question goes on the first Page with a guide Block, never a fixed id, so
  every game gets one.

- 2026-11-08 (building, the hub): question reports are handled on the Notice Board with every
  other report, so moderators have one place to look; the Questions tab only marks them.

## Open questions

- None open with Matt right now.

## Later

- Alerts outside the site (email, Discord) when your question is answered.
- Rewards: answering a question others asked counts toward titles and Market Day.
- The inbox could carry other news later (your Draft shipped, someone replied to you).
