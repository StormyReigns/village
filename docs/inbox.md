# Inbox and profiles

**Status:** Built 2026-11-20: news kinds, the inbox page, public profiles, profile pictures. The
SQL (`20261124000000_inbox_news.sql`, `20261125000000_profile_pictures.sql`) waits on the hub's
review and Matt's run · **Code:**
`src/lib/inbox.ts` (what each kind says and links to), `src/components/inbox/` (`useInbox`, `InboxRow`),
`src/components/Inbox.tsx` (the bell), `src/app/inbox/` (the page), `src/app/u/[username]/` (public
profile), `src/components/profile/standing.tsx` (title and badges, shared with `/me`) · **Database:**
`inbox` (20261108000000_questions.sql), `inbox_marks` and the news triggers (20261124000000) ·
**Tests:** `supabase/tests/inbox-check.mjs`

## Who uses it and when

**Primary: coming back.** A villager posted a Draft or asked something yesterday. Trigger: the
bell's yellow dot, or just opening the site. State: curious, a few seconds to spare. Done: they know
what happened to their work and who wants them, and tap straight to it. Time: under 30 seconds.

**Secondary**
- **Fixing a Draft.** Someone said "Seems wrong" or asked about it. Done: they're in the Draft's
  thread, ready to answer or fix it.
- **A moment of pride.** Their title moved up or a badge got a leaf. Done: they see it, maybe tap
  through to their profile.
- **Looking someone up.** A name in the chat they don't know: "who is this, can I trust this
  fix?" Done: one tap on the name shows their title, badges and what they've built.

## The inbox

News is written only by the database. Kinds (`type`), and the filter each sits under:

| Kind | When | Filter |
|---|---|---|
| `mention` | someone @mentions you in a chat message | Mentions and replies |
| `draft_activity` | replies or "Seems wrong" on a Draft of yours still waiting. One item per Draft; while unread it counts up and moves to the top | Mentions and replies |
| `draft_published` / `draft_declined` | a Draft of yours (not a batch) decided by someone else; declines carry the reason | Your Drafts |
| `batch_*` | your batch published, declined, or a row set aside | Your Drafts |
| `question_answered` | a question you asked or said "me too" to was answered | Questions |
| `title_up` / `badge_up` | your title moved up (tenure or role, Keeper stars); a game badge got its color or a leaf | Titles and badges |
| `community_*` | a community you listed was approved or declined | (All) |

- Items carry ids, not words: a message's or question's text is read from it, so removed things
  don't linger. "Seems wrong" never names the voter.
- Titles and badges use `src/lib/ranks.ts`'s steps, mirrored in SQL. `inbox_marks` remembers which
  steps someone has heard about, so clearing the inbox never repeats them. The migration marks
  everyone's current standing silently: only steps reached after it make news.
- A badge's first color comes with the "You're a Builder" news, so it isn't sent twice.
- **The bell** is the quick look: the newest 12, opening it reads them, "See all" goes to the page.
- **The page** (`/inbox`): New, then Earlier; filters by kind, and by game once there's news from
  more than one. "Keep as new" puts the bell's dot back; "Clear" deletes, with five seconds to undo.

## Profiles

- **Pictures** work like any forum (Matt, 2026-11-20): on `/me`, upload a PNG, JPG or WebP and crop
  it to a circle (drag, zoom), go back to your Discord picture, or remove it for your initials. The
  browser redraws it as a 400px square (dropping hidden photo details) into the public `avatars`
  bucket under your own folder, 2 MB at most. `profiles.picture` is null (Discord), `'none'`, or
  that file, and the database refuses anything else, so nobody can point a picture at an outside
  site. Everything that shows a villager reads it through `src/lib/avatar.ts`. A moderator can
  "Take down picture" on a public profile with a reason; the person reads it in their inbox
  (`picture_removed`) and can upload another. Tests: `supabase/tests/pictures-check.mjs`.
- `/me` is yours: picture, name, title ladders, badges, what you've added, settings. It links to how others
  see you and to your inbox.
- `/u/<username>` is public: name, title, Founder, when they joined, three counts (changes in the app,
  active weeks, votes), badges for the games they've started, their newest changes in the app ("Live"
  when that version is the current one; removals left out), and Drafts waiting (hidden from others by "Hide my Planted count"). Tapping a name
  in a Workshop chat message opens it. Moderators aren't marked: who moderates isn't public data.

## Later

- Muting kinds of news, and email or phone notifications for mentions.
- Names on Draft cards and in thread previews linking to profiles (they sit inside buttons today).
- A short bio, and a favorite game, on the public profile.
- Reporting a profile (picture or name) from the profile page, into the moderators' queue.
- An automatic image check on uploads, like the chat's spam check.
