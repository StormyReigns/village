# Discord (the second integration)

**Status:** Slice 1 live (2026-11-09): "New in the app" posts; SQL run by Matt; his test post arrived in his own server · **Chat:** `Village · Discord` · **Mockup:** none yet ·
**Code (planned):** `src/lib/discord.ts` (checking webhook and invite links, building the
message; plain and tested), `src/components/discord/` (the moderator's setup sheet, the
Communities card and sheet), `src/app/api/discord-invite/[code]/route.ts` (asks Discord about
an invite, kept for a day) · **Database (planned):** one new migration, reviewed by the hub
before Matt runs it.

Not a Block: two parts that connect a game's app to the Discord servers its players already
use. Written up here with the Blocks because it's built like one.

## What it's for

Matt (2026-11-08): "Discord announcements; yes. Might also be a way for communities to
advertise themselves on the app?"

Players of a game already gather on Discord. Village works best when the two feed each other:
- **Out to Discord**: when the app gets better, the game's Discord hears about it, with a link
  back. That brings players to the app, and it's thanks to whoever found the fix.
- **In from Discord**: a player in the app who wants to talk about the game (find a co-op
  partner, argue builds, ask live) finds the good servers right on the game's home, and the
  servers get new members.

### The moments (from the intuitive-design steps)

Real-world signal (general knowledge of how Discord communities run, not a fresh study):
announcement channels that post every small change get muted; one tidy post a day or a week
gets read. Moderators of a server are protective of it: they don't want a bot pinging
everyone or posting anything they didn't choose. Server lists elsewhere are full of dead
"Invite invalid" links, adverts for unrelated servers, and some not safe for work.

| | Reading Discord: "oh, that's new" (primary, posts) | Setting up: "hook up our server" | Looking for people: "where do players hang out?" (primary, listings) | Listing: "put our server on there" |
|---|---|---|---|---|
| **Who** | A player in the game's Discord | A Village moderator who also runs (or helps run) the game's Discord | A player in the app | Whoever runs a Discord server for the game |
| **Trigger** | A post appears in the announcements channel | Matt asks them, or they see the option on the Notice Board | Wants to talk about the game, team up, or ask something live | Sees "Communities" on the game's home |
| **State** | Scrolling, half paying attention | Careful: it's their server | Curious, open | Hopeful, a bit promotional |
| **What they know** | The game, maybe not Village | Discord's server settings | The game; not which servers are good | Their server and its invite link |
| **Done looks like** | Taps the link, lands on the new thing in the app | Pasted the link, a test post showed up, chose what gets posted | Joined a lively server that fits them | Their server shows on the game's home with its real name, icon and members |
| **Time** | A glance | Under 2 minutes, once | Under 30 seconds | Under a minute to send, then waits for approval |

What this means for the design:
- **Few, tidy posts.** Village gathers what happened and posts once when things go quiet,
  never a stream. A busy Market Day is one post with a list, not twelve.
- **Every post leads somewhere.** Each line links straight to the entry in the app.
- **Nothing pings anyone, ever.** No @everyone, no @here, no role or member mentions.
- **The server owner stays in control.** Their moderator chooses what gets posted, can send a
  test, and can unplug it any time. Removing the webhook in Discord stops it too.
- **Listings show only what Discord itself says.** Name, icon and member count come from
  Discord, not typed by the lister, so they can't be faked, and a dead invite disappears.
- **A clear "who's good" signal.** Players recommend servers; the best rise (Standouts).

## Part 1: Posts out to Discord

### What a Discord reader sees

One post from "Village" (with the Village logo as its picture), as a card in Village yellow:

> **New in the Fortune's Weave app**
> • [Goliath · How to recruit](…) · found by stormy
> • [Cai · STR growth fixed](…) · found by mira
> • [Iron Lance](…) (new) · found by dex
> *Built by players · village*

- One line per change, the entry's name linked to it in the app, and who found it.
- Spoiler entries say "A spoiler (tap to see)" instead of their name.
- More than 10 changes: the first 10, then "and 4 more", linking to the game's home.

