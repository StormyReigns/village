// Checks launching a game (20261203000000_game_launch.sql) on an in-memory Postgres with the same Supabase-like
// stubs as start-game-check.mjs: votes from players other than the starter, five launch it (prelaunch or live by
// its date), Village moderators launch or take down, and nobody else can.
// Usage: node supabase/tests/launch-check.mjs supabase/migrations
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
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('game_launch'))), 'utf8'));
ok('migrations applied, and the launch SQL runs twice');

const ids = Array.from({ length: 8 }, (_, i) => `${String(i + 1).repeat(8)}-1111-1111-1111-111111111111`);
const [STARTER, P1, P2, P3, P4, P5, VMOD, GMOD] = ids;
await db.exec(`
  insert into auth.users (id) values ${ids.map((u) => `('${u}')`).join(', ')};
  insert into public.moderators (profile_id, game_id) values ('${VMOD}', null);
`);
const as = async (uid, sql) => {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const fails = async (uid, sql, label, word) => {
  try { await as(uid, sql); bad(label + ' (it went through)'); }
  catch (e) { !word || e.message.includes(word) ? ok(label + ' (refused)') : bad(`${label}: wrong reason "${e.message}"`); }
};
const start = async (uid, title, release) => (await as(uid, `select public.start_game('${title}', '${title}', 'PC', '${release}'::date, 'RPG', 'fantasy') as id`)).rows[0].id;
const status = async (id) => (await db.query(`select status, launched_at from public.games where id = '${id}'`)).rows[0];
const vote = (uid, id) => as(uid, `insert into public.game_votes (game_id) values ('${id}')`);

// Votes -----------------------------------------------------------------------------------------------------
const later = await start(STARTER, 'Moon Spire', '2030-01-01');
await fails(STARTER, `insert into public.game_votes (game_id) values ('${later}')`, "its starter can't vote for their own game");
await fails(null, `insert into public.game_votes (game_id, voter_id) values ('${later}', '${P1}')`, 'signed out, nobody votes');
await vote(P1, later);
await fails(P1, `insert into public.game_votes (game_id) values ('${later}')`, 'one vote each', 'duplicate');
await fails(P2, `insert into public.game_votes (game_id, voter_id) values ('${later}', '${P3}')`, "nobody votes as someone else");
const stamped = (await db.query(`select created_at > now() - interval '1 minute' as fresh from public.game_votes where voter_id = '${P1}'`)).rows[0].fresh;
stamped ? ok('the database stamps when a vote was cast') : bad('created_at');
await as(P1, `delete from public.game_votes where game_id = '${later}' and voter_id = '${P1}'`);
(await db.query(`select count(*)::int as n from public.game_votes where game_id = '${later}'`)).rows[0].n === 0 ? ok('a vote can be taken back') : bad('take back');
const n = (await as(P2, `select count(*)::int as n from public.game_votes where game_id = '${later}'`)).rows[0].n;
n === 0 ? ok('everyone can read the votes (the count shows)') : bad('read');

// Five launch it --------------------------------------------------------------------------------------------
for (const p of [P1, P2, P3, P4]) await vote(p, later);
(await status(later)).status === 'draft' ? ok('four votes: still waiting') : bad('launched at four');
await vote(P5, later);
const s = await status(later);
s.status === 'prelaunch' && s.launched_at ? ok('the fifth vote launches it, as prelaunch while its date is ahead') : bad('five ' + JSON.stringify(s));
await fails(VMOD, `insert into public.game_votes (game_id) values ('${later}')`, 'no more votes once it has launched');
(await db.query(`select count(*)::int as n from public.game_votes where game_id = '${later}' and voter_id = '${P1}'`)).rows[0].n === 1
  ? ok("a vote can't be taken back once it has launched") : bad('taken back after launch');

// Village moderators ----------------------------------------------------------------------------------------
const out = await start(P2, 'Old Harbor', '2020-05-05');
await fails(P3, `select public.launch_game('${out}')`, 'a player can\'t launch a game', 'Village moderators');
await db.exec(`insert into public.moderators (profile_id, game_id) values ('${GMOD}', '${out}')`);
await fails(GMOD, `select public.launch_game('${out}')`, "its own moderator can't skip the votes", 'Village moderators');
const launched = (await as(VMOD, `select public.launch_game('${out}') as st`)).rows[0].st;
launched === 'live' ? ok('a Village moderator launches it now, live since its date has passed') : bad('launch ' + launched);
await fails(VMOD, `select public.launch_game('${out}')`, 'only a game waiting to launch', "isn't waiting");

const spam = await start(P3, 'Free Gems Now', '2027-01-01');
await fails(P4, `select public.take_down_game('${spam}')`, "a player can't take a game down", 'Village moderators');
await as(VMOD, `select public.take_down_game('${spam}')`);
(await status(spam)).status === 'archived' ? ok('a Village moderator takes it down') : bad('take down');
const hidden = (await as(P4, `select count(*)::int as n from public.games where id = '${spam}'`)).rows[0].n;
hidden === 0 ? ok('a game taken down is hidden from players') : bad('still visible');
await fails(VMOD, `select public.take_down_game('fortunes-weave')`, "a launched game can't be taken down here", 'hasn');
