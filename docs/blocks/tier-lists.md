# Block: Tier lists

**Status:** Live, first version (2026-11-08): SQL applied; Fortune's Weave · Units and classes · Unit tiers · **Chat:** `Village · Block: Tier lists` · **Mockup:** none yet ·
**Code:** `src/lib/tiers.ts` (tiers, your list, the community tier; plain and tested), `src/components/tiers/`
(`TierList.tsx` the Block, `CommunityTier.tsx` the card pill, `useTierList.ts` loading and saving),
`src/app/g/[game]/(app)/tiers/[list]/` (a shared list at `/g/<game>/tiers/<id>` and its picture, `src/lib/og-tiers.tsx`,
`src/lib/tier-share.ts`) · **Database:** `supabase/migrations/20261109000000_tier_lists.sql` (reviewed by the hub
2026-11-08), then `seed-app.sql` (adds Fortune's Weave · Unit tiers), then
`20261109120000_tier_lists_submit.sql` (submitting, unique lists, sharing by list, removed reasons per player; reviewed by the hub, run by Matt 2026-11-08)

A Block of its own (Matt, 2026-11-08): a **Tier list** Block sits on a Page and ranks the pieces of
another Block on that Page, like "Unit tiers" ranking Units. A builder can limit it to some routes
or groups ("Fiery Mane tiers"), but doesn't have to.

## What it's for

Matt (2026-11-08): build our own tier lists rather than embed another site. TierMaker has no
way to connect to it, and editorial sites' lists are their product. Outside lists can still be
linked and credited.

A tier list answers "who's good?" in one look, and it's one of the things players most like to
make and argue about. Village can do what a TierMaker picture can't: every list counts toward
the community's tier for each entry, the tier shows on the entry itself, and the pieces are the
real entries, so tapping one opens its card.

### The moments (from the intuitive-design steps)

| | Choosing: "who should I use?" (primary) | Glancing: "is she any good?" | Making: "here's my list" | Sharing: "look at my list" |
|---|---|---|---|---|
| **Who** | Any player | Any player | An engaged player, often after a playthrough | Same player |
| **Trigger** | Picking who to deploy, recruit, train or spend resources on; a new unit just joined | Reading a character's or item's card | Finished a run; disagrees with the community; bored on a break | Just made their list; a Reddit or Discord thread is asking for lists |
| **State** | Weighing it up, a bit unsure, game paused | Curious, a glance | Opinionated, relaxed, wants it to look right | Proud, wants a reaction |
| **What they know** | The names on their screen | The entry they're on | Their own opinions, every name | Where they'll post it |
| **Surroundings** | Phone by the TV, controller down | Same | Phone on the sofa, or a computer | Phone (Discord) or computer (Reddit) |
| **Done looks like** | Knows who the community rates, and why; picks | Sees "Community tier: A" and moves on | Every piece they care about is in a tier, and it's saved | A good-looking picture with a link, posted |
| **Time** | Under 30 seconds | A glance | 3 to 10 minutes | Under 30 seconds |

Real-world signal (general knowledge of how players use tier lists, not a fresh study): the
usual complaints are lists with no reasons ("why is X in C?"), lists that don't say what they're
for (hard mode or normal, early game or late, ranked play or story), lists that go stale after a
patch, one creator's list taken as fact, and TierMaker being fiddly on a phone (long drags across
a small screen, pieces landing in the wrong row). Players ask "who's the best unit in chapter
X?", "is <name> worth using?", "tier list for <game> hard mode", and post lists as pictures.

What this means for the design:
- **The community tier is the answer**, not one person's list. It's the Block's default tab,
  and a small "Community tier: A" sits on the entry's own card.
- **Say what the list is for.** The Block's intro line ("Hard mode, whole game") sits above the
  tiers, so everyone ranks the same thing. Several Tier list Blocks can rank the same Block for
  different jobs.
- **Reasons beat letters.** A player can add one line to any piece they place; the reasons show,
  without names, when you open a piece in the community list.
- **Making a list works by thumb.** Tap a piece, tap a tier. Dragging works too, but is never
  the only way.

## What a player sees

### The Tier list Block

