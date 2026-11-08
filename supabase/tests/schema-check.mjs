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
  const seeds = process.argv.slice(3).map((f) => readFileSync(f, 'utf8'));
  for (const s of seeds) await db.exec(s);
  for (const s of seeds) await db.exec(s); // running them twice must be harmless
  const n = async (sql) => (await db.query(sql)).rows[0].n;
  const counts = {
    games: await n(`select count(*)::int as n from public.games`),
    pages: await n(`select count(*)::int as n from public.app_pages`),
    blocks: await n(`select count(*)::int as n from public.game_blocks`),
    entries: await n(`select count(*)::int as n from public.cards c join public.card_pointers p on p.card_id = c.id and p.channel = 'stable'`),
    loose: await n(`select count(*)::int as n from public.game_blocks where page_key is null`),
  };
  counts.games === 2 && counts.pages === 11 && counts.blocks === 17 && counts.entries === 186 && counts.loose === 0
    ? ok(`seeds applied (${counts.games} games, ${counts.pages} pages, ${counts.blocks} blocks, ${counts.entries} entries on Stable) and safe to re-run`)
    : bad('seeds ' + JSON.stringify(counts));
  const st = await db.query(`select b.stats->0->>'label' as stat, r.content->'stats'->>'might' as might from public.game_blocks b join public.cards c on c.block_key = b.block_key and c.game_id = b.game_id join public.card_pointers p on p.card_id = c.id and p.channel = 'stable' join public.card_revisions r on r.id = p.revision_id where b.block_key = 'weapons-and-magic' and r.content->>'name' = 'Thoron'`);
  st.rows[0]?.stat === 'Might' && st.rows[0]?.might === '20' ? ok('Weapons and magic keeps its stats, and entries their numbers (Thoron: Might 20)') : bad('stats ' + JSON.stringify(st.rows));
  await db.exec(`delete from public.games;`);
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
  insert into public.card_pointers (card_id, channel, revision_id) values ('33333333-3333-3333-3333-333333333333', 'stable', (select min(id) from public.card_revisions where card_id = '33333333-3333-3333-3333-333333333333'));
  update public.card_pointers set revision_id = (select max(id) from public.card_revisions where card_id = '33333333-3333-3333-3333-333333333333') where channel = 'stable';
  update public.card_pointers set revision_id = (select min(id) from public.card_revisions where card_id = '33333333-3333-3333-3333-333333333333') where channel = 'stable';
