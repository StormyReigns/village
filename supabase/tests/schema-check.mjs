// Runs the Village migration on an in-memory Postgres with Supabase-like stubs, then
// checks the triggers, the Standouts view and a few row-level security rules.
// Usage: npm test   (or: node supabase/tests/schema-check.mjs <migrations folder> <seed.sql>)
/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const db = new PGlite();
// Every migration, oldest first, as Supabase would apply them.
const files = readdirSync(process.argv[2]).filter((f) => f.endsWith('.sql')).sort();
const migration = files.map((f) => readFileSync(join(process.argv[2], f), 'utf8')).join('\n');
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
  -- Like Supabase: table access is granted by default and row-level security decides.
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
try { await db.exec(migration); } catch (e) {
  const pos = Number(e.position || 0);
  console.log('MIGRATION ERROR: ' + e.message + (pos ? '\n  near: ' + migration.slice(Math.max(0, pos - 160), pos + 80).replace(/\s+/g, ' ') : ''));
  process.exit(1);
}
ok(`migrations applied (${files.join(', ')})`);
if (process.argv[3]) {
  const seed = readFileSync(process.argv[3], 'utf8');
  await db.exec(seed);
  await db.exec(seed); // running it twice must be harmless
  const g = await db.query(`select count(*)::int as n from public.games`);
  const b = await db.query(`select count(*)::int as n from public.game_blocks`);
  g.rows[0].n === 2 && b.rows[0].n === 17 ? ok('seed applied (2 games, 17 blocks) and is safe to re-run') : bad('seed ' + JSON.stringify([g.rows, b.rows]));
  await db.exec(`delete from public.game_blocks; delete from public.games;`);
}

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Matt","avatar_url":"https://cdn.example/a.png"}'), ('${B}', '{}');`);
const av = await db.query(`select avatar_url from public.profiles where id = '${A}'`);
av.rows[0]?.avatar_url === 'https://cdn.example/a.png' ? ok('new profiles get their Discord avatar') : bad('avatar ' + JSON.stringify(av.rows));
const p = await db.query(`select username, display_name from public.profiles order by username`);
p.rows.length === 2 && p.rows.some(r => r.display_name === 'Matt') ? ok('new users get profiles: ' + p.rows.map(r => r.username).join(', ')) : bad('profile trigger');

await db.exec(`
  update public.profiles set is_founder = true where id = '${A}';
  insert into public.moderators (profile_id, game_id) values ('${A}', null);
  insert into public.games (id, title, status, preset) values ('fortunes-weave', 'Fire Emblem: Fortune''s Weave', 'live', 'tactics-rpg');
  insert into public.game_blocks (game_id, block_key, title) values ('fortunes-weave', 'people', 'Units');
  insert into public.cards (id, game_id, block_key, slug) values ('33333333-3333-3333-3333-333333333333', 'fortunes-weave', 'people', 'example-unit');
  insert into public.card_revisions (card_id, content, summary) values ('33333333-3333-3333-3333-333333333333', '{"name":"Example"}', 'first'), ('33333333-3333-3333-3333-333333333333', '{"name":"Example 2"}', 'second');
  insert into public.card_pointers (card_id, channel, revision_id) values ('33333333-3333-3333-3333-333333333333', 'stable', 1);
  update public.card_pointers set revision_id = 2 where channel = 'stable';
  update public.card_pointers set revision_id = 1 where channel = 'stable';
`);
const ev = await db.query(`select from_revision, to_revision from public.pointer_events order by id`);
JSON.stringify(ev.rows) === JSON.stringify([{ from_revision: null, to_revision: 1 }, { from_revision: 1, to_revision: 2 }, { from_revision: 2, to_revision: 1 }])
  ? ok('pointer moves are logged (publish, then rollback)') : bad('pointer audit ' + JSON.stringify(ev.rows));

// Signed-in villager B
const asUser = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const expectFail = async (uid, sql, label) => { try { const r = await asUser(uid, sql); (r.affectedRows ?? 0) === 0 ? ok(label + ' (no rows changed)') : bad(label); } catch (e) { ok(label + ' (refused)'); } };
const expectOk = async (uid, sql, label) => { try { await asUser(uid, sql); ok(label); } catch (e) { bad(label + ': ' + e.message); } };

