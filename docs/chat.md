# The Workshop chat

**Status:** Building: threads and `#` references built 2026-11-01; Town Hall next ·
**Chat:** `Village · Chat` (owns the chat's design and this file) · **Code:**
`src/app/g/[game]/workshop/chat/Chat.tsx` (`Stream`, `ThreadCard`, `ThreadPanel`, `Message`,
`Composer`, `useThreads`), `chat/bits.tsx` (report form and small shared pieces),
`src/lib/threads.ts` (thread keys and the stream's order, tested in `threads.test.ts`),
`Workshop.tsx` (where the stream and thread sit, Draft cards' Chat button, `ReportQueue`),
`EditorShell.tsx` (`EditorChat`, `EditSwap`), `useWorkshop.ts` (loading, sending, live
updates, reports, moderator actions) · **Database:** `chat_messages` and `flags` in
`supabase/migrations/` (`20261020000000_init.sql`, `20261021000000_workshop_live.sql`,
`20261021120000_moderation.sql`, `20261101000000_chat_threads.sql`) · **Live on:** every
game's Workshop

The chat's code sits in Workshop files that other chats also edit. Before changing any file in
`src/app/g/[game]/workshop/` or the `chat_messages` schema, tell `Village · Main` what will be
touched, so two chats never edit the same file at once.

## What it's for

The Workshop is where villagers build a game's app; the chat is how they talk while they do
it. People reach for it to ask the village something they can't settle alone ("does anyone
know where you recruit Rosado?"), to share a find before it's a Draft, to argue for or against
a change, and to say hi. It is the only place on the site where villagers talk to each other.
It is not the game app: players reading the app never see it.

## Who uses it and when

A first draft of the moments, from what the site does today. **To confirm with Matt**
(intuitive-design step 4); nothing here has been checked against real villagers yet.

**Primary: stuck in the middle of building.** A Builder is fixing or adding an entry, or
setting up a Block, and hits something they don't know or aren't sure of.
- *Trigger:* a blank field they can't fill, or two sources that disagree.
- *State:* focused, slightly stuck; the editor is open and they don't want to lose it.
- *Knows:* the entry and the field ("Rosado's recruit chapter"), rarely the Page's name.
- *Surroundings:* often the game running beside them; on a phone, one hand.
- *Done:* the question is posted where the right people will see it, and they go back to the
  edit. Later, they get the answer without hunting for it.
- *Time:* 15 seconds to ask; the answer can come minutes or hours later.

**Secondary moments**
- **Reviewing a Draft.** "Is this right?" or "why this change?". They want to talk to the
  author and other voters about that one Draft. Done: a reply on the Draft, seen by whoever
  cares about it.
- **Sharing a find.** Something in the game surprised them ("you can recruit X if you
  spare Y"). Not sure enough for a Draft yet. Done: others confirm or say "make it a Draft".
- **Coming back.** They asked something yesterday. "Did anyone answer? What's new?" Done:
  seeing what's new for them in a few seconds.
- **Moderating.** A message is reported, or a spoiler slipped through. Done: handled in a tap,
  with the reporter thanked.

## How it worked before threads (until 2026-11-01)

Kept for the record; "Step 1: threads" below says what changed.

### One chat per game, sliced by Page

- Every game has one stream of messages. Each message is tagged with **what it's about**: a
  Page (stored in `block_key`, which holds a Page id since 2026-10-22, despite its name), or
  nothing, meaning "the whole game".
- The chat **follows the Page chip** chosen across the top of the Workshop. The chips are
  shared with the work column, so choosing a Page changes both the Drafts you see and the
  chat you see.
  - **Everything** shows every message in the game, with nothing to say which Page each is
    about. A message sent here is about the whole game.
  - **A Page** (say Units and classes) shows only messages about that Page. The heading reads
    "Chat · about Units and classes · show all", and a message sent here is about that Page.
    "show all" switches the chip back to Everything, which also changes the work column.
  - **Notice Board** shows every message (like Everything) while the heading says "about the
    Notice Board", and a message sent there is about the whole game.
- The newest 300 messages per game are loaded; there is no "load earlier". The Page filter
  works on those 300.
- The list jumps to the newest message whenever one arrives. With fewer than 4 messages a
  "It's quiet in here" note invites a first message.

### Draft threads ("Discuss")

- Every Draft card has **Discuss · n**. It opens a thread inside the card, with its own box
  ("Reply about this Draft"). A thread message is linked to its Draft (`linked_draft_id`) and
  tagged with the Draft's Page.
- Thread messages **also show in the main chat** (in Everything and in their Page) with a tag:
  "on “Draft title”". The tag can't be tapped, and replying in the main chat doesn't join the
  thread.
- A Draft opened from a link (`?draft=…`) or from "See my Draft" opens in a sheet with the
  same Discuss button.

### A message

- Avatar, name, how long ago, the text. Spoilers show as "Spoiler · tap to show".
- The box is one line: a text field, an eye button for "spoiler" (hidden behind a tap until
  someone chooses to read it), and a yellow Send. Up to 4000 characters.
- Visitors who aren't signed in can read everything, and see "Sign in to chat" in place of
  the box.
- No replies or quotes, no editing or deleting your own message, no reactions, no mentions,
  no links to entries or Drafts, no pictures.

### Moderation

- **Report** (any signed-in villager, on anyone else's message or Draft): under "…" on a
  message, or the flag on a Draft. Pick a reason (Spam, Rude or hurtful, Unmarked spoiler,
  Wrong or made up, Something else), add a note if you like. Then "You reported this".
  One report per person per thing; 20 reports an hour at most.
- **Moderators** see a "…" on every message: Mark as spoiler (or unmark), and Remove (or
  Restore). Removed messages vanish for everyone else, live; moderators still see them
  faded, with "Removed · only moderators see it".
- **The Notice Board** chip: for moderators, open reports, one card per reported thing, with
  the reasons, notes, and buttons (Remove message, Mark as spoiler, Remove Draft, "It's fine,
  dismiss"). Acting on a report closes it. The chip's count is the number of open reports,
  for moderators only. Villagers see "No reports waiting" with a line about players' "not
  quite" taps in the app, which aren't shown here at all (they're a separate `reports` table).
- **Rate limit:** 10 messages a minute per person, from the database.
- Not built yet, though planned for launch mode: an AI spam check. The AI tagger the schema
  mentions ("set by the author or the AI tagger") doesn't exist; the chip decides the tag.

### Wide screens and phones

- **Wide screens** (from `lg`): two columns that each scroll on their own. The chat is on the
  left (20 to 24rem wide), the work on the right. The chat folds to a thin strip with a count,
  remembered per device, to give an editor more room. Editors open in the work column, so the
  chat stays beside them.
- **Phones and tablets:** a "Build | Chat · n" switch under the chips shows one at a time.
  Inside an editor (which fills the screen), a pencil and bubble switch in the editor's bar
  opens the chat over the edit, with the same switch in the same place to flip back. The edit
  stays open meanwhile. The chat shown is the Page chip's, not the entry being edited.
- The counts on the strip, the phone switch and the bubble are how many messages are loaded
  in the current topic, not how many are new.

### Elsewhere on the site

- A game's front page counts villagers active this month from chat and Drafts
  (`GameActivity.tsx`), and the profile page counts a week as active when you chat, vote or
  post a Draft in it (`/me`).
- The first-steps card in the Workshop has "Say hi, or ask the village", ticked once you've
  sent a message.
- Town Hall (`game_id` null) is planned as a site-wide chat; for now its page points to each
  game's Workshop chat.

## Rough spots

What reads as unclear or inconsistent today, from walking the moments above.

1. **Where does my message go?** The topic is set by the Page chip, which you chose to look
   at Drafts, not to pick a chat room. Nothing at the box says which Page your message will
   be tagged with until you read the small heading.
2. **Who will see it?** A message about a Page shows only to people on that Page or on
   Everything; a whole-game message shows only on Everything. Someone asking in Everything
   is invisible to people working on a Page.
3. **The Notice Board pretends to be a topic.** Its heading says "about the Notice Board" but
   it shows and sends whole-game messages.
4. **Draft threads are half separate.** They show in the main chat, tagged, but you can't
   tap through to the Draft or reply in the thread from there.
5. **Stuck while editing, the chat doesn't know what you're editing.** Asking about Rosado from
   his edit posts to the Page in general, with no link back to Rosado.
6. **No way to know what's new.** Counts are totals, not unread; nothing says someone replied
   to you. The "coming back" moment has nothing to land on.
7. **Old messages fall off.** Only the newest 300 per game load, so a quiet Page's history
   disappears once a busy Page fills up, and there's no way to scroll back further.
8. **Reading gets interrupted.** Any new message scrolls you to the bottom, even mid-read.
9. **Small mismatches.** `block_key` holds Page ids; for moderators the counts include
   removed messages while the Discuss count doesn't; the villager Notice Board text describes
   something it doesn't show.

## Step 1: threads (built 2026-11-01)

- **Thread keys** (`src/lib/threads.ts`): `card:<uuid>` for an entry in the app, `draft:<uuid>`
  for a new entry's Draft (it moves to the card once published, because publishing sets the
  Draft's card), `block:<id>` for a Block's setup, `entry:<block>.<id>` for an entry not yet in
  the database. Stored in `chat_messages.thread_key`. Old Discuss messages have no key and
  join their Draft's thread, so nothing needed copying.
- **The stream** reads top to bottom as before, but each thread is one card at its newest
  message: the entry's piece (or the Block's symbol for a setup), its name, where it lives,
  how many messages and Drafts, the last two messages, and a reply box. A reply typed there
  lands in the thread. Tapping the card opens the thread.
- **The thread panel**: the piece, name and where, how many people are talking, "Fix" (or
  "Set up") to open its editor and "See it in the app". Messages and the thread's Drafts in
  one timeline; each Draft says who posted it and its status, with "Vote" or "See Draft" to
  open it. Opening a thread loads its whole history, past the newest 300 messages.
- **Where it sits**: on the widest screens (2xl) the thread opens beside the stream; on other
  wide screens, and whenever an editor is open, it takes the stream's place, with a back
  arrow. (An editor shows its preview beside the form only when it has 768px; a third column
  would squeeze it into the phone-style sheet.) On phones it's in the Chat tab,
  or over the editor with the pencil/bubble switch.
- **Editors open their thread**: fixing Eshmel opens Eshmel's thread beside the edit, setting
  up Characters opens its setup thread; closing the editor puts that thread away.
- **Draft cards** have "Chat · n" (their thread's count) in place of "Discuss", and open the
  thread.
- **Smaller fixes**: the stream no longer jumps to the bottom while you're reading further up;
  the Notice Board chip no longer claims to be a chat topic; a Page chip shows "Units and
  classes only · show all"; the main box says "Message everyone".
- **Safe before the SQL**: until `20261101000000_chat_threads.sql` is run, the chat reads
  without threads, and posting in a thread says the database needs an update.

Not yet: Town Hall, presence ("Ben is editing"), unread marks, a thread count on entries
in the app.

## Step 2: `#` references (built 2026-11-01)

- Typing `#` in any chat box (the main chat, a thread, a card's reply box) opens a list
  above it; `#esh` finds Eshmel with the app's forgiving search. Arrow keys or a tap choose,
  Enter or Tab picks, Escape closes. The list covers every entry, each Characters Block's
  setup, and new entries still waiting as Drafts.
- Picking writes `#Eshmel` in the box; sending stores a code for his thread instead of his
  name (`<#fortunes-weave:card:…>`, `src/lib/refs.ts`), so renames don't break it.
- The message shows `#Eshmel` as a tag in his Page's color that opens his thread, and the
  first one gets his card underneath, with a reply box that posts into his thread. The
  Notice Board shows tags as names too.
- No database change. Not yet: browsing with a `#` button, pasted links becoming cards,
  "linked from the chat" in the thread, other games (with Town Hall).

## Proposal: one stream, threads that surface (2026-11-01, step 1 built)

The answer to "each thing gets its own chat" vs "split chats go quiet":
- **One living stream per game**, the Workshop chat, that everyone sees. General talk and
  planning ("who's taking chapters 1 to 5?") happen here.
- **A thread per thing being built**: an entry (Eshmel), a Block's setup (Characters set up),
  later a Page. Eshmel's thread is his own chat, but it is not a separate room: it lives in
  the stream as a live card (latest message, a reply box, "Open beside"), and new replies
  bump it, so the stream always shows what's moving.
- **A thread belongs to the thing, not to one Draft.** Eshmel's edits, his Drafts and
  everything said about him collect in one place. A posted Draft shows up in the thread as
  a card you can vote on, so feedback and votes sit with the talk that led to them.
- **Open from anywhere, keep both.** The same thread opens from his edit (beside it), his
  Draft, a card in any chat, his card in the game app, or a shared link. "Open beside" docks
  it next to the chat you're in, so you can talk in both. On phones it opens over, with the
  same flip-back switch as the editor.
- **Coordination in the thread's header:** who's here and who's editing right now, so two
  people don't fix the same entry at once.
- **Page chips filter, they don't divide.** Choosing a Page narrows the stream to its
  threads and messages; nothing is hidden from people who stay on All.

What it replaces: today's Page topics, the separate Discuss thread per Draft, and the
Notice Board as a chat topic (it stays a moderators' queue).

### Pointing at a thread from anywhere: `#` (proposed 2026-11-01, not agreed yet)

Asked for by Matt: a site-wide way to reference a specific thread, so that in the
community chat outside the apps (Town Hall) people can ask for help and point each other
to the right place. Short to type, and easy to find by browsing.
- **Type `#` in any chat box** and a picker opens. Typing searches every game's entries
  and Blocks by name, forgivingly, like the app's search: `#esh` finds Eshmel. Each result
  says where it lives ("Fortune's Weave · Characters · 4 in chat"), so look-alikes are told
  apart. Inside a game's Workshop that game comes first; in Town Hall, all games.
- **Or browse**, for when you don't know the name: the picker also walks Game › Page ›
  Block › entry with the app's own symbols and colors, the same path as the app's
  navigation. A `#` button beside the box opens it for people who don't know the shortcut.
  Threads you're in and recent ones sit at the top.
- **What's sent is a tag, `#Eshmel`**, colored like his Page. It points at the thing itself,
  not at its name, so a rename doesn't break it. Below the message, a card shows the entry
  (piece, name, a line of what it is) and the thread's latest message, with "Reply in
  Eshmel's chat", "Open in app" and "Open beside". A reply typed in the card lands in
  Eshmel's thread (agreed 2026-11-01). One reference serves both the answer
  (the app entry) and the conversation (the builders' thread).
- **Links work too.** Every entry already has an address (`/g/fortunes-weave/units-and-classes/eshmel`).
  Pasting one in any chat makes the same card, and every thread header gets "Copy link",
  so references also work from Discord or a text.
- **The thread hears about it**: "Mo linked this from Town Hall", so builders can come
  help, and the asker can follow along from the card.
- **In the app**, an entry's panel shows "Chat · 4", which opens his thread. That's the
  navigating-within-the-app way to find it.
- Why `#`: in Discord and Slack, `#` already means "a place to talk", `@` means a person,
  and `/` means a command. Gamers know these.

## Decisions

Dated, newest last, each with why.
- 2026-10-20: one chat per game, with block chips across the top. Why: one place per game
  keeps a small community together; the chips let talk be about one part of the app.
- 2026-10-21: the chat goes live with Supabase Realtime: messages stream in, signed-in
  villagers post, anyone can read. Spoiler tags and a 10-a-minute limit from day one. Why:
  launch mode starts open; spoilers and spam are the first risks.
- 2026-10-21: reports, removal and mark-as-spoiler, with a Notice Board queue for
  moderators. Removed messages are hidden, never deleted. Why: a report button from day one;
  moderators can undo their own mistakes.
- 2026-10-22: messages are tagged with a Page rather than a Block. Why: the app became Pages
  made of Blocks, and the chips became Pages.
- 2026-10-31: the chat sits beside the editor on wide screens and folds to a strip; on phones
  a pencil and bubble switch flips between the edit and the chat. Why: people need to ask
  while building without losing their edit.
- 2026-11-01: this file and `Village · Chat` own the chat's design. Why: one place to design
  and refine it, like a Block.
- 2026-11-01 (Matt): the whole structure is open to change. The chat serves two purposes:
  coordinating the build at hand, and being comfortable to use. A thing being built (e.g.
  Eshmel) gets its own chat for coordinating, which can be pulled up elsewhere and used
  alongside another chat. Why: builders need to talk about the exact thing in front of
  them. But chats must not be split so far that they go quiet. Why: a small community
  spread over many rooms leaves every room dead.
- 2026-11-01 (Matt): there will be a community chat outside the apps where people ask for
  help, and a site-wide way to reference a specific thread from it. The reference should
  be short to type (simpler than `/Fortunes weave_eshmel`) and easy to find by navigating.
  Why: help requests should lead straight to the right thread and entry.
- 2026-11-01 (Matt): a reply typed into a thread's card in another chat (say `#Eshmel` in
  Town Hall) lands in that thread. Why: you can talk in both places without leaving the
  one you're in.
- 2026-11-01 (Matt: "Lets start building"): step 1 is threads in the Workshop. One card per
  thread in the stream that moves down to its newest message (rather than every reply
  showing). Why: it keeps the stream readable while showing what's moving. Thread beside
  the stream only on the widest screens, in its place elsewhere. Why: the editor needs the
  room. A thread belongs to the thing, so all of Eshmel's Drafts share his thread.

## Open questions

For Matt to decide.
- Are the moments above right? Which one matters most: asking while building, talking
  about Drafts, or general hanging out?
- Does the proposal above fit: one stream, a thread per thing, threads surfacing as cards?
- Which things get threads: entries and Block setups only, or Pages too?
- A thread with many published Drafts (Eshmel has six) gets a long list of "posted a fix ·
  published" rows. Fold published ones into one line?
- Where outside the Workshop should a thread open: the game app, anywhere on the site, a
  link from Discord?
- Can visitors in the app read an entry's thread, or only villagers in the Workshop?
- Town Hall itself: one room for the whole community, or a room per game plus a general one?
- How should "something's new for you" work: unread marks, replies, notifications?
- Should the Notice Board be part of the chat at all, or only the moderators' queue?

## Later

Ideas raised before, not agreed yet.
- Town Hall: a site-wide chat and "Request a game" board.
- The AI spam check (launch mode) and an AI tagger that suggests a message's Page.
- AI drafting from chat: turning a find in the chat into a Draft, always with the author's
  "yes" first.
- A Discord bot that bridges a game's chat.