`);
const ev = await db.query(`select from_revision - (select min(id) - 1 from public.card_revisions) as from_revision, to_revision - (select min(id) - 1 from public.card_revisions) as to_revision from public.pointer_events order by id`);
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
await expectFail(B, `update public.card_pointers set revision_id = (select max(id) from public.card_revisions where card_id = '33333333-3333-3333-3333-333333333333')`, 'villager cannot publish');
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
// Threads: a message can belong to one thing's thread, named by a key, never free text.
await expectOk(C, `insert into public.chat_messages (game_id, author_id, body, thread_key) values ('fortunes-weave', '${C}', 'About Eshmel', 'card:44444444-4444-4444-4444-444444444444')`, "villager can post in an entry's thread");
await expectFail(C, `insert into public.chat_messages (game_id, author_id, body, thread_key) values ('fortunes-weave', '${C}', 'Odd', 'Eshmel')`, 'a thread key must name what it is');
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

// Publishing: a moderator turns a Draft into an app entry in one step.
const D2 = '66666666-6666-6666-6666-666666666666';
await expectOk(B, `insert into public.drafts (id, game_id, block_key, kind, title, content, author_id) values ('${D2}', 'fortunes-weave', 'people', 'fact', 'New unit', '{"name":"New unit","sections":[],"categories":{}}', '${B}')`, 'villager can post an entry Draft');
await expectFail(B, `select public.ship_draft('${D2}')`, 'villager cannot publish a Draft');
await expectOk(A, `select public.ship_draft('${D2}')`, 'moderator publishes a Draft');
const shipped = await db.query(`select d.status, c.slug, r.content->>'name' as name from public.drafts d join public.cards c on c.id = d.card_id join public.card_pointers p on p.card_id = c.id and p.channel = 'stable' join public.card_revisions r on r.id = p.revision_id where d.id = '${D2}'`);
shipped.rows[0]?.status === 'stable' && shipped.rows[0]?.slug === 'new-unit' && shipped.rows[0]?.name === 'New unit'
  ? ok('published Draft is a new entry on Stable (new-unit)') : bad('ship ' + JSON.stringify(shipped.rows));
await expectFail(A, `select public.ship_draft('${D2}')`, 'a published Draft cannot be published twice');

// System notes: publishing writes one into the entry's thread; nobody can post one by hand.
const note = await db.query(`select m.id, m.kind, m.thread_key, m.event->>'type' as type, d.card_id from public.chat_messages m join public.drafts d on d.id = m.linked_draft_id where m.linked_draft_id = '${D2}' and m.kind = 'system'`);
note.rows.length === 1 && note.rows[0].type === 'published' && note.rows[0].thread_key === `card:${note.rows[0].card_id}`
  ? ok("publishing posts a system note in the entry's thread") : bad('note ' + JSON.stringify(note.rows));
const declined = await db.query(`select count(*)::int as n from public.chat_messages where kind = 'system' and event->>'type' = 'declined'`);
declined.rows[0].n > 0 ? ok('declining posts a system note too') : bad('no declined note');
await expectFail(C, `insert into public.chat_messages (game_id, author_id, body, kind) values ('fortunes-weave', '${C}', 'Totally official', 'system')`, 'villagers cannot post system notes');

// Pictures and replies: a message can be pictures alone, never nothing at all.
await expectOk(C, `insert into public.chat_messages (game_id, author_id, body, attachments, reply_to) values ('fortunes-weave', '${C}', '', '[{"path":"fortunes-weave/${C}/a.webp","w":800,"h":600}]', ${note.rows[0]?.id})`, 'a message can be a picture alone, replying to another');
await expectFail(C, `insert into public.chat_messages (game_id, author_id, body) values ('fortunes-weave', '${C}', '')`, 'an empty message with no picture is refused');
await expectFail(C, `insert into public.chat_messages (game_id, author_id, body, attachments) values ('fortunes-weave', '${C}', 'Too many', '[{},{},{},{},{}]')`, 'at most four pictures on a message');

// Reactions: as yourself, once per emoji, and gone when you take it back.
const noteId = note.rows[0]?.id;
await expectOk(C, `insert into public.chat_reactions (message_id, profile_id, emoji) values (${noteId}, '${C}', '🎉')`, 'villager can react to a message');
await expectFail(C, `insert into public.chat_reactions (message_id, profile_id, emoji) values (${noteId}, '${C}', '🎉')`, 'one of each emoji per person');
await expectFail(C, `insert into public.chat_reactions (message_id, profile_id, emoji) values (${noteId}, '${B}', '👍')`, 'villager cannot react as someone else');
const rg = await db.query(`select game_id from public.chat_reactions where message_id = ${noteId}`);
rg.rows[0]?.game_id === 'fortunes-weave' ? ok('reactions are filed under the right game') : bad('reaction game ' + JSON.stringify(rg.rows));
await expectFail(B, `delete from public.chat_reactions where profile_id = '${C}'`, "villager cannot take back someone else's reaction");
await expectOk(C, `delete from public.chat_reactions where message_id = ${noteId} and profile_id = '${C}'`, 'villager can take back a reaction');

// Questions (docs/blocks/questions.md): ask as yourself, "me too", answer by Draft or by link.
const Q1 = '77777777-7777-7777-7777-777777777771', Q2 = '77777777-7777-7777-7777-777777777772', Q3 = '77777777-7777-7777-7777-777777777773';
const CARD = '33333333-3333-3333-3333-333333333333';
await expectOk(B, `insert into public.questions (id, game_id, page_key, body, asked_by) values ('${Q1}', 'fortunes-weave', 'units-and-classes', 'How does Long join?', '${B}'), ('${Q2}', 'fortunes-weave', 'guides', 'Does Cai have good STR?', '${B}')`, 'villager can ask a question');
await expectFail(B, `insert into public.questions (game_id, body, asked_by) values ('fortunes-weave', 'Pretending', '${A}')`, 'villager cannot ask as someone else');
await expectFail(B, `insert into public.questions (game_id, body, asked_by, status, reply) values ('fortunes-weave', 'Self-answered', '${B}', 'answered', 'Yes')`, 'a new question cannot arrive answered');
await expectOk(C, `insert into public.question_askers (question_id, profile_id) values ('${Q1}', '${C}'), ('${Q2}', '${C}')`, 'another villager can say "me too"');
await expectFail(B, `insert into public.question_askers (question_id, profile_id) values ('${Q1}', '${B}')`, 'the asker cannot "me too" their own question');
await expectFail(C, `insert into public.question_askers (question_id, profile_id) values ('${Q1}', '${B}')`, 'villager cannot "me too" for someone else');
const qg = await db.query(`select game_id from public.question_askers where question_id = '${Q1}'`);
qg.rows[0]?.game_id === 'fortunes-weave' ? ok('"me too"s are filed under the right game') : bad('me too game ' + JSON.stringify(qg.rows));
await expectFail(C, `update public.questions set status = 'removed' where id = '${Q1}'`, 'villager cannot remove a question');
await expectFail(B, `update public.questions set status = 'answered', reply = 'Mine' where id = '${Q1}'`, 'the asker cannot close it by hand');

// Answer 1: a Draft that carries the question ships.
const D3 = '88888888-8888-8888-8888-888888888888';
await expectOk(A, `insert into public.drafts (id, game_id, block_key, kind, title, content, author_id, card_id, question_id, reply) values ('${D3}', 'fortunes-weave', 'people', 'fact', 'Example joins in chapter 4', '{"name":"Example","sections":[],"categories":{}}', '${A}', '${CARD}', '${Q1}', 'Added how Long joins: see Example')`, 'a Draft can name the question it answers, with a reply');
await expectOk(A, `select public.ship_draft('${D3}')`, 'moderator publishes the answering Draft');
const a1 = await db.query(`select status, reply, answer_card_id, answer_draft_id, answered_by from public.questions where id = '${Q1}'`);
a1.rows[0]?.status === 'answered' && a1.rows[0].answer_card_id === CARD && a1.rows[0].answer_draft_id === D3 && a1.rows[0].reply === 'Added how Long joins: see Example'
  ? ok('shipping it closes the question and points it at the entry') : bad('answer by draft ' + JSON.stringify(a1.rows));
const in1 = await db.query(`select profile_id, type, payload->>'reply' as reply, payload->>'slug' as slug, payload ? 'body' as body from public.inbox where payload->>'question' = '${Q1}' order by profile_id`);
in1.rows.length === 2 && in1.rows.every((r) => r.type === 'question_answered' && r.reply === 'Added how Long joins: see Example' && r.slug === 'example-unit' && !r.body)
  ? ok('the reply reaches the asker and everyone who said "me too"') : bad('inbox ' + JSON.stringify(in1.rows));

// Answer 2: "It's already there". Only an entry that's in the app (on Stable, in a Block on a Page) counts.
await expectFail(B, `select public.answer_question('${Q2}', '${CARD}', 'Not in the app yet')`, 'an entry outside the app cannot answer');
await db.exec(`insert into public.app_pages (game_id, page_key, title, short) values ('fortunes-weave', 'units-and-classes', 'Units and classes', 'Units'); update public.game_blocks set page_key = 'units-and-classes' where block_key = 'people';`);
await expectFail(B, `select public.answer_question('${Q2}', '${CARD}', '')`, 'an answer needs a reply');
await expectOk(B, `select public.answer_question('${Q2}', '${CARD}', 'Cai''s STR growth is 45%: see his profile')`, 'villager can link the entry that answers it');
await expectFail(C, `select public.answer_question('${Q2}', '${CARD}', 'Again')`, 'an answered question cannot be answered twice');
const in2 = await db.query(`select profile_id from public.inbox where payload->>'question' = '${Q2}'`);
in2.rows.length === 1 && in2.rows[0].profile_id === C ? ok('linking sends the reply too, but not to whoever answered') : bad('inbox 2 ' + JSON.stringify(in2.rows));

// The inbox is private and written only by the database.
const mine = await asUser(C, `select count(*)::int as n from public.inbox`);
const theirs = await asUser(B, `select count(*)::int as n from public.inbox`);
mine.rows[0].n === 2 && theirs.rows[0].n === 1 ? ok('each villager sees only their own inbox') : bad('inbox privacy ' + JSON.stringify([mine.rows, theirs.rows]));
await expectFail(B, `insert into public.inbox (profile_id, type, payload) values ('${C}', 'question_answered', '{}')`, 'nobody can write to an inbox by hand');
await expectFail(B, `select public.send_question_reply('${Q1}')`, 'villagers cannot resend replies');
await expectOk(C, `update public.inbox set read_at = now() where profile_id = '${C}'`, 'villager can mark their inbox read');
await expectFail(C, `update public.inbox set payload = '{}' where profile_id = '${C}'`, 'villager cannot change what an inbox item says');
await expectFail(B, `update public.inbox set read_at = now() where profile_id = '${C}'`, "villager cannot touch someone else's inbox");

// 'That didn't answer it': the asker or a moderator reopens; nobody else can.
await expectFail(C, `select public.reopen_question('${Q2}')`, 'another villager cannot reopen a question');
await expectOk(B, `select public.reopen_question('${Q2}')`, 'the asker can reopen an answer that missed');
const ro = await db.query(`select status, reply, answer_card_id from public.questions where id = '${Q2}'`);
ro.rows[0]?.status === 'open' && ro.rows[0].reply === null && ro.rows[0].answer_card_id === null ? ok('reopening clears the answer') : bad('reopen ' + JSON.stringify(ro.rows));
// A declined Draft leaves its question open.
const D4 = '99999999-9999-9999-9999-999999999999';
await expectOk(C, `insert into public.drafts (id, game_id, block_key, kind, title, content, author_id, question_id) values ('${D4}', 'fortunes-weave', 'people', 'fact', 'A wrong answer', '{"name":"Wrong","sections":[],"categories":{}}', '${C}', '${Q2}')`, 'another Draft answers the reopened question');
await expectOk(A, `update public.drafts set status = 'declined', decided_by = '${A}', decided_at = now() where id = '${D4}'`, 'moderator declines it');
const dq = await db.query(`select status from public.questions where id = '${Q2}'`);
dq.rows[0]?.status === 'open' ? ok('a declined Draft leaves the question open') : bad('declined closed it ' + JSON.stringify(dq.rows));

// Moderators: merge a duplicate, so its asker hears the answer too. Reports cover questions.
await expectOk(C, `insert into public.questions (id, game_id, body, asked_by) values ('${Q3}', 'fortunes-weave', 'How do I get Long?', '${C}')`, 'a duplicate gets asked');
await expectFail(B, `select public.merge_question('${Q3}', '${Q1}')`, 'villager cannot merge questions');
await expectOk(A, `select public.merge_question('${Q3}', '${Q1}')`, 'moderator merges a duplicate');
const mg = await db.query(`select (select status from public.questions where id = '${Q3}') as st, (select count(*)::int from public.question_askers where question_id = '${Q1}' and profile_id = '${C}') as n`);
mg.rows[0].st === 'removed' && mg.rows[0].n === 1 ? ok('the duplicate is folded in, its asker kept') : bad('merge ' + JSON.stringify(mg.rows));
await expectOk(C, `insert into public.flags (question_id, reason, reporter_id) values ('${Q2}', 'spam', '${C}')`, 'villager can report a question');
const qf = await db.query(`select game_id from public.flags where question_id = '${Q2}'`);
qf.rows[0]?.game_id === 'fortunes-weave' ? ok('question reports reach that game') : bad('question flag ' + JSON.stringify(qf.rows));
await expectFail(C, `insert into public.flags (reason, reporter_id) values ('spam', '${C}')`, 'a report must name what it is about');
