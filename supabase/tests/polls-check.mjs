// Checks chat polls (20261202000000_chat_polls.sql) on an in-memory Postgres with the same
// Supabase-like stubs as pictures-check.mjs: what a poll can hold, voting, changing and taking
// back a vote, ending a poll, and who can end it.
// Usage: node supabase/tests/polls-check.mjs supabase/migrations
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
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('chat_polls'))), 'utf8'));
ok('migrations applied, and the polls SQL runs twice');

const MOD = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222', B = '33333333-3333-3333-3333-333333333333';
await db.exec(`
  insert into auth.users (id) values ('${MOD}'), ('${A}'), ('${B}');
  insert into public.games (id, title, status, preset) values ('fw', 'Fortune''s Weave', 'live', 'tactics-rpg');
  insert into public.moderators (profile_id, game_id) values ('${MOD}', 'fw');
`);
const asUser = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const works = async (uid, sql, label) => { try { const r = await asUser(uid, sql); ok(label); return r; } catch (e) { bad(`${label}: ${e.message}`); } };
const refused = async (uid, sql, label) => { try { await asUser(uid, sql); bad(label + ' (it went through)'); } catch { ok(label + ' (refused)'); } };
const quote = (s) => s.replace(/'/g, "''");
const post = (body, poll) => `insert into public.chat_messages (game_id, author_id, body, poll) values ('fw', '${A}', '${quote(body)}', '${quote(JSON.stringify(poll))}'::jsonb) returning id, poll`;
const soon = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const two = [{ label: 'Head only' }, { label: 'Shoulders' }];
const vote = (uid, mid, choice) => `insert into public.chat_poll_votes (message_id, profile_id, choice) values (${mid}, '${uid}', ${choice})`;

// What a poll can hold
const made = await works(A, post('Which crop?', { options: [{ label: '  Head only  ', image: { path: `fw/${A}/a.webp`, w: 800, h: 600 } }, { label: 'Shoulders' }], ends_at: soon(24) }), 'you can post a poll with a picture choice');
const id = made.rows[0].id, poll = made.rows[0].poll;
poll.options[0].label === 'Head only' && poll.options[0].image.path === `fw/${A}/a.webp` && !poll.options[1].image
  ? ok('labels are trimmed, pictures kept') : bad('poll ' + JSON.stringify(poll));
await refused(A, post('One choice?', { options: [{ label: 'Only' }], ends_at: soon(1) }), 'a poll needs two choices');
await refused(A, post('Five?', { options: [1, 2, 3, 4, 5].map((n) => ({ label: `C${n}` })), ends_at: soon(1) }), 'four choices at most');
await refused(A, post('Blank?', { options: [{ label: '  ' }, { label: 'B' }], ends_at: soon(1) }), 'every choice needs a name');
await refused(A, post('Long?', { options: [{ label: 'x'.repeat(81) }, { label: 'B' }], ends_at: soon(1) }), 'choice names are short');
await refused(A, post(' ', { options: two, ends_at: soon(1) }), 'a poll needs a question');
await refused(A, post('Theirs?', { options: [{ label: 'A', image: { path: `fw/${B}/b.webp` } }, { label: 'B' }], ends_at: soon(1) }), 'a choice’s picture can’t come from someone else’s folder');
await refused(A, post('Climb?', { options: [{ label: 'A', image: { path: `fw/${A}/../x.webp` } }, { label: 'B' }], ends_at: soon(1) }), 'a picture path can’t climb out');
const far = await works(A, post('Forever?', { options: two, ends_at: soon(24 * 365) }), 'a far-off end is accepted');
new Date(far.rows[0].poll.ends_at).getTime() <= Date.now() + 3 * 24 * 3600e3 + 60e3 ? ok('…but brought back to 3 days at most') : bad('ends ' + far.rows[0].poll.ends_at);
const odd = await works(A, post('Odd?', { options: two, ends_at: 'whenever' }), 'a broken end time is accepted');
Math.abs(new Date(odd.rows[0].poll.ends_at).getTime() - (Date.now() + 24 * 3600e3)) < 120e3 ? ok('…and becomes 1 day') : bad('ends ' + odd.rows[0].poll.ends_at);

// Voting
const votes = async () => (await db.query(`select profile_id, choice from public.chat_poll_votes where message_id = ${id} order by profile_id`)).rows;
await works(B, vote(B, id, 0), 'you can vote');
await refused(B, vote(B, id, 1), 'one vote each');
await refused(A, vote(B, id, 1), 'you can’t vote for someone else');
await refused(A, vote(A, id, 2), 'only choices the poll has');
await refused(B, `update public.chat_poll_votes set choice = 1 where message_id = ${id} and profile_id = '${B}'`, 'a change straight after voting waits a second');
await new Promise((r) => setTimeout(r, 1100));
await works(B, `update public.chat_poll_votes set choice = 1 where message_id = ${id} and profile_id = '${B}'`, 'you can change your vote');
await asUser(A, `update public.chat_poll_votes set choice = 0 where message_id = ${id} and profile_id = '${B}'`);
(await votes())[0]?.choice === 1 ? ok('you can’t change someone else’s vote') : bad('A changed B’s vote');
const g = (await db.query(`select game_id from public.chat_poll_votes where message_id = ${id}`)).rows[0];
g?.game_id === 'fw' ? ok('a vote knows its game, for live updates') : bad('game ' + JSON.stringify(g));
await works(B, `delete from public.chat_poll_votes where message_id = ${id} and profile_id = '${B}'`, 'you can take your vote back');
await works(B, vote(B, id, 1), 'and vote again');
const plain = (await asUser(A, `insert into public.chat_messages (game_id, author_id, body) values ('fw', '${A}', 'just words') returning id`)).rows[0].id;
await refused(B, vote(B, plain, 0), 'a message that isn’t a poll takes no votes');

// Ending it
await refused(B, `select public.close_poll(${id})`, 'only the asker or a moderator ends a poll');
await works(A, `select public.close_poll(${id})`, 'the asker can end it early');
const ended = (await db.query(`select poll from public.chat_messages where id = ${id}`)).rows[0].poll;
new Date(ended.ends_at).getTime() <= Date.now() + 1000 && ended.options.length === 2 ? ok('it ends now, choices untouched') : bad('poll ' + JSON.stringify(ended));
await refused(A, vote(A, id, 0), 'no votes after it ends');
await refused(B, `update public.chat_poll_votes set choice = 0 where message_id = ${id} and profile_id = '${B}'`, 'no changing a vote after it ends');
await asUser(B, `delete from public.chat_poll_votes where message_id = ${id} and profile_id = '${B}'`);
(await votes()).length === 1 ? ok('no taking a vote back after it ends') : bad('the vote was taken back');
const other = (await asUser(A, post('Mods?', { options: two, ends_at: soon(1) }))).rows[0].id;
await works(MOD, `select public.close_poll(${other})`, 'a moderator can end any poll in their game');

// A removed message's poll takes no votes
const gone = (await asUser(A, post('Gone?', { options: two, ends_at: soon(1) }))).rows[0].id;
await db.exec(`update public.chat_messages set removed_at = now() where id = ${gone}`);
await refused(B, vote(B, gone, 0), 'a removed poll takes no votes');
