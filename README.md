# Village

Community-built companion apps for games. Each game gets an app that players build
together in its **Workshop**: they chat, turn findings into **Drafts**, vote, and
approved changes ship to the app on **Market Day**.

First games: **Fire Emblem: Fortune's Weave** (test launch) and **The Legend of Zelda:
Ocarina of Time** (Switch 2 remake, out November 5, 2026).

Unofficial fan project. Not affiliated with Nintendo, Intelligent Systems, or any
game publisher.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Standouts maths + database schema checks
npm run build
```

The site runs without a database: it shows empty states until Supabase is connected.

## Connect the services

1. **Supabase**: create a project at supabase.com. Copy `.env.example` to
   `.env.local` and fill in the URL and keys from Project Settings > API. Then run
   `supabase/migrations/20261020000000_init.sql` in the SQL editor (or with the
   Supabase CLI).
2. **Discord sign-in**: create an application at discord.com/developers, then add its
   client ID and secret under Supabase > Authentication > Providers > Discord.
3. **Vercel**: import the GitHub repository and add the same environment variables.
4. **Claude API** (later, for drafting and pre-checks): add `ANTHROPIC_API_KEY`.

## How it's organised

| Path | What it is |
|---|---|
| `src/lib/blocks.ts` | Block definitions (People, Missables, Builds...) and genre presets. Fields drive the Draft form, the live preview and the app card. |
| `src/data/games.ts` | The games, their presets and per-game block names. |
| `src/lib/standouts.ts` | The default Draft sort: net votes per viewer, confidence-adjusted. |
| `src/app/page.tsx` | The village square. |
| `src/app/g/[game]/` | A game's app, and its Workshop under `workshop/`. |
| `supabase/migrations/` | Database schema, with row-level security. |
| `supabase/tests/` | Runs the schema on an in-memory Postgres and checks the security rules. |

## Data rules

Facts are written in our own words and checked against a source. No game art, music,
datamined files or leaks. Contributions are shared under CC BY-SA.
