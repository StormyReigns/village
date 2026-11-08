# Videos (the first integration)

**Status:** Live, first version (2026-11-08): SQL applied; no videos added yet · **Chat:** `Village · Block: Videos` · **Mockup:** none yet ·
**Code:** `src/lib/videos.ts` (reading YouTube links and start times,
ranking; plain and tested), `src/components/videos/` (`Videos.tsx`: the part in two sizes, the card, the row, Add a video; `useVideos.ts`: loading, voting, adding),
`src/app/api/video-info/[id]/route.ts` (asks YouTube who made a video, kept for a day) ·
**Database:** `supabase/migrations/20261108180000_videos.sql` (reviewed by the hub, run by Matt 2026-11-08).

Not a Block of its own: videos are a part that sits on whatever they're about, on any entry
(a character, an item, a guide, a place), sized to fit where they show (Matt, 2026-11-08).
Written up here with the Blocks because it's built like one.

## What it's for

Matt (2026-11-08): connect video guides, YouTube first, so the community's favorite rises to
the top and the people who made them are fully credited.

A guide tells you the plan; a video shows it done. Some things are much easier to see than to
read: where a hidden chest is, how a boss moves, which tile to stand on. Village never hosts
videos. It points to the best ones, plays them in YouTube's own player, and puts the creator's
name on every one, so their views, ads and subscribers stay theirs.

### The moments (from the intuitive-design steps)

| | Stuck: "show me" (primary) | Choosing: "which video?" | Sharing: "this one helped me" | Creator: "that's my video" |
|---|---|---|---|---|
| **Who** | Any player | Any player | A player who found a good video, or the creator | The person who made it |
| **Trigger** | Read the guide, still can't picture it; lost the fight again | There are several videos for the same fight | Just beat the fight with a video's help | Sees their video in Village, or a viewer tells them |
| **State** | Frustrated, wants to see it done, no patience for intros | Skeptical: is it good, is it still right? | Pleased, wants to pay it forward | Protective: credit, views, the right link |
| **What they know** | The fight or the place; the guide they're reading | Nothing about the creators | The video's link, maybe the moment that matters ("4:32") | Their channel |
| **Surroundings** | Phone propped by the TV, game paused or on the retry screen | Same | Phone or computer, game paused or done | A computer |
| **Done looks like** | Watched the 30 seconds that matter, back in the game | Picked the one most players said helped | Pasted the link, it's there with the creator's name | Their name and channel on it, views going to them |
| **Time** | Under 2 minutes, starting at the right moment | A glance | Under 30 seconds | A glance |

Real-world signal (general knowledge of how players use video guides, not a fresh study): the
usual complaints are 20-minute videos for one missing step, long intros and sponsor reads,
comments like "skip to 4:32" being the most liked thing under a video, videos that are out of
date after a patch, clickbait titles, and videos that were taken down. Players search by
situation ("chapter 9 hard mode", "how to get to the island"), the same way they ask for guides.

What this means for the design:
- **Videos sit where the question is.** Creators make videos about everything: a character's
  best build, where to find an item, how to beat a fight. So a video goes on the entry it's
  about, not in a separate list of videos, and a player finds it where they're already looking.
- **Sized to the moment.** Where watching is the point (a guide for a fight), the top video is a
  big card. Where it's extra (a character's or item's card), it's a small row. In lists and
  tiles it's only a play mark with a count.
- **Start at the moment.** A video can start at a time ("Starts at 4:32"); the link's own `t=`
  fills it in.
- **The best rises.** Players vote on whether a video helped; the list is sorted by Standouts,
  so a video most watchers found helpful beats an old one many people skipped.
- **Credit on every video.** Its thumbnail and title, "by <channel>" linking to the channel,
  and "Watch on YouTube". It plays in YouTube's own player, so the creator gets the view.
- **Fast and private.** Only the thumbnail picture shows until a player taps play (YouTube's
  image server, which sets no cookies); the player loads only then, and it's YouTube's
  privacy-enhanced one (youtube-nocookie.com).
- **Adding takes a paste.** Paste a link, see the video with its creator, tap Add.

## What a player sees