### What gets posted (moderators choose)

| Kind | Post | On by default |
|---|---|---|
| **New in the app** | Drafts that were published, gathered into one post | Yes |
| **New videos** | "New video on Goliath: *title* by *channel*", only once it's been live an hour (the adder's delete window) and not taken down | No |
| **Help wanted** | Saturday: "Market Day is tomorrow: 6 Drafts need votes, 3 questions need answers" with a link to the Workshop | No |

Answered questions are already covered: an answer that updates the app is a published Draft.

### Batching

Changes wait in a queue. Village posts a game's queue once nothing new has joined it for
10 minutes, and never later than an hour after the first change. A moderator publishing 12
Drafts on Market Day makes one post.

### Setting it up (moderators only)

On the Notice Board, moderators see a **Discord** card: "Post updates to your Discord".
1. In Discord: Channel settings → Integrations → Webhooks → New webhook → Copy URL. (The card
   shows these steps.)
2. Paste it into the card. Village checks it's a real Discord webhook address and saves it.
3. "Send a test" posts "Village is connected. Updates from the Fortune's Weave app will show
   up here." within a minute.
4. Tick what gets posted.

After saving, the link shows only as "Connected · …a1B9". It can be replaced or removed,
never read back, even by moderators. If Discord says the webhook was deleted, the card says
"Discord no longer accepts this link" and posting stops until a new one is pasted.

### How it's kept safe

- **The webhook link is a secret**: anyone holding it can post in that channel. It's stored in
  a table nobody can read (row-level security on, no read rule, and access revoked), and only
  the database's own functions touch it.
- **The database sends the posts itself** (Supabase's `pg_net` for the web request and
  `pg_cron` for the once-a-minute check). The link never leaves the database, not even to our
  own server, so we don't need a master key on Vercel. (The other way, posting from Vercel,
  would need Supabase's secret key there: one key that bypasses every rule, a bigger thing to
  leak than a webhook.)
- **Only that game's moderators** set, change, test or remove its webhook; every save checks
  the address is `https://discord.com/api/webhooks/<id>/<token>` (discordapp.com, ptb and
  canary are accepted and saved as discord.com).
- **Only public app content** goes out: entry names, Page names, public usernames, links.
- **No pings**: every post sends `allowed_mentions: { parse: [] }`, and "@everyone" and
  "@here" are broken up in the text anyway. Names are escaped so they can't fake a link.

## Part 2: Communities on the app

### What a player sees

On the game's home, a **Communities** card with the top three listings. A Discord server shows:
- the server's own icon (a rounded square: servers aren't entries, so not a piece), its name,
  "1,204 members · 230 online", and the lister's one-line pitch ("Co-op runs every Friday");
- an "Official" tag when Discord marks the server as verified;
- **Join**, which opens the invite in Discord.

Other communities (a subreddit, a forum) are plain links: a name the lister types, the site's
address shown under it ("reddit.com/r/FortunesWeave"), the pitch, and **Visit**. No icon or
member count, because Reddit now wants an app key for those.

"See all 6" opens a sheet with every server, best first (Standouts), each with "Recommend"
and "Not for me" (signed in; totals hidden until 5 votes). At the bottom: "List your community".

A game with no listings shows a quiet "Got a Discord for Fortune's Weave? List it" instead.

### Listing a community