The board (Matt, 2026-11-08: more attractive, tighter): an ink header with a yellow trophy, the
list's **title** ("MVP" unless the builders named it: "Hottest", "Most interesting"), a line
under it and a chip on the right (how many lists; in My list, "4 of 55"). Then the tiers as one
card of rows with no gaps between them, each a letter tab in the Page color (fading from S down;
S wears a small crown) on a light wash of that color. On a phone, 4 pieces fit a row at full size
(48 px pictures). Pieces snap solid as they're placed (the brand's one motion). The look lives
in `src/components/tiers/BoardParts.tsx`, shared with a shared list's page.

Its title and intro line, then two tabs, yellow on the one you're on:

- **Community** (the default): one row per tier, best first: the tier's letter in a box on the
  left (the best tier in the full Page color, fading down the list) and the pieces in it, names
  under them, pieces never touching. Each piece sits in its community tier. Pieces with fewer
  than 5 lists sit in a last row, "Still deciding", as split outlines, so it's clear they aren't
  settled; pieces nobody has placed yet aren't shown there. A line says "From 23 lists".
  Pieces with fewer than 5 lists sit in the tier they're leaning toward as split outlines, settled
  ones solid (Matt, 2026-11-08, replacing a separate "Still deciding" row, which with one list
  became a heap of outlines under empty tiers); a line under the board says what outlines mean.
  Under the board, **how it's built**, in plain words: on an empty board three steps (make your
  list, sign in so it counts, the community decides) and a yellow "Make the first list"; once
  there are lists, one line and "Add my list" or "Edit my list".
  Tapping a piece opens a small sheet: the piece and name, "Community tier: A · 23 lists", the
  spread as a bar ("S 4 · A 12 · B 6 · C 1"), reasons people gave (newest first, no names, each
  with a report flag), "Open <name>" (its card) and "Place it in my list".
- **My list** (was "Mine"): above the board, your lists as chips: your list for the Block's reason
  ("MVP", the one that can count), any unique lists of yours, and "Create a unique list". The board's
  header has the list's title, where it stands, "4 of 55" and a Share button.

### Making your list (My list)

