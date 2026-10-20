// Checks that the site can reach Supabase and that the schema and starter data are in.
// Usage: npm run db:check   (reads .env.local)
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.');
  process.exit(1);
}

const db = createClient(url, key);
const games = await db.from('games').select('id, title, status').order('id');
if (games.error) {
  console.log('Could not read the games table: ' + games.error.message);
  console.log(games.error.code === '42P01' || /does not exist|schema cache/i.test(games.error.message)
    ? 'The schema has not been run yet. Run the migration in the Supabase SQL editor.'
    : 'Check the project address and key in .env.local.');
  process.exit(1);
}
const blocks = await db.from('game_blocks').select('game_id', { count: 'exact', head: true });
console.log('Connected to ' + new URL(url).host);
console.log('Games: ' + (games.data.length ? games.data.map((g) => `${g.title} (${g.status})`).join(', ') : 'none yet. Run supabase/seed.sql.'));
console.log('Blocks: ' + (blocks.count ?? 0));

// A signed-out visitor must not be able to write. This insert should be refused.
const write = await db.from('games').insert({ id: 'should-fail', title: 'x', preset: 'x', status: 'live' });
console.log(write.error ? 'Security rules: signed-out writes are refused, as they should be.' : 'WARNING: a signed-out write was accepted. Check row-level security.');
if (!write.error) await db.from('games').delete().eq('id', 'should-fail');