await expectOk(B, `update public.profiles set username = 'lettuce_lena' where id = '${B}'`, 'villager can rename themselves');
await expectFail(B, `update public.profiles set is_founder = true where id = '${B}'`, 'villager cannot make themselves Founder');
await expectFail(B, `update public.profiles set username = 'hacked' where id = '${A}'`, "villager cannot edit someone else's profile");
await expectOk(B, `insert into public.drafts (id, game_id, block_key, kind, title, content, author_id) values ('44444444-4444-4444-4444-444444444444', 'fortunes-weave', 'people', 'opinion', 'Best early class', '{}', '${B}')`, 'villager can post a Draft');
await expectFail(B, `insert into public.drafts (game_id, block_key, kind, title, content, author_id, status) values ('fortunes-weave', 'people', 'fact', 'Sneaky', '{}', '${B}', 'stable')`, 'villager cannot post a Draft straight to Stable');
await expectFail(B, `insert into public.draft_votes (draft_id, voter_id, value) values ('44444444-4444-4444-4444-444444444444', '${B}', 1)`, 'author cannot vote on their own Draft');
await expectOk(A, `insert into public.draft_votes (draft_id, voter_id, value) values ('44444444-4444-4444-4444-444444444444', '${A}', 1)`, 'another villager can vote');
await expectFail(B, `update public.card_pointers set revision_id = 2`, 'villager cannot publish');
await expectFail(B, `update public.drafts set status = 'stable'`, 'villager cannot approve Drafts');
await expectOk(A, `update public.drafts set status = 'approved' where id = '44444444-4444-4444-4444-444444444444'`, 'moderator can approve');

await db.exec(`insert into public.draft_views (draft_id, viewer_key) select '44444444-4444-4444-4444-444444444444', 'v' || g from generate_series(1, 6) g;`);
const s = await db.query(`select ups, downs, viewers, round(standout, 3) as standout from public.draft_scores`);
console.log('  info Standouts row: ' + JSON.stringify(s.rows[0]));
const w = await db.query(`select round(public.wilson_lower(3, 6), 3) as a, round(public.wilson_lower(10, 50), 3) as b, public.wilson_lower(0, 0) as c`);
const r = w.rows[0];
Number(r.a) === 0.188 && Number(r.b) === 0.112 && Number(r.c) === 0 ? ok(`Standouts maths: 3 of 6 = ${r.a}, 10 of 50 = ${r.b}`) : bad('wilson ' + JSON.stringify(r));

// Chat: villagers post as themselves, and floods are refused.
await expectOk(B, `insert into public.chat_messages (game_id, author_id, body, linked_draft_id) values ('fortunes-weave', '${B}', 'Hello village', '44444444-4444-4444-4444-444444444444')`, 'villager can chat and link a Draft');
await expectFail(B, `insert into public.chat_messages (game_id, author_id, body) values ('fortunes-weave', '${A}', 'Pretending')`, 'villager cannot chat as someone else');
for (let i = 0; i < 9; i++) await asUser(B, `insert into public.chat_messages (game_id, author_id, body) values ('fortunes-weave', '${B}', 'msg ${i}')`);
await expectFail(B, `insert into public.chat_messages (game_id, author_id, body) values ('fortunes-weave', '${B}', 'one too many')`, 'the 11th message in a minute is refused');
await db.exec(`update public.drafts set status = 'removed'`);
const gone = await db.query(`select count(*)::int as n from public.draft_scores`);
gone.rows[0].n === 0 ? ok('removed Drafts leave Standouts') : bad('removed draft still scored');

// Reports and moderation. B is a villager, A is a moderator.
await db.exec(`update public.drafts set status = 'open'; insert into auth.users (id) values ('55555555-5555-5555-5555-555555555555');`);
const C = '55555555-5555-5555-5555-555555555555';
const msg = (await db.query(`select id from public.chat_messages where body = 'Hello village'`)).rows[0].id;
await expectOk(C, `insert into public.flags (message_id, reason, reporter_id) values (${msg}, 'rude', '${C}')`, 'villager can report a message');
await expectFail(C, `insert into public.flags (message_id, reason, reporter_id) values (${msg}, 'spam', '${C}')`, 'one report per person per message');
const fg = await db.query(`select game_id from public.flags`);
fg.rows[0]?.game_id === 'fortunes-weave' ? ok('reports are filed under the right game') : bad('flag game ' + JSON.stringify(fg.rows));
const seenByB = await asUser(B, `select count(*)::int as n from public.flags`);
seenByB.rows[0].n === 0 ? ok("villagers can't see other people's reports") : bad('flags visible to B');
const seenByA = await asUser(A, `select count(*)::int as n from public.flags`);
seenByA.rows[0].n === 1 ? ok('moderators see reports') : bad('flags hidden from A');
await expectFail(B, `update public.flags set status = 'dismissed'`, 'villager cannot dismiss reports');
await expectOk(A, `update public.flags set status = 'resolved', handled_by = '${A}', handled_at = now()`, 'moderator can resolve a report');
await expectFail(B, `update public.chat_messages set removed_at = now() where id = ${msg}`, "villager cannot remove others' messages");
await expectOk(A, `update public.chat_messages set removed_at = now(), removed_by = '${A}' where id = ${msg}`, 'moderator can remove a message');
const hidden = await asUser(C, `select count(*)::int as n from public.chat_messages where id = ${msg}`);
hidden.rows[0].n === 0 ? ok('removed messages disappear for villagers') : bad('removed message still visible');
await expectOk(A, `update public.drafts set status = 'declined', decline_reason = 'Duplicate', decided_by = '${A}', decided_at = now()`, 'moderator can decline a Draft with a reason');
