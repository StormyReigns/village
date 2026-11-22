// Checks the Staff room (20261205000000_staff_room.sql) on an in-memory Postgres with the same
// Supabase-like stubs as remove-check.mjs: who's staff, the staff chat (who reads, who writes, the
// slow-down, taking a message back), the site feed and the stats, and that nobody else gets in.
// Usage: node supabase/tests/staff-check.mjs supabase/migrations
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
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('staff_room'))), 'utf8'));
ok('migrations applied, and the Staff room SQL runs twice');

const SITE = '11111111-1111-1111-1111-111111111111', GAMEMOD = '22222222-2222-2222-2222-222222222222';
const FOUNDER = '33333333-3333-3333-3333-333333333333', VILLAGER = '44444444-4444-4444-4444-444444444444';
await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values ('${SITE}', '{"full_name":"Matt"}'), ('${GAMEMOD}', '{"full_name":"Mira"}'), ('${FOUNDER}', '{}'), ('${VILLAGER}', '{"full_name":"Vee"}');
  insert into public.games (id, title, status, preset) values ('fw', 'Fortune''s Weave', 'live', 'tactics-rpg');
  insert into public.moderators (profile_id, game_id) values ('${SITE}', null), ('${GAMEMOD}', 'fw');
  update public.profiles set is_founder = true where id = '${FOUNDER}';
  insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position) values ('fw', 'units', 'Units', 'Units', 'Users', 'berry', '', 0);
  insert into public.game_blocks (game_id, block_key, title, page_key, type) values ('fw', 'units', 'Units', 'units', 'characters');
`);

const asUser = async (uid, sql) => {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const expectFail = async (uid, sql, label, word) => {
  try { await asUser(uid, sql); bad(label + ' (it went through)'); }
  catch (e) { !word || e.message.includes(word) ? ok(label + ' (refused)') : bad(`${label}: wrong reason "${e.message}"`); }
};

// Who's staff.
for (const [uid, want, who] of [[SITE, true, 'a Village-wide moderator'], [GAMEMOD, true, "one game's moderator"], [FOUNDER, true, 'the Founder'], [VILLAGER, false, 'a villager']]) {
  const r = await asUser(uid, 'select public.is_staff() as s');
  r.rows[0].s === want ? ok(`${who} ${want ? 'is' : 'is not'} staff`) : bad(`${who}: is_staff ${r.rows[0].s}`);
}

// The staff chat.
await asUser(GAMEMOD, `insert into public.staff_messages (author_id, body) values ('${GAMEMOD}', 'Hello staff')`);
ok('staff can post in the staff chat');
const first = (await db.query(`select id from public.staff_messages order by id limit 1`)).rows[0].id;
await asUser(SITE, `insert into public.staff_messages (author_id, body, reply_to) values ('${SITE}', 'Hi Mira', ${first})`);
ok('and reply to a message');
const seen = await asUser(FOUNDER, 'select count(*)::int n from public.staff_messages');
seen.rows[0].n === 2 ? ok('staff read the staff chat') : bad(`the Founder sees ${seen.rows[0].n}`);
const hidden = await asUser(VILLAGER, 'select count(*)::int n from public.staff_messages');
hidden.rows[0].n === 0 ? ok('a villager reads nothing of it') : bad(`a villager sees ${hidden.rows[0].n}`);
const anon = await asUser(null, 'select count(*)::int n from public.staff_messages');
anon.rows[0].n === 0 ? ok('a visitor reads nothing of it') : bad(`a visitor sees ${anon.rows[0].n}`);
await expectFail(VILLAGER, `insert into public.staff_messages (author_id, body) values ('${VILLAGER}', 'let me in')`, 'a villager can\'t post');
await expectFail(GAMEMOD, `insert into public.staff_messages (author_id, body) values ('${SITE}', 'as Matt')`, 'no posting as someone else');
await expectFail(GAMEMOD, `insert into public.staff_messages (author_id, body) values ('${GAMEMOD}', '   ')`, 'no empty messages');
await asUser(GAMEMOD, `insert into public.staff_messages (author_id, body, removed_at) values ('${GAMEMOD}', 'sneaky', now())`);
const sneaky = (await db.query(`select removed_at from public.staff_messages where body = 'sneaky'`)).rows[0];
sneaky.removed_at === null ? ok('a new message can\'t arrive already taken back') : bad('removed_at was kept');
await asUser(GAMEMOD, `update public.staff_messages set body = 'edited' where id = ${first}`);
const still = (await db.query(`select body from public.staff_messages where id = ${first}`)).rows[0].body;
still === 'Hello staff' ? ok('no editing through the table: the message is unchanged') : bad('it was edited');

// Taking back.
const matts = (await db.query(`select id from public.staff_messages where body = 'Hi Mira'`)).rows[0].id;
await expectFail(GAMEMOD, `select public.staff_remove_message(${matts})`, "a game's moderator can't take back someone else's", 'Only the person');
await asUser(GAMEMOD, `select public.staff_remove_message(${first})`);
(await db.query(`select removed_by from public.staff_messages where id = ${first}`)).rows[0].removed_by === GAMEMOD ? ok('you can take back your own') : bad('own take-back failed');
const sneakyId = (await db.query(`select id from public.staff_messages where body = 'sneaky'`)).rows[0].id;
await asUser(SITE, `select public.staff_remove_message(${sneakyId})`);
(await db.query(`select removed_by from public.staff_messages where id = ${sneakyId}`)).rows[0].removed_by === SITE ? ok('a Village-wide moderator can take back any') : bad('site take-back failed');
await expectFail(VILLAGER, `select public.staff_remove_message(${matts})`, 'a villager can\'t take anything back', 'Only the person');

// The slow-down.
try {
  for (let i = 0; i < 21; i++) await asUser(FOUNDER, `insert into public.staff_messages (author_id, body) values ('${FOUNDER}', 'msg ${i}')`);
  bad('a 21st message in a minute went through');
} catch (e) { e.message.includes('Slow down') ? ok('20 a minute at most') : bad(`slow-down: ${e.message}`); }

// The feed.
await db.exec(`
  insert into public.drafts (game_id, block_key, kind, title, content, author_id, status, decided_by, decided_at)
  values ('fw', 'units', 'fact', 'New unit Vee', '{"name":"Vee"}', '${VILLAGER}', 'stable', '${GAMEMOD}', now() - interval '2 minutes'),
         ('fw', 'units', 'fact', 'Spam spam', '{"name":"Spam"}', '${VILLAGER}', 'declined', '${GAMEMOD}', now() - interval '1 minute');
  insert into public.chat_messages (game_id, author_id, body) values ('fw', '${VILLAGER}', 'rude words');
  update public.chat_messages set removed_at = now(), removed_by = '${SITE}' where body = 'rude words';