"List your community" opens a short sheet: paste a Discord invite or a link. For Discord,
Village asks Discord about it
and shows the card as it will look ("Is this the one?"), then a one-line pitch (up to 100
characters) and "Send for approval". It needs signing in. Turned away with a plain reason:
- an invite that expires ("Make an invite that never expires: Invite people → Edit invite
  link → Expire after: Never");
- a server Discord marks as age-restricted;
- a server already listed for this game.

Other links must be a plain web address (https), not a link shortener, and get a typed name.

Moderators see waiting listings on the Notice Board with Approve or Decline (with a reason
that goes to the lister's inbox). Approved, it shows on the game's home.

### Staying fresh

- What Discord says about an invite is kept for a day, then asked again, so member counts stay
  close and renamed servers update themselves.
- If Discord says the invite no longer works, the listing hides itself, moderators see "Invite
  stopped working", and the lister gets an inbox note asking for a new link.
- Listings can be reported with the flag, like everything else; moderators can take one down.

## Data (planned)

New tables, so Matt runs SQL (reviewed by the hub first). Checked in
`supabase/tests/schema-check.mjs`.
- **discord_hooks**: one per game: the webhook link, its last 4 characters, which kinds to
  post, whether it's working, the last error, who set it and when. No read rule for anyone.
- **discord_outbox**: the queue: game, kind, the line to post (built from public content),
  when queued, when sent. No read rule for anyone.
- Functions: `set_discord_hook`, `remove_discord_hook`, `discord_hook_status` (moderators
  only; returns the last 4 and settings, never the link), `discord_send_test`, and
  `discord_flush` (run by pg_cron each minute: posts each game's queue when it's ready, notes
  failures). A trigger on Drafts queues a line when one is published.
- **communities**: game, kind (Discord or link), the Discord invite code and guild id (so a
  server is listed once per game) or the link and its typed name, pitch, who listed it, status (waiting, live, declined, broken, removed), who decided.
  **community_votes**: one per player per listing, +1 or -1, totals shared through a tally
  view. Flags can point at a listing. Rate limit: 5 listings a day.

## Shared parts (ask the hub first)

- **The database**: the new tables and functions, a trigger on Drafts, flags pointing at a
  listing, and turning on `pg_net` and `pg_cron` (Matt runs the SQL).
- **The Workshop**: the Discord card on the Notice Board, and waiting listings there
  (`Workshop.tsx`, `useWorkshop.ts`).
- **The game home**: the Communities card in `AppHome` (`src/components/app/PageView.tsx`).

## Build plan

1. **Posts out, "New in the app" only** (done, live 2026-11-09):
   `supabase/migrations/20261111000000_discord_posts.sql` (hooks, outbox, the Draft trigger, the
   flush; reviewed by the hub, run by Matt) and the Discord card on the Notice Board
   (`src/components/discord/DiscordCard.tsx`) with paste, test, kinds and disconnect. Matt's test
   post arrived. To stop the timer: `select cron.unschedule('village-discord-flush');`
2. New videos and help wanted, as ticks on the card.
3. **Communities**: the invite lookup, the card on the home, listing and approval, votes.
4. Rechecking invites and the "stopped working" path.

## Decisions

- 2026-11-09: posts are sent by the database itself (pg_net and pg_cron), so the webhook link
  never leaves it and no master key goes on Vercel. Why: the webhook is a secret; the fewer
  places that can read it, the safer.
- 2026-11-09: posts are gathered and sent once things go quiet (10 minutes, at most an hour).
  Why: a channel that gets spammed gets muted.
- 2026-11-09: listings show only what Discord says about the server, read on our server and
  kept for a day. Why: it can't be faked, and dead invites disappear.

- 2026-11-09 (Matt): moderators can tick "New in the app" (on by default), "New videos" and
  "Help wanted" (both off by default). No separate Market Day roundup. Why: Market Day is when
  moderators publish, so its changes already arrive as one "New in the app" post.
- 2026-11-09 (Matt): Communities lists Discord servers and plain links (subreddits, forums).
  Discord ones show Discord's own name, icon and counts; links show a typed name and the address.
- 2026-11-09 (Matt): every listing needs a moderator's approval, with no cap per game. Players
  recommend the best, and the top three show on the home.
- 2026-11-09 (Matt): no "home server" pin; votes decide the order. Only Discord's own
  "Verified" mark gets an Official tag. Why: fair to fan servers.

## Open questions (for Matt)

- None open right now.

## Later

- Your question answered, or your Draft published, as a Discord DM (needs a Discord bot).
- Sign in with Discord already works; a "member of this server" mark on profiles.
- Reddit, forums and other community kinds.