Every entry can have videos. How big they show depends on where (Matt: "smaller thumbnail as
appropriate depending on when and where"):

| Where | How it shows |
|---|---|
| An open guide | The top video as a big card (below), then "2 more videos" |
| A character's or item's card (and the entry panel) | A "Videos" part: the top video as a small row (a thumbnail about 120 px wide, the title, "by <channel>"), up to two more, and "Add a video". Tapping play opens the player full width in place |
| Lists, tiles, profile strips | Only a small play mark with the count, on entries that have videos |

- **On a guide**: under "In short", a "See it done" part with the top video as a card: its
  thumbnail with a play button, the title, "by <channel>" (a link to the channel), "Starts at
  4:32" when set, and "Helped 23 players" once it has 5 votes ("New" before that). Tapping play
  swaps the thumbnail for YouTube's player, in place, at 16:9, starting at the moment.
- **Under the card**: "This helped" and "Didn't help" (signed in, one vote each, changeable;
  your choice shows in yellow), a report flag, and "2 more videos", which opens the rest, best
  first. Then "Add a video".
- **In the guide list** (later): a small play mark with the count on guides that have videos.
- **A video that's gone** (taken down, made private, or only allowed on YouTube) isn't shown, so
  the next one moves up. If YouTube can't be reached, the video says so, with "Watch on YouTube".

## Adding a video

"Add a video" opens a short sheet: paste a YouTube link (watch, youtu.be, shorts or embed
links all work). Village asks YouTube who made it (YouTube's free oEmbed address, no key) and
shows the card as it will look: "Is this the one?". "Start at" is filled from the link and can
be changed. Add needs signing in. A link that isn't a public video YouTube allows to be played
elsewhere is turned away with a plain reason.

## Data

A video isn't part of an entry's text: it has its own votes and who added it, and many can sit
on one guide. So it's its own record, like a question:
- **videos**: one list for every placement (the hub). Each video is about one thing: an entry
  (`card_id`), or later a whole Block (`block_key`) or Page (`page_key`), so one vote and ranking
  serves every place. Also YouTube's video id, the start time in seconds, who added it and when,
  and whether it's live or removed. Once per place.
- **Credit isn't stored.** The title and channel are read from YouTube whenever a video shows,
  through our own address (`/api/video-info/<id>`, kept for a day), so whoever adds a video
  can't fake who made it and a renamed video stays right. A video YouTube says is private, taken
  down or only allowed on YouTube isn't shown at all (the hub), so there's never a broken player.
- **video_votes**: one per player per video, +1 "This helped" or -1 "Didn't help". Who voted
  how stays private; only totals are shared (`video_tallies`). Nobody votes on a video they
  added, like authors and their own Drafts (the hub); their own video says "You added this".
- Taking a video down (`remove_video`): whoever added it, or a moderator. It also closes any
  reports about it.
- Ranking uses the Standouts maths (`src/lib/standouts.ts`, `public.wilson_lower` in SQL):
  net "helped" votes against everyone who voted, at the believable low end, with one of the top
  five places kept for the newest video so a new one gets seen. Totals stay hidden until 5 votes.
- Rate limits like questions (adding: 10 an hour), reports through the existing flags, and the
  thumbnail read from YouTube's image address for the video id.

New tables, so Matt runs SQL (reviewed by the hub, 2026-11-08). Checked in
`supabase/tests/schema-check.mjs`.

## Shared parts

Go-ahead for all of these from the hub, 2026-11-08.
- **The database**: the two tables, their rules, rate limits, and letting a flag point at a
  video (Matt runs the SQL).
- **The guide**: "See it done" in `GuideCard` (`src/components/app/Guides.tsx`).
- **The character and item card and the entry panel**: the small "Videos" part at the end of
  `CharacterCard.tsx` and of `EntryDetails` in `EntryPanel.tsx`. The cards find the entry's id on
  the entry they're handed (`cardIdOf`), so their callers didn't change.
- **Moderation**: reported videos show on the Notice Board with every other report, with "Take
  video down" (`useWorkshop.ts`, `Workshop.tsx`).
- Later: the play mark on tiles and the profile strip (`Characters.tsx`, `Items.tsx`).

## Build plan (first slice)

1. Database (written, reviewed by the hub): `supabase/migrations/20261108180000_videos.sql`.
   **SQL for Matt**: it runs after the two Questions files (`20261108000000_questions.sql`,
   `20261108120000_mysteries_to_questions.sql`). Safe to run twice. Until it's run, the app
   shows nothing about videos.
2. `src/lib/videos.ts` (done, tested): reading a YouTube link (id and start time), start times,
   YouTube's addresses, the ranking.
3. The credit lookup and the video card (done): thumbnail first, YouTube's privacy-enhanced
   player on tap, "by <channel>", "Watch on YouTube".
4. On a guide (done): "See it done" under "In short", the votes, "N more videos", "Add a video",
   the report flag, and "Take it down" for whoever added it or a moderator.
5. On character and item cards and the entry panel (done): the small "Videos" part.
6. Next: the play mark with a count on tiles and lists; videos for a whole Page or Block.

## Decisions

- 2026-11-08: Videos is the first integration (Matt, in the hub). YouTube first.
- 2026-11-08: videos are never re-uploaded or hosted by Village; they play in YouTube's own
  player on youtube-nocookie.com, so views, ads and subscriptions stay with the creator.
- 2026-11-08: videos can be added to any entry, wherever players need them (characters, items,
  guides...), and show bigger or smaller depending on where (Matt). Why: creators make videos
  about every kind of content, not just fights.
- 2026-11-08: credit comes from YouTube itself (oEmbed: title, channel, channel link), not typed
  by whoever adds the video, so it's always the real creator.

- 2026-11-08: a new video goes live straight away, not as a Draft (Matt). Adding needs signing
  in; rate limits, the report button and moderators removing keep it safe, and the votes sort
  out which is best. Why: it's a link to someone else's work, not a change to the app's facts.
- 2026-11-08: the vote is "This helped" and "Didn't help" (Matt), like every opinion vote, with
  totals hidden until 5 votes. Why: a misleading or outdated video can be pushed down.
- 2026-11-08: on a guide, the top video sits right under "In short", before the steps (Matt).
  Why: the plan first, then see it done.
- 2026-11-08: entries first; videos about a whole Page or Block ("Every class explained") come
  later (Matt).

## Open questions (for Matt)

- None open right now.

## Later

- **Timestamps in steps**: a Quick step links to a moment in a video ("4:32"), which plays from
  there.
- **Out of date after a patch**: "Still right after patch X?" pushes outdated videos down.
- **Creators claim their channel**: a creator badge, a page of their videos, a way to ask for
  removal.
- **Twitch VODs** and other sites.