- **The tray** (Matt, 2026-11-08): the pieces not placed yet sit in a sheet that slides up from the
  bottom of the screen while the board is in view (above the phone's tab bar; on a computer, lined
  up with the board's column), with a handle to make it bigger. Pieces show their uploaded picture
  inside the split outline.
- **Tap to place** (the main way, made for phones): tap a piece and it lifts with a yellow ring,
  the tier rows light up as targets, and the top of the tray shows the piece's name, its tier
  buttons (S A B C D) and "Add a reason". Tap a row or a tier button to drop it at the end of that
  row. Tap a placed piece to pick it up again; "Not placed" sends it back to the tray.
- **Drag** (also works): press and drag a piece onto a row or back to the tray, on a computer with
  the mouse, on a phone after a short press (so scrolling the page still works).
- Within a row, order matters only to you (left is better); the community tier uses the row.
- **Start from the community's**: one tap fills an empty list with the community tiers, so you
  only move the ones you disagree with.
- **Saved as you go.** Your MVP list: on this device always, and in your account when signed in.
  Unique lists: in your account (signing in is needed to make one).
- **Submit to community** (Matt, 2026-11-08): under your MVP list. Saving doesn't make it count;
  submitting does, as the list is at that moment. Change it afterwards and the box says "You've
  changed your list since you submitted it" with "Submit changes"; "Withdraw" takes it back out.
  Not signed in: "Sign in to submit".
- **Create a unique list** (Matt, 2026-11-08): a list of your own with its own title ("Hottest"),
  built from scratch. It never counts toward Community; rename it, delete it, or share it.
- **Share** (the header's button, separate from submitting; Matt, 2026-11-08): makes the list's
  link readable and opens the phone's share menu, or copies the link. The link opens the list in
  Village with your name and a share picture of your tiers. Under the board, "Its link is shared ·
  make it private". On the Community tab, the header's Share sends the community board.

### On an entry's card

A small pill under the name: "Community tier: A" (or "Leaning A" before 5 lists), in the Page
color. Tapping it opens the Tier list Block with that piece's sheet. Nothing shows when no Tier
list ranks the entry or nobody has placed it.

## The community tier

- **Median, not average.** Each list puts an entry in a tier. The community tier is the best
  tier that more than half the lists put it in or above. Why: a handful of joke lists can't drag
  a favorite from A to D, and a median always lands on a real tier.
- **Only placed pieces count.** Leaving a piece in the tray means "no opinion", not the last tier.
- **5 lists before it's settled**, like every other opinion vote: under 5, the piece is "Still
  deciding" and its card says "Leaning A" with no count.
- **One counted list per player per Tier list Block**: the copy you submitted. Submitting again
  replaces it. Nobody sees who ranked what, only totals, unless you share your list.

## Builders

A Tier list Block holds (`tier_setup`): which Block it ranks; its tiers, best first (S, A, B, C,
D to start; builders can rename them or add and remove tiers, and a tier's key never changes, so
renaming keeps every list); and optional limits: only some routes, or only some values of a tag
(Group: Fiery Mane). Its intro line says what it's for. Setting these up in the Workshop's Set up
comes in slice 2; until then the starter data sets them (Fortune's Weave · Units and classes ·
"Unit tiers", ranking Units, S to D, no limits).

## Data

- **game_blocks.tier_setup** (jsonb): `{ ranks, tiers: [{ key, label }], routes?, tag?: { key, values } }`.
- **tier_lists**: a player's lists for a Tier list Block, by kind: `main` (your MVP list, one),
  `submitted` (the copy the community counts, one, written only by submitting), `unique` (your own
  titled lists, up to 20). Who, whether its link is shared, the game patch (filled later), when it
  changed. Readable only by its maker, or by anyone once shared.
- **tier_placements**: one per placed piece: the entry (card), its tier key, its place in the
  row, an optional reason (up to 140 characters).
- **save_tier_list(game, block, pieces, list?)**: saves your main list, or one of your unique lists,
  whole; only the ranked Block's pieces and its own tiers. About 600 saves an hour at most.
  **submit_tier_list** copies your main list into the submitted copy; **withdraw_tier_list** deletes
  it. **create_unique_tier_list** / **rename_unique_tier_list**. **share_tier_list(list, on)**.
- **tier_tallies(game, block)**: how many submitted lists put each piece in each tier. The median
  and the 5-list rule are worked out in `src/lib/tiers.ts`, tested.
- **entry_tiers(card)**: every Tier list ranking that entry, with counts, for the card's pill.
- **tier_reasons(game, block, card)**: reasons for one piece from submitted lists, newest first, no names.

- **Reports**: a flag can point at a reason (`flags.tier_placement_id`); a moderator removes the
  reason (`remove_tier_reason`), the placement stays, and its reports close. The removed words are
  kept (`removed_reason`) so the player's next autosave can't put them back; new words still save.
  The player's device drops the old words the next time it loads their list from the account.
  Moderators can read placements (not whose list), so a reported reason shows on the Notice Board.

## Shared parts (go-ahead from the hub, 2026-11-08)

- The database: the migration above, and its checks in `supabase/tests/schema-check.mjs`.
- `src/data/pages/types.ts` (the 'tierlist' type and `tierSetup`), `src/lib/app-data.ts`
  (reading it), `scripts/build-seed.ts` and the Fortune's Weave starter data.
- `Blocks.tsx` (showing the Block), `CharacterCard.tsx` (the pill).
- The Workshop: Tier list Blocks are left out of its lists (`workshop/page.tsx`), `EntryForm.tsx`
  knows the type, and reported reasons show on the Notice Board with "Remove reason"
  (`useWorkshop.ts`, `Workshop.tsx`).
- `src/lib/og-card.tsx`: its picture helpers are exported for the tier list picture.

## Build plan

1. **Slice 1** (this one): the database; `src/lib/tiers.ts`; the Tier list Block with Community
   and Mine (tap to place, drag, the tray, reasons, start from the community's), saved on the
   device and to the account; sharing with a picture; the pill on entry cards; reported reasons
   on the Notice Board.
2. **Slice 2**: Set up for a Tier list Block in the Workshop (what it ranks, the tiers, limits);
   ranking a Block on another Page.
3. **Slice 3**: outside lists (below), patch fading, voting on reasons.

## Outside lists (slice 3)

A creator's tier-list video or a TierMaker link can be added to the Tier list Block, credited to
its maker and voted "This helped", the same way Videos do it. YouTube videos already fit: the
videos table has room for a video about a whole Block (`block_key`). TierMaker and other sites
need the videos table to take other links too, a hub change.

## Checked (2026-11-08)

On the production build, desktop and phone (375 px): the Block shows under Units; Community with
no lists yet (short rows and an invitation); Mine as a guest: tap a piece, then a tier button or a
row; the bar sits above the phone's tab bar; a reason (140 characters) moves with its piece; mouse
drag between rows and from the tray; the list is kept on the device across reloads; `?mine=` opens
Mine; bad shared-list links show Not found; no sideways scroll; no console errors.
Not yet checked, as they need a signed-in villager: saving to the account, the Community tab with
real lists, a piece's sheet with its spread and reasons, the card pill, sharing and its picture,
and a reported reason on the Notice Board. Touch drag needs a real phone (the emulator taps as a
mouse).

## Decisions

- 2026-11-08: the tray resizes by dragging its handle (tap it for short or tall; arrow keys too), and
  remembers its height on the device (Matt). Its top row keeps one shape: Not placed and what's
  picked, then the tier buttons in their colors and three small tools (back to the tray, why it's
  here, done), greyed until they apply (Matt: the old bar changed shape and felt bulky).
- 2026-11-08: stats (Matt): in Community, a tier's letter opens everyone any list put in that tier,
  most often first, with "12 of 23 lists"; a piece's sheet shows a bar per tier with its count.
  Counts follow the 5-list rule: under 5 lists for a piece, it says so instead.

- 2026-11-08: a list counts only once submitted, and later changes count when submitted again
  (Matt). Why: players choose when their opinion goes in; trying things out stays private.
- 2026-11-08: each Tier list keeps one reason set by its builder (MVP); players can also make
  unique lists with their own titles, built from scratch, that never count (Matt).
- 2026-11-08: Share is its own button in the board's header, separate from submitting (Matt).
- 2026-11-08: the Not placed tray is a slide-up sheet on phones and computers (Matt).
- 2026-11-08: the row tints are stronger (Matt: "so subtle that I almost didn't notice it").

- 2026-11-08: each tier list has a title, "MVP" by default (Matt): `tier_setup.title`, set by
  builders (in Set up, slice 2). Shown in the board's header and on shared lists ("Matt's MVP list").
- 2026-11-08: the board got more character and less air (Matt): ink header with the title, joined
  rows on tinted washes, a crowned top tier, 4 pieces a row on phones without smaller pictures.
- 2026-11-08: the tabs are Community and My list, and the Community tab says how it's built (Matt:
  "it's not clear how to build the community tier list").
- 2026-11-08: uploaded pictures show in the Not placed tray too (Matt).

- 2026-11-08: build our own tier lists; link and credit outside ones rather than embed (Matt).
- 2026-11-08: a Tier list is its own Block, ranking another Block's pieces (Matt). It can be
  limited to some routes or groups, but doesn't have to be (Matt). Why: one Page can hold several
  lists for different jobs, and a list can be about one faction or route.
- 2026-11-08: builders can rename, add and remove tiers; S to D to start (Matt). Tier keys never
  change, so lists survive renames; counts for a removed tier are left out.
- 2026-11-08: the community tier ships in the first slice (Matt). It's the median of everyone's
  lists, hidden as "Leaning" until 5 lists.
- 2026-11-08: lists are anonymous unless their maker shares one (Matt).
- 2026-11-08: players who aren't signed in can make a list on their device; signing in counts it
  and lets them share it (Matt).
- 2026-11-08: the "Community tier" pill on entry cards and one-line reasons are in the first
  slice (Matt).

## Open questions (for Matt)

- Several lists per Block for different jobs need only another Tier list Block. Is that enough,
  or should one Block hold tabs ("Early game", "Hard mode")?
- Should the community list show pieces nobody has placed yet (as outlines in a "Not ranked yet"
  row) so players see what's missing?
- Voting on reasons ("This helped") so the best ones rise: slice 3, or sooner?

## Later

- Patch fading: a list made before the latest patch counts for less, and "Made before patch 1.2"
  shows on shared lists.
- Comparing your list to the community's ("You rate Fabio two tiers higher than most").
- Tier lists for Collections (Classes) once Collections become piece Blocks.