`);
const feed = await asUser(GAMEMOD, `select kind, who_name, title from public.staff_feed(null, 50)`);
const kinds = feed.rows.map((r) => r.kind);
for (const k of ['published', 'declined', 'chat_hidden', 'first_draft']) kinds.includes(k) ? ok(`the feed shows ${k}`) : bad(`no ${k} in the feed: ${kinds.join(', ')}`);
feed.rows.find((r) => r.kind === 'published')?.who_name === 'Mira' ? ok('with who did it') : bad('no name on the published line');
const older = await asUser(GAMEMOD, `select count(*)::int n from public.staff_feed(now() - interval '90 seconds', 50)`);
older.rows[0].n >= 1 && older.rows[0].n < feed.rows.length ? ok('"before" pages back through it') : bad(`paging: ${older.rows[0].n} of ${feed.rows.length}`);
await expectFail(VILLAGER, 'select * from public.staff_feed()', 'a villager can\'t read the feed', 'for moderators');
await expectFail(null, 'select * from public.staff_feed()', 'a visitor can\'t call the feed', '');

// The stats.
const stats = (await asUser(GAMEMOD, 'select public.staff_stats() as s')).rows[0].s;
stats.games?.find((g) => g.id === 'fw')?.mine === true && stats.games.find((g) => g.id === 'fortunes-weave')?.mine === false && typeof stats.villagers === 'number' ? ok('stats: numbers, and each game with whether it\'s yours') : bad(`stats: ${JSON.stringify(stats)}`);
await expectFail(VILLAGER, 'select public.staff_stats()', 'a villager can\'t read the stats', 'for moderators');
