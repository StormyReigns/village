// Checks starting a game (20261201000000_start_game.sql) on an in-memory Postgres with the same Supabase-like stubs
// as setup-check.mjs: anyone signed in starts one, it's unlisted but readable, its starter moderates it (that game
// only), what they typed is checked, near-duplicates are refused, and one a day each.
// Usage: node supabase/tests/start-game-check.mjs supabase/migrations
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const db = new PGlite();
const files = readdirSync(process.argv[2]).filter((f) => f.endsWith('.sql')).sort();
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { console.log('  FAIL ' + m); process.exitCode = 1; };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
for (const f of files) {
  try { await db.exec(readFileSync(join(process.argv[2], f), 'utf8')); } catch (e) { console.log(`MIGRATION ERROR in ${f}: ${e.message}`); process.exit(1); }
}
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('start_game'))), 'utf8'));
ok('migrations applied, and the start-a-game SQL runs twice');

const A = '22222222-2222-2222-2222-222222222222', B = '44444444-4444-4444-4444-444444444444', VMOD = '77777777-7777-7777-7777-777777777777';
await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Mira"}'), ('${B}', '{}'), ('${VMOD}', '{}');
  insert into public.moderators (profile_id, game_id) values ('${VMOD}', null);
`);

const as = async (uid, sql) => {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const q = (s) => (s === null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const start = (uid, { title = 'Hollow Spire', short = 'Spire', platform = 'PC', release = '2027-02-01', genre = 'Metroidvania', shade = 'fantasy' } = {}) =>
  as(uid, `select public.start_game(${q(title)}, ${q(short)}, ${q(platform)}, ${release === null ? 'null' : `'${release}'::date`}, ${q(genre)}, ${q(shade)}) as id`);
const refused = async (uid, opts, label, word) => {
  try { await start(uid, opts); bad(label + ' (it went through)'); }
  catch (e) { !word || e.message.includes(word) ? ok(label + ' (refused)') : bad(`${label}: wrong reason "${e.message}"`); }
};

// Starting one ---------------------------------------------------------------------------------------------
await refused(null, {}, 'signed out, nobody can start a game', 'permission denied');
const id = (await start(A)).rows[0].id;
id === 'spire' ? ok('anyone signed in starts a game; its address comes from its short name') : bad('id ' + id);
const g = (await db.query(`select status, title, short_title, platform, genre, shade, hue, preset, created_by from public.games where id = 'spire'`)).rows[0];
g.status === 'draft' && g.shade === 'fantasy' && g.hue === 'berry' && g.created_by === A && g.preset === 'custom'
  ? ok('it starts as being built, with its look, and who started it') : bad('game ' + JSON.stringify(g));
const mod = (await as(A, `select public.is_moderator('spire') as a, public.is_moderator('fortunes-weave') as b`)).rows[0];
mod.a === true && mod.b === false ? ok('its starter moderates it, and only it') : bad('mod ' + JSON.stringify(mod));
const seen = (await as(B, `select count(*)::int as n from public.games where id = 'spire'`)).rows[0].n;
const seenAnon = (await as(null, `select count(*)::int as n from public.games where id = 'spire'`)).rows[0].n;
seen === 1 && seenAnon === 1 ? ok('a game being built can be read by everyone (unlisted, not secret)') : bad(`seen ${seen} ${seenAnon}`);

// What they typed is checked --------------------------------------------------------------------------------
await refused(B, { title: 'X' }, 'a name of one letter', 'name');
await refused(B, { title: 'Real Game', short: 'x'.repeat(41) }, 'a short name over 40', 'short name');
await refused(B, { title: 'Real Game', short: 'Real', platform: '' }, 'no platform', 'played on');
await refused(B, { title: 'Real Game', short: 'Real', genre: '' }, 'no genre', 'kind of game');
await refused(B, { title: 'Real Game', short: 'Real', release: null }, 'no release date', 'release date');
await refused(B, { title: 'Real Game', short: 'Real', release: '2099-01-01' }, 'a date far in the future', 'release date');
await refused(B, { title: 'Real Game', short: 'Real', shade: 'neon' }, 'a look that is not ours', 'look');

// The same game twice ---------------------------------------------------------------------------------------
await refused(B, { title: 'hollow spire!', short: 'HS' }, 'the same title again, any spelling', 'already in Village');
await refused(B, { title: 'Fortunes Weave', short: 'FW' }, "another game's short name as a title", 'already in Village');

// One a day each --------------------------------------------------------------------------------------------
await refused(A, { title: 'Second Game', short: 'Second' }, 'a second game the same day', 'tomorrow');
const v1 = (await start(VMOD, { title: 'Moon Farm', short: 'Moon Farm', shade: 'cozy' })).rows[0].id;
const v2 = (await start(VMOD, { title: 'Moon Farm 2', short: 'Moon Farm Two', shade: 'cozy' })).rows[0].id;
v1 === 'moon-farm' && v2 === 'moon-farm-two' ? ok('Village moderators can start more than one a day') : bad(`vmod ${v1} ${v2}`);
await refused(B, { title: 'Spire of Ash', short: 'Spire!!' }, "a short name that is another game's, with punctuation", 'already in Village');
const other = (await start(B, { title: 'Spire of Ash', short: 'Ash Spire' })).rows[0].id;
other === 'ash-spire' ? ok('a different game with a similar name is fine') : bad('other ' + other);

// Nobody becomes a moderator any other way ------------------------------------------------------------------
try { await as(B, `insert into public.moderators (profile_id, game_id) values ('${B}', 'fortunes-weave')`); bad('a player made themself a moderator'); }
catch { ok("a player can't make themself a moderator directly (refused)"); }
