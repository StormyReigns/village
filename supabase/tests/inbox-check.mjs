// Checks the inbox news (20261124000000_inbox_news.sql) on an in-memory Postgres with the same
// Supabase-like stubs as remove-check.mjs: replies and "Seems wrong" counting up on one item,
// @mentions, a Draft published or declined, titles and badges sent once, and that players can't
// write news or read the marks.
// Usage: node supabase/tests/inbox-check.mjs supabase/migrations
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const db = new PGlite();
const files = readdirSync(process.argv[2]).filter((f) => f.endsWith('.sql')).sort();
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { console.log('  FAIL ' + m); process.exitCode = 1; };
const check = (cond, m, got) => (cond ? ok(m) : bad(m + (got === undefined ? '' : ` (got ${JSON.stringify(got)})`)));

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
const MOD = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222', B = '33333333-3333-3333-3333-333333333333';
const OLD = '44444444-4444-4444-4444-444444444444';
for (const f of files) {
  // A villager who reached Builder before the inbox news existed: they mustn't be told again.
  if (f.includes('inbox_news')) {
    await db.exec(`
      insert into auth.users (id) values ('${OLD}');
      insert into public.games (id, title, status, preset) values ('fw', 'Fortune''s Weave', 'live', 'tactics-rpg');
      insert into public.drafts (game_id, block_key, kind, title, content, author_id, status) values ('fw', 'classes', 'fact', 'Long ago', '{"name":"Long ago"}', '${OLD}', 'stable');`);
  }
  try { await db.exec(readFileSync(join(process.argv[2], f), 'utf8')); } catch (e) { console.log(`MIGRATION ERROR in ${f}: ${e.message}`); process.exit(1); }
}
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('inbox_news'))), 'utf8'));
ok('migrations applied, and the inbox news SQL runs twice');

await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values ('${MOD}', '{"full_name":"Matt"}'), ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Ben"}');
  insert into public.moderators (profile_id, game_id) values ('${MOD}', null);
  insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position) values ('fw', 'classes', 'Classes', 'Classes', 'Users', 'indigo', '', 0);
  insert into public.game_blocks (game_id, block_key, title, page_key, type) values ('fw', 'classes', 'Classes', 'classes', 'classes');
`);

const asUser = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const one = async (uid, sql) => (await asUser(uid, sql)).rows[0];
const inbox = async (who, type) => (await db.query(`select * from public.inbox where profile_id = '${who}'${type ? ` and type = '${type}'` : ''} order by id`)).rows;
const draft = (uid, name) =>
  `insert into public.drafts (game_id, block_key, kind, title, content, author_id)
   values ('fw', 'classes', 'fact', '${name}', '{"name":"${name}","sections":[],"categories":{}}', '${uid}') returning id`;
const say = (uid, body, thread) =>
  `insert into public.chat_messages (game_id, author_id, body, thread_key) values ('fw', '${uid}', '${body}', ${thread ? `'${thread}'` : 'null'}) returning id`;

check((await inbox(OLD)).length === 0, 'a step reached before today sends no news when the SQL runs');

// Replies and doubts on a waiting Draft -----------------------------------------------------------
const d1 = (await one(A, draft(A, 'Myrmidon'))).id;
await asUser(B, say(B, 'Is the base speed right?', `draft:${d1}`));
await asUser(B, say(B, 'Found it in the guide', `draft:${d1}`));
let act = await inbox(A, 'draft_activity');
check(act.length === 1 && act[0].payload.replies === 2, 'two replies in a Draft’s thread make one item, counted up', act.map((x) => x.payload));
await asUser(A, say(A, 'Thanks!', `draft:${d1}`));
act = await inbox(A, 'draft_activity');
check(act[0].payload.replies === 2, 'your own reply on your Draft isn’t news to you');

// A mention
const m = (await one(B, say(B, `<@${A}> can you check?`, `draft:${d1}`))).id;
const mentions = await inbox(A, 'mention');
check(mentions.length === 1 && Number(mentions[0].payload.message) === Number(m) && mentions[0].payload.by === B, '@mentioning someone sends them a mention', mentions.map((x) => x.payload));
check((await inbox(A, 'draft_activity'))[0].payload.replies === 2, 'a message that mentions the author doesn’t also count as a reply');
await asUser(B, say(B, `<@${B}> talking to myself`, null));
check((await inbox(B, 'mention')).length === 0, 'mentioning yourself sends nothing');

// A "Seems wrong" vote
await asUser(B, `insert into public.draft_votes (draft_id, voter_id, value) values ('${d1}', '${B}', -1)`);
act = await inbox(A, 'draft_activity');
check(act.length === 1 && act[0].payload.doubts === 1, 'a “Seems wrong” vote counts up on the same item', act.map((x) => x.payload));
await asUser(B, `update public.draft_votes set value = 1 where draft_id = '${d1}' and voter_id = '${B}'`);
await asUser(B, `update public.draft_votes set value = -1 where draft_id = '${d1}' and voter_id = '${B}'`);
check((await inbox(A, 'draft_activity'))[0].payload.doubts === 2, 'changing a vote back to “Seems wrong” counts again');

// Once read, new activity starts a new item
await asUser(A, `update public.inbox set read_at = now() where profile_id = '${A}'`);
await asUser(B, say(B, 'One more thing', `draft:${d1}`));
check((await inbox(A, 'draft_activity')).length === 2, 'after reading it, new activity makes a new item');

// Publishing and declining ------------------------------------------------------------------------
await asUser(MOD, `select public.ship_draft('${d1}')`);
const shipped = await inbox(A, 'draft_published');
check(shipped.length === 1 && shipped[0].payload.draft === d1 && shipped[0].payload.by === MOD && shipped[0].payload.page === 'classes',
  'a published Draft tells its author, with where it is in the app', shipped.map((x) => x.payload));
const titles = await inbox(A, 'title_up');
check(titles.length === 1 && titles[0].payload.step === 'Builder', 'a first harvest makes you a Builder', titles.map((x) => x.payload));
check((await inbox(A, 'badge_up')).length === 0, 'the first badge color rides along with the Builder news');

const d2 = (await one(A, draft(A, 'Thief'))).id;
await db.exec(`update public.drafts set status = 'declined', decided_by = '${MOD}', decline_reason = 'Needs a source' where id = '${d2}'`);
const declined = await inbox(A, 'draft_declined');
check(declined.length === 1 && declined[0].payload.reason === 'Needs a source', 'a declined Draft tells its author why', declined.map((x) => x.payload));

const d3 = (await one(MOD, draft(MOD, 'Lord'))).id;
await asUser(MOD, `select public.ship_draft('${d3}')`);
check((await inbox(MOD, 'draft_published')).length === 0, 'publishing your own Draft isn’t news to you');

// Titles and badges are sent once ----------------------------------------------------------------
await db.exec(`delete from public.inbox where profile_id = '${A}'`);
for (const name of ['Archer', 'Cavalier', 'Knight', 'Mage']) {
  const id = (await db.query(draft(A, name))).rows[0].id;
  await asUser(MOD, `select public.ship_draft('${id}')`);
}
const after = await inbox(A, 'title_up');
check(after.length === 1 && after[0].payload.step === 'Artisan', 'clearing your inbox doesn’t resend Builder; five harvests make an Artisan', after.map((x) => x.payload.step));
const badges = await inbox(A, 'badge_up');
check(badges.length === 0, 'a badge leaf that comes with a new role rides along with it', badges.map((x) => x.payload));

// Tenure: a first activity in a new week checks it. Ben's activity this week goes, and he gets three
// earlier weeks; his next message is a fourth.
await db.exec(`delete from public.chat_messages where author_id = '${B}' and created_at >= date_trunc('week', now());
  delete from public.draft_votes where voter_id = '${B}' and created_at >= date_trunc('week', now());`);
await db.exec(`insert into public.draft_votes (draft_id, voter_id, value, created_at) values
  ('${d3}', '${B}', 1, now() - interval '7 days'), ('${d2}', '${B}', 1, now() - interval '14 days')`);
await db.exec(`insert into public.chat_messages (game_id, author_id, body, created_at) values ('fw', '${B}', 'hi', now() - interval '21 days')`);
const before = (await inbox(B, 'title_up')).length;
await asUser(B, say(B, 'Back again', null));
const tenure = (await inbox(B, 'title_up')).filter((x) => x.payload.part === 'tenure');
check(before === 0 && tenure.length === 1 && tenure[0].payload.step === 'Settled', 'a fourth active week makes you Settled', tenure.map((x) => x.payload));
await asUser(B, say(B, 'And again', null));
check((await inbox(B, 'title_up')).length === 1, 'and it isn’t sent twice');

// Who can do what --------------------------------------------------------------------------------
try { await asUser(A, `insert into public.inbox (profile_id, type) values ('${A}', 'title_up')`); bad('a player wrote to their own inbox'); }
catch { ok('players can’t write news to an inbox'); }
const marks = await asUser(A, `select count(*)::int as n from public.inbox_marks`).catch(() => ({ rows: [{ n: 'refused' }] }));
check(marks.rows[0].n === 0 || marks.rows[0].n === 'refused', 'players can’t read the marks', marks.rows[0].n);
try { await asUser(A, `select public.inbox_title_check('${A}', 'fw', false)`); bad('a player called the title check'); }
catch { ok('players can’t call the functions that send news'); }
