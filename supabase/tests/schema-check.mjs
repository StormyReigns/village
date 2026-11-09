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
  counts.games === 2 && counts.pages === 11 && counts.blocks === 16 && counts.entries === 180 && counts.loose === 0
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

// Videos (docs/blocks/videos.md): anyone signed in adds one to an entry; nobody votes on their own;
// totals come from video_tallies; whoever added it or a moderator takes it down, closing its reports.
const V1 = 'aaaaaaaa-0000-0000-0000-000000000001';
await expectOk(B, `insert into public.videos (id, card_id, youtube_id, start_seconds, added_by) values ('${V1}', '${CARD}', 'dQw4w9WgXcQ', 272, '${B}')`, 'villager adds a video to an entry');
const vg = await db.query(`select game_id, status from public.videos where id = '${V1}'`);
vg.rows[0]?.game_id === 'fortunes-weave' && vg.rows[0].status === 'live' ? ok('a video takes its game from the entry and starts live') : bad('video game ' + JSON.stringify(vg.rows));
await expectFail(B, `insert into public.videos (card_id, youtube_id, added_by) values ('${CARD}', 'dQw4w9WgXcQ', '${B}')`, 'the same video cannot go on an entry twice');
await expectFail(B, `insert into public.videos (card_id, youtube_id, added_by) values ('${CARD}', 'not-a-video-id-at-all', '${B}')`, 'only a YouTube video id is kept');
await expectFail(C, `insert into public.videos (card_id, youtube_id, added_by) values ('${CARD}', 'abcdefghijk', '${B}')`, 'nobody adds a video in someone else\'s name');
await expectFail(B, `insert into public.videos (game_id, page_key, youtube_id, added_by) values ('fortunes-weave', 'no-such-page', 'abcdefghijk', '${B}')`, 'a Page video needs a Page in the app');
await expectFail(B, `insert into public.video_votes (video_id, voter_id, value) values ('${V1}', '${B}', 1)`, 'nobody votes on a video they added');
await expectOk(C, `insert into public.video_votes (video_id, voter_id, value) values ('${V1}', '${C}', 1)`, 'another villager says it helped');
await expectOk(A, `insert into public.video_votes (video_id, voter_id, value) values ('${V1}', '${A}', -1)`, 'a moderator says it didn\'t help');
const vt = await asUser(C, `select helped, not_helped from public.video_tallies(array['${V1}']::uuid[])`);
vt.rows[0]?.helped === 1 && vt.rows[0].not_helped === 1 ? ok('totals are shared') : bad('tallies ' + JSON.stringify(vt.rows));
const vv = await asUser(C, `select count(*)::int as n from public.video_votes`);
vv.rows[0].n === 1 ? ok('who voted how stays private') : bad('vote privacy ' + JSON.stringify(vv.rows));
await expectOk(C, `insert into public.flags (video_id, reason, reporter_id) values ('${V1}', 'wrong', '${C}')`, 'villager can report a video');
const vf = await db.query(`select game_id from public.flags where video_id = '${V1}'`);
vf.rows[0]?.game_id === 'fortunes-weave' ? ok('video reports reach that game') : bad('video flag ' + JSON.stringify(vf.rows));
await expectFail(C, `select public.remove_video('${V1}')`, 'another villager cannot take a video down');
await expectFail(C, `update public.videos set status = 'removed' where id = '${V1}'`, 'nobody edits a video row directly');
await expectOk(A, `select public.remove_video('${V1}')`, 'a moderator takes a video down');
const vr = await db.query(`select (select status from public.videos where id = '${V1}') as st, (select status from public.flags where video_id = '${V1}') as fl`);
vr.rows[0].st === 'removed' && vr.rows[0].fl === 'resolved' ? ok('taking it down closes its reports') : bad('remove video ' + JSON.stringify(vr.rows));
const vh = await asUser(C, `select count(*)::int as n from public.videos where id = '${V1}'`);
vh.rows[0].n === 0 ? ok('a removed video is hidden from players') : bad('removed video seen ' + JSON.stringify(vh.rows));
// Whoever added a video deletes it only in its first hour; after that they ask for removal (a report).
const V2 = 'aaaaaaaa-0000-0000-0000-000000000002', V3 = 'aaaaaaaa-0000-0000-0000-000000000003';
await expectOk(B, `insert into public.videos (id, card_id, youtube_id, added_by) values ('${V2}', '${CARD}', 'abcdefghij2', '${B}')`, 'villager adds another video');
await expectOk(B, `select public.remove_video('${V2}')`, 'whoever added it can delete it in the first hour');
await expectOk(B, `insert into public.videos (id, card_id, youtube_id, added_by) values ('${V3}', '${CARD}', 'abcdefghij3', '${B}')`, 'villager adds a third video');
await db.exec(`update public.videos set created_at = now() - interval '2 hours' where id = '${V3}'`);
await expectFail(B, `select public.remove_video('${V3}')`, 'after an hour, whoever added it cannot delete it');
await expectOk(B, `insert into public.flags (video_id, reason, note, reporter_id) values ('${V3}', 'other', 'Removal requested by whoever added it', '${B}')`, 'after an hour, they can ask for removal');
await expectOk(A, `select public.remove_video('${V3}')`, 'a moderator can take any video down, any time');

// World (docs/blocks/world.md): a Block's map picture is set by the game's moderators only.
const MAP = `'{"picture":"fortunes-weave/x/y.webp","w":4096,"h":3000,"credit":"Map: test"}'::jsonb`;
await expectOk(A, `update public.game_blocks set map = ${MAP} where game_id = 'fortunes-weave' and block_key = 'people'`, 'a moderator sets a map picture');
await expectFail(C, `update public.game_blocks set map = null where game_id = 'fortunes-weave' and block_key = 'people'`, 'a villager cannot change the map picture');
const mp = await db.query(`select map->>'credit' as credit from public.game_blocks where game_id = 'fortunes-weave' and block_key = 'people'`);
mp.rows[0]?.credit === 'Map: test' ? ok('the map picture and its credit are kept') : bad('map ' + JSON.stringify(mp.rows));
await db.exec(`update public.game_blocks set map = null where game_id = 'fortunes-weave' and block_key = 'people'`);
// Place groups (20261110120000_place_groups.sql): a place without a Group gets one on a new Stable
// revision, an open Draft on it gets it too, and running it again changes nothing.
const PLACE = `(select id from public.cards where game_id = 'fortunes-weave' and block_key = 'dungeons-and-places' and slug = 'nemea-cavern')`;
const placeRow = async () => (await db.query(`select (select count(*)::int from public.card_revisions where card_id = ${PLACE}) as revs,
  (select v.content->'categories'->>'Group' from public.card_pointers p join public.card_revisions v on v.id = p.revision_id where p.card_id = ${PLACE} and p.channel = 'stable') as grp,
  (select content->'categories'->>'Group' from public.drafts where id = '55555555-5555-5555-5555-555555555555') as draft_grp`)).rows[0];
{
  // The place as it was before groups: no Group yet (made here when the test seed has none).
  await db.exec(`
    insert into public.game_blocks (game_id, block_key, title) values ('fortunes-weave', 'dungeons-and-places', 'Dungeons and places') on conflict do nothing;
    insert into public.cards (game_id, block_key, slug) select 'fortunes-weave', 'dungeons-and-places', 'nemea-cavern' where not exists (select 1 from public.cards where game_id = 'fortunes-weave' and block_key = 'dungeons-and-places' and slug = 'nemea-cavern');
    insert into public.card_revisions (card_id, content) values (${PLACE}, '{"name":"Nemea Cavern","sections":[],"categories":{"Region":"Pasithea"}}');
    insert into public.card_pointers (card_id, channel, revision_id) values (${PLACE}, 'stable', (select max(id) from public.card_revisions where card_id = ${PLACE}))
      on conflict (card_id, channel) do update set revision_id = excluded.revision_id;
    insert into public.drafts (id, game_id, block_key, kind, title, content, author_id, card_id, status) values ('55555555-5555-5555-5555-555555555555', 'fortunes-weave', 'dungeons-and-places', 'fact', 'Nemea Cavern',
      (select v.content from public.card_pointers p join public.card_revisions v on v.id = p.revision_id where p.card_id = ${PLACE} and p.channel = 'stable') || '{"spot":{"x":40,"y":50}}', '${B}', ${PLACE}, 'open');`);
  const before = await placeRow();
  const groupsSql = readFileSync(join(process.argv[2], '20261110120000_place_groups.sql'), 'utf8');
  await db.exec(groupsSql);
  const once = await placeRow();
  await db.exec(groupsSql);
  const twice = await placeRow();
  once.revs === before.revs + 1 && once.grp === 'Cave' && once.draft_grp === 'Cave' ? ok('a place without a Group gets one, and so does an open Draft on it') : bad('place groups ' + JSON.stringify({ before, once }));
  twice.revs === once.revs && twice.grp === 'Cave' ? ok('running the place groups again changes nothing') : bad('place groups twice ' + JSON.stringify({ once, twice }));
}

// Tier lists (docs/blocks/tier-lists.md): your main list is saved whole through save_tier_list and
// counts only once submitted (a copy, updated by submitting again); unique lists of your own never
// count; only the ranked Block's pieces and the Block's tiers; totals from tier_tallies; lists
// private unless shared; reasons (from submitted copies) shown without names and reportable.
const CARD2 = 'bbbbbbbb-0000-0000-0000-000000000002';
await db.exec(`
  insert into public.cards (id, game_id, block_key, slug) values ('${CARD2}', 'fortunes-weave', 'people', 'second-unit');
  insert into public.game_blocks (game_id, block_key, title, type, page_key, tier_setup) values ('fortunes-weave', 'unit-tiers', 'Unit tiers', 'tierlist', 'units-and-classes',
    '{"ranks":"people","tiers":[{"key":"s","label":"S"},{"key":"a","label":"A"},{"key":"b","label":"B"}]}');
`);
const pieces = (arr) => `'${JSON.stringify(arr)}'::jsonb`;
const save = (arr, list) => `select public.save_tier_list('fortunes-weave', 'unit-tiers', ${pieces(arr)}${list ? `, '${list}'` : ''})`;
const tallies = async () => (await asUser(C, `select card_id, tier_key, lists from public.tier_tallies('fortunes-weave', 'unit-tiers') order by card_id, tier_key`)).rows;
try {
  await db.exec('set role anon');
  await db.query(save([{ card: CARD, tier: 's' }]));
  bad('a guest cannot save a list to the village');
} catch { ok('a guest cannot save a list to the village (refused)'); } finally { await db.exec('reset role'); }
await expectOk(B, save([{ card: CARD, tier: 's', reason: 'Carries the early maps' }, { card: CARD2, tier: 'a' }]), 'villager saves a tier list');
await expectOk(C, save([{ card: CARD, tier: 'a' }]), 'another villager saves theirs');
await expectOk(B, save([{ card: CARD, tier: 's', reason: 'Carries the early maps' }, { card: CARD2, tier: 'b' }]), 'saving again replaces the list');
await expectFail(B, save([{ card: CARD, tier: 'z' }]), 'only the Block\'s own tiers');
await expectFail(B, save([{ card: CARD, tier: 's' }, { card: CARD, tier: 'a' }]), 'a piece cannot be placed twice');
await expectFail(B, `select public.save_tier_list('fortunes-weave', 'people', ${pieces([{ card: CARD, tier: 's' }])})`, 'only a Tier list Block takes lists');
await expectFail(B, `insert into public.tier_lists (game_id, block_key, profile_id) values ('fortunes-weave', 'unit-tiers', '${C}')`, 'nobody writes a list row directly');
await expectFail(B, `select public.tier_write((select id from public.tier_lists where profile_id = '${C}' limit 1), ${pieces([])})`, 'the inner write step cannot be called directly');
const tl = await db.query(`select count(*)::int as n from public.tier_lists where kind = 'main'`);
tl.rows[0].n === 2 ? ok('one main list per player per Tier list Block') : bad('tier lists ' + JSON.stringify(tl.rows));
(await tallies()).length === 0 ? ok('a saved list does not count until it is submitted') : bad('counted before submitting');

// Submitting: a copy counts; later edits count once submitted again; withdrawing stops it counting.
await expectOk(B, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'villager submits their list');
await expectOk(C, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'another villager submits theirs');
JSON.stringify(await tallies()) === JSON.stringify([{ card_id: CARD, tier_key: 'a', lists: 1 }, { card_id: CARD, tier_key: 's', lists: 1 }, { card_id: CARD2, tier_key: 'b', lists: 1 }])
  ? ok('submitted lists make the totals') : bad('tier tallies ' + JSON.stringify(await tallies()));
const cnt = await asUser(C, `select public.tier_list_count('fortunes-weave', 'unit-tiers') as n`);
cnt.rows[0].n === 2 ? ok('"From 2 lists" counts submitted lists') : bad('list count ' + JSON.stringify(cnt.rows));
await expectOk(C, save([{ card: CARD, tier: 'b' }]), 'villager edits their list after submitting');
JSON.stringify((await tallies()).filter((r) => r.card_id === CARD).map((r) => r.tier_key)) === JSON.stringify(['a', 's'])
  ? ok('an edit counts only once submitted again') : bad('edit counted early ' + JSON.stringify(await tallies()));
await expectOk(C, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'villager submits again');
JSON.stringify((await tallies()).filter((r) => r.card_id === CARD).map((r) => r.tier_key)) === JSON.stringify(['b', 's'])
  ? ok('submitting again updates the community copy') : bad('resubmit ' + JSON.stringify(await tallies()));
await expectOk(C, `select public.withdraw_tier_list('fortunes-weave', 'unit-tiers')`, 'villager withdraws their list');
JSON.stringify((await tallies()).filter((r) => r.card_id === CARD).map((r) => r.tier_key)) === JSON.stringify(['s'])
  ? ok('a withdrawn list stops counting') : bad('withdraw ' + JSON.stringify(await tallies()));
const keptMain = await db.query(`select count(*)::int as n from public.tier_lists where profile_id = '${C}' and kind = 'main'`);
keptMain.rows[0].n === 1 ? ok('withdrawing keeps your own list') : bad('main gone ' + JSON.stringify(keptMain.rows));
await expectFail(A, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'an empty list cannot be submitted');

// Unique lists: your own title, built from scratch, never counted, shareable.
const U = (await asUser(B, `select public.create_unique_tier_list('fortunes-weave', 'unit-tiers', '  Hottest   units ') as id`)).rows[0]?.id;
const uq = await db.query(`select kind, title from public.tier_lists where id = '${U}'`);
uq.rows[0]?.kind === 'unique' && uq.rows[0].title === 'Hottest units' ? ok('villager starts a unique list with its own title') : bad('unique ' + JSON.stringify(uq.rows));
await expectOk(B, save([{ card: CARD2, tier: 's' }], U), 'villager fills their unique list');
await expectFail(C, save([{ card: CARD2, tier: 'b' }], U), "nobody saves into someone else's unique list");
JSON.stringify((await tallies()).filter((r) => r.card_id === CARD2).map((r) => r.tier_key)) === JSON.stringify(['b'])
  ? ok('a unique list never counts') : bad('unique counted ' + JSON.stringify(await tallies()));
await expectOk(B, `select public.rename_unique_tier_list('${U}', 'Most interesting')`, 'villager renames their unique list');
await expectFail(B, `select public.create_unique_tier_list('fortunes-weave', 'unit-tiers', '   ')`, 'a unique list needs a title');

// Privacy and sharing, by list.
const seen = await asUser(C, `select count(*)::int as n from public.tier_placements tp join public.tier_lists l on l.id = tp.list_id where l.profile_id = '${B}'`);
seen.rows[0].n === 0 ? ok('a list is private until it is shared') : bad('tier privacy ' + JSON.stringify(seen.rows));
await expectOk(B, `select public.share_tier_list('${U}', true)`, 'villager shares their unique list');
const shared = await asUser(C, `select count(*)::int as n from public.tier_placements where list_id = '${U}'`);
shared.rows[0].n === 1 ? ok('a shared list can be read by its link') : bad('shared list ' + JSON.stringify(shared.rows));
const subId = (await db.query(`select id from public.tier_lists where profile_id = '${B}' and kind = 'submitted'`)).rows[0]?.id;
await expectFail(B, `select public.share_tier_list('${subId}', true)`, 'the community copy is not a link of its own');
const et = await asUser(C, `select block_key, tier_key, lists from public.entry_tiers('${CARD}') order by tier_key`);
et.rows.length === 1 && et.rows[0].block_key === 'unit-tiers' && et.rows[0].tier_key === 's' ? ok('an entry finds the tier lists that rank it (submitted only)') : bad('entry tiers ' + JSON.stringify(et.rows));

// Reasons come from submitted copies, without names; moderators remove them for good.
const why = await asUser(C, `select id, reason, mine from public.tier_reasons('fortunes-weave', 'unit-tiers', '${CARD}')`);
why.rows.length === 1 && why.rows[0].reason === 'Carries the early maps' && why.rows[0].mine === false ? ok('reasons show without names') : bad('tier reasons ' + JSON.stringify(why.rows));
const reasonId = why.rows[0]?.id;
await expectOk(C, `insert into public.flags (tier_placement_id, reason, reporter_id) values ('${reasonId}', 'rude', '${C}')`, 'villager can report a reason');
const tf = await db.query(`select game_id from public.flags where tier_placement_id = '${reasonId}'`);
tf.rows[0]?.game_id === 'fortunes-weave' ? ok('reason reports reach that game') : bad('reason flag ' + JSON.stringify(tf.rows));
await expectFail(C, `select public.remove_tier_reason('${reasonId}')`, 'a villager cannot take a reason down');
await expectOk(A, `select public.remove_tier_reason('${reasonId}')`, 'a moderator takes a reason down');
const rr = await db.query(`select (select reason from public.tier_placements where id = '${reasonId}') as reason, (select tier_key from public.tier_placements where id = '${reasonId}') as tier, (select status from public.flags where tier_placement_id = '${reasonId}') as fl`);
rr.rows[0].reason === null && rr.rows[0].tier === 's' && rr.rows[0].fl === 'resolved' ? ok('the reason goes, the placement stays, its reports close') : bad('remove reason ' + JSON.stringify(rr.rows));
await expectOk(B, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'villager submits again with the removed words still in their list');
const back = await db.query(`select reason from public.tier_placements where id = '${reasonId}'`);
back.rows[0]?.reason === null ? ok('a removed reason does not come back with the next submit') : bad('reason came back ' + JSON.stringify(back.rows));
await expectOk(B, save([{ card: CARD, tier: 's', reason: 'Best mover early on' }, { card: CARD2, tier: 'b' }]), 'villager writes a new reason');
await expectOk(B, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'and submits it');
const fresh = await db.query(`select reason from public.tier_placements where id = '${reasonId}'`);
fresh.rows[0]?.reason === 'Best mover early on' ? ok('new words after a removal are kept') : bad('new reason ' + JSON.stringify(fresh.rows));
for (const [label, arg] of [['a card that is not an id', pieces([{ card: 'not-a-uuid', tier: 's' }])], ['a list that is not a list', `'{"card":"x"}'::jsonb`]]) {
  try { await asUser(B, `select public.save_tier_list('fortunes-weave', 'unit-tiers', ${arg})`); bad(label + ' is refused'); }
  catch (e) { /isn't (in this tier list|a list)/.test(e.message) ? ok(label + ' is refused in plain words') : bad(label + ': ' + e.message); }
}
// A removed reason is remembered per player and piece, so it can't come back any other way (the hub).
const reasonOn = async (kind, list) => (await db.query(`select tp.reason from public.tier_placements tp join public.tier_lists l on l.id = tp.list_id where l.profile_id = '${B}' and tp.card_id = '${CARD}' and ${list ? `l.id = '${list}'` : `l.kind = '${kind}'`}`)).rows[0]?.reason ?? null;
const reasonNow = (await asUser(C, `select id from public.tier_reasons('fortunes-weave', 'unit-tiers', '${CARD}')`)).rows[0]?.id;
await expectOk(A, `select public.remove_tier_reason('${reasonNow}')`, 'a moderator takes down the new reason too');
await expectOk(B, save([{ card: CARD, tier: 's', reason: 'Best mover early on' }, { card: CARD2, tier: 'b' }]), 'the device sends those words again');
await expectOk(B, `select public.withdraw_tier_list('fortunes-weave', 'unit-tiers')`, 'villager withdraws');
await expectOk(B, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'and resubmits');
(await reasonOn('submitted')) === null ? ok('withdrawing and resubmitting does not bring a removed reason back') : bad('came back after resubmit: ' + await reasonOn('submitted'));
await expectOk(B, save([{ card: CARD2, tier: 'b' }]), 'villager takes the piece off their list');
await expectOk(B, save([{ card: CARD, tier: 's', reason: 'Best mover early on' }, { card: CARD2, tier: 'b' }]), 'puts it back with the same words');
await expectOk(B, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'and submits');
(await reasonOn('submitted')) === null && (await reasonOn('main')) === null ? ok('taking a piece off and putting it back does not bring it back') : bad('came back after re-adding');
await expectOk(B, save([{ card: CARD, tier: 'a', reason: 'Best mover early on' }], U), 'villager puts the same words on their shared unique list');
(await reasonOn(null, U)) === null ? ok('a unique list does not bring a removed reason back') : bad('came back on a unique list');
await expectOk(B, save([{ card: CARD, tier: 'a', reason: 'Fast, and hits hard' }], U), 'different words still save');
(await reasonOn(null, U)) === 'Fast, and hits hard' ? ok('new words for the same piece are kept') : bad('new words lost');
const peek = await asUser(B, `select count(*)::int as n from public.tier_removed_reasons`).catch(() => null);
!peek ? ok('nobody reads the removed reasons directly (refused)') : bad('removed reasons readable');
await expectOk(B, `select public.share_tier_list('fortunes-weave', 'unit-tiers', true)`, 'the old way of sharing still shares the main list');
await expectOk(B, save([{ card: CARD, tier: 's', reason: 'Nobody else comes close' }, { card: CARD2, tier: 'b' }]), 'villager writes fresh words on their shared main list');
await expectOk(B, `select public.submit_tier_list('fortunes-weave', 'unit-tiers')`, 'and submits them');
const fresh2 = (await asUser(C, `select id from public.tier_reasons('fortunes-weave', 'unit-tiers', '${CARD}') where reason = 'Nobody else comes close'`)).rows[0]?.id;
await expectOk(A, `select public.remove_tier_reason('${fresh2}')`, 'a moderator takes them down');
const mainNow = await asUser(C, `select tp.reason from public.tier_placements tp join public.tier_lists l on l.id = tp.list_id where l.profile_id = '${B}' and l.kind = 'main' and tp.card_id = '${CARD}'`);
mainNow.rows.length === 1 && mainNow.rows[0].reason === null ? ok('a shared main list loses removed words straight away') : bad('shared main still shows ' + JSON.stringify(mainNow.rows));

// Discord posts (docs/blocks/discord.md): only moderators connect a channel; nobody, moderators
// included, can read the webhook link back; a published Draft queues one escaped line; posts wait
// until things go quiet and can't ping anyone; a deleted webhook is noticed; and nothing in here
// can stop a Draft from publishing. pg_net is stubbed: requests are recorded, not sent.
{
await db.exec(`
  create schema if not exists net;
  create table net.sent (id bigint generated always as identity primary key, url text, body jsonb);
  create table net._http_response (id bigint primary key, status_code int, error_msg text, timed_out boolean);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ insert into net.sent (url, body) values (url, body) returning id $$;
  update public.profiles set display_name = '@everyone [x](http://evil)' where id = '${C}';
`);
const HOOK_TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-wxyz';
const HOOK = `https://discordapp.com/api/v10/webhooks/123456789012345678/${HOOK_TOKEN}`;
await expectFail(C, `select public.set_discord_hook('fortunes-weave', '${HOOK}')`, 'a villager cannot connect Discord');
await expectFail(A, `select public.set_discord_hook('fortunes-weave', 'https://discord.com.evil.com/api/webhooks/123456789012345678/${HOOK_TOKEN}')`, 'only a real Discord webhook address is saved');
const last4 = await asUser(A, `select public.set_discord_hook('fortunes-weave', '${HOOK}') as l`);
const savedHook = await db.query(`select url from public.discord_hooks where game_id = 'fortunes-weave'`);
last4.rows[0]?.l === 'wxyz' && savedHook.rows[0]?.url === `https://discord.com/api/webhooks/123456789012345678/${HOOK_TOKEN}`
  ? ok('a moderator connects Discord, gets back only the last 4, and it is saved as discord.com') : bad('hook ' + JSON.stringify([last4.rows, savedHook.rows]));
const peekHook = await asUser(A, `select url from public.discord_hooks`).catch(() => null);
const peekOut = await asUser(C, `select line from public.discord_outbox`).catch(() => null);
!peekHook && !peekOut ? ok('nobody reads the webhook link or the queue, moderators included (refused)') : bad('Discord tables readable');
const hs = await asUser(A, `select last4, kinds, status from public.discord_hook_status('fortunes-weave')`);
const hsC = await asUser(C, `select last4 from public.discord_hook_status('fortunes-weave')`);
hs.rows[0]?.last4 === 'wxyz' && hsC.rows.length === 0 ? ok('moderators see the status, villagers nothing') : bad('status ' + JSON.stringify([hs.rows, hsC.rows]));
await expectFail(C, `select public.discord_flush()`, 'a villager cannot run the sender');
await expectOk(A, `select public.discord_send_test('fortunes-weave')`, 'a moderator sends a test');
await expectFail(A, `select public.discord_send_test('fortunes-weave')`, 'one test a minute');
await db.query(`select public.discord_flush()`);
const testPost = await db.query(`select body from net.sent order by id`);
testPost.rows.length === 1 && testPost.rows[0].body.embeds[0].title === 'Village is connected' && JSON.stringify(testPost.rows[0].body.allowed_mentions) === '{"parse":[]}'
  ? ok('the test goes out at once, with no mentions allowed') : bad('test post ' + JSON.stringify(testPost.rows));

const DD1 = 'dddddddd-0000-0000-0000-000000000001', DD2 = 'dddddddd-0000-0000-0000-000000000002', DD3 = 'dddddddd-0000-0000-0000-000000000003';
await db.exec(`insert into public.drafts (id, game_id, block_key, kind, title, content, author_id) values
  ('${DD1}', 'fortunes-weave', 'people', 'fact', 'Add Iron Lance', '{"name":"Iron *Lance* @here","sections":[],"categories":{}}', '${C}'),
  ('${DD2}', 'fortunes-weave', 'people', 'fact', 'Secret ending', '{"name":"Secret","spoiler":true,"sections":[],"categories":{}}', '${C}'),
  ('${DD3}', 'fortunes-weave', 'people', 'fact', 'Iron Lance', '{"name":"Iron Lance","sections":[],"categories":{}}', '${C}');`);
await expectOk(A, `select public.ship_draft('${DD1}')`, 'a moderator publishes a new entry');
await expectOk(A, `select public.ship_draft('${DD2}')`, 'and a spoiler');
await db.exec(`update public.drafts set card_id = (select card_id from public.drafts where id = '${DD1}') where id = '${DD3}'`);
await expectOk(A, `select public.ship_draft('${DD3}')`, 'and a fix to the first');
const lines = (await db.query(`select line from public.discord_outbox where kind = 'published' order by id`)).rows.map((r) => r.line);
lines.length === 3 && !/@here|@everyone/.test(lines.join('')) && lines[0].includes('\\*Lance\\*') && lines[0].includes('(new)') && lines[0].includes('\\[x\\]')
  && lines[1].startsWith('• [A spoiler](') && lines[2].includes('(updated)') && !lines[2].includes(': Iron')
  ? ok('published Drafts queue escaped lines: (new), (updated), spoilers hidden, no mentions') : bad('lines ' + JSON.stringify(lines));
const early = (await db.query(`select public.discord_flush() as n`)).rows[0].n;
await db.exec(`update public.discord_outbox set created_at = now() - interval '11 minutes' where kind = 'published'`);
const quiet = (await db.query(`select public.discord_flush() as n`)).rows[0].n;
const post = (await db.query(`select body from net.sent order by id desc limit 1`)).rows[0]?.body;
early === 0 && quiet === 1 && post?.embeds[0].description.split('\n').length === 3 && JSON.stringify(post.allowed_mentions) === '{"parse":[]}'
  ? ok('nothing posts while it is busy; once quiet, one post with every line') : bad('batching ' + JSON.stringify([early, quiet, post]));

// Publishing never fails because of Discord, even when queueing a line goes wrong.
await db.exec(`alter table public.discord_outbox add constraint discord_test_break check (false) not valid`);
const DD4 = 'dddddddd-0000-0000-0000-000000000004';
await db.exec(`insert into public.drafts (id, game_id, block_key, kind, title, content, author_id) values ('${DD4}', 'fortunes-weave', 'people', 'fact', 'Add Steel Lance', '{"name":"Steel Lance","sections":[],"categories":{}}', '${C}')`);
await expectOk(A, `select public.ship_draft('${DD4}')`, 'a Draft still publishes when its Discord line cannot be queued');
const shipped = await db.query(`select status from public.drafts where id = '${DD4}'`);
shipped.rows[0]?.status === 'stable' ? ok('and it is on Stable') : bad('blocked publish ' + JSON.stringify(shipped.rows));
await db.exec(`alter table public.discord_outbox drop constraint discord_test_break`);

await db.exec(`insert into net._http_response (id, status_code) select request_id, 404 from public.discord_sends order by request_id desc limit 1`);
await db.query(`select public.discord_flush()`);
const brokenHook = await db.query(`select status, last_error from public.discord_hooks where game_id = 'fortunes-weave'`);
brokenHook.rows[0]?.status === 'broken' && /no longer accepts/.test(brokenHook.rows[0].last_error ?? '') ? ok('a deleted webhook marks the link as not working') : bad('broken ' + JSON.stringify(brokenHook.rows));
await expectFail(A, `select public.set_discord_kinds('fortunes-weave', array['everything'])`, 'unknown kinds of post are refused');
await expectFail(C, `select public.remove_discord_hook('fortunes-weave')`, 'a villager cannot disconnect Discord');
await expectOk(A, `select public.remove_discord_hook('fortunes-weave')`, 'a moderator disconnects');
const hooksLeft = await db.query(`select count(*)::int as n from public.discord_hooks`);
hooksLeft.rows[0].n === 0 ? ok('the link is forgotten') : bad('hook still there');
}

// Communities (docs/blocks/discord.md, part 2): players list a Discord server or a link, which
// waits for a moderator; approving or declining tells the lister in their inbox; votes, never on
// your own; reports reach the game and close when it's taken down; 5 listings a day.
{
const CM1 = 'cccccccc-0000-0000-0000-000000000001', CM2 = 'cccccccc-0000-0000-0000-000000000002', CM3 = 'cccccccc-0000-0000-0000-000000000003';
await expectOk(C, `insert into public.communities (id, game_id, kind, invite, name, pitch, listed_by) values ('${CM1}', 'fortunes-weave', 'discord', 'WeaveFans', 'Weave Fans', 'Co-op every Friday', '${C}')`, 'a villager lists a Discord server');
await expectOk(C, `insert into public.communities (id, game_id, kind, url, name, pitch, listed_by) values ('${CM2}', 'fortunes-weave', 'link', 'https://www.reddit.com/r/FortunesWeave', 'r/FortunesWeave', 'News and builds', '${C}')`, 'and a subreddit');
await expectFail(C, `insert into public.communities (game_id, kind, invite, pitch, listed_by) values ('fortunes-weave', 'discord', 'weavefans', 'Again', '${C}')`, 'the same server cannot be listed twice for a game');
await expectFail(C, `insert into public.communities (game_id, kind, url, name, pitch, listed_by) values ('fortunes-weave', 'link', 'https://bit.ly/abc', 'Short', 'Hidden link', '${C}')`, 'link shorteners are refused');
await expectFail(C, `insert into public.communities (game_id, kind, url, name, pitch, listed_by) values ('fortunes-weave', 'link', 'javascript:alert(1)', 'X', 'Bad link', '${C}')`, 'only https links are kept');
await expectFail(C, `insert into public.communities (game_id, kind, invite, pitch, listed_by) values ('fortunes-weave', 'discord', 'other1', 'Pretend', '${B}')`, 'nobody lists in someone else\'s name');
await expectOk(C, `insert into public.communities (game_id, kind, invite, pitch, listed_by, status) values ('fortunes-weave', 'discord', 'other2', 'Sneaky', '${C}', 'live')`, 'a villager sends a listing marked live');
const sneaky = await db.query(`select status from public.communities where invite = 'other2'`);
sneaky.rows[0]?.status === 'waiting' ? ok('it still waits for approval') : bad('skipped approval ' + JSON.stringify(sneaky.rows));
const seenWaiting = await asUser(B, `select count(*)::int as n from public.communities`);
const ownWaiting = await asUser(C, `select count(*)::int as n from public.communities`);
seenWaiting.rows[0].n === 0 && ownWaiting.rows[0].n === 3 ? ok('waiting listings show only to their lister and moderators') : bad('waiting visible ' + JSON.stringify([seenWaiting.rows, ownWaiting.rows]));
await expectFail(C, `update public.communities set status = 'live' where id = '${CM1}'`, 'a villager cannot approve their own listing');
await expectFail(B, `select public.decide_community('${CM1}', true)`, 'a villager cannot approve listings');
await expectFail(A, `select public.decide_community('${CM2}', false, '')`, 'declining needs a reason');
await expectOk(A, `select public.decide_community('${CM1}', true)`, 'a moderator approves the server');
await expectOk(A, `select public.decide_community('${CM2}', false, 'Please link the main subreddit')`, 'and declines the link with a reason');
await expectFail(A, `select public.decide_community('${CM1}', false, 'changed my mind')`, 'a decided listing stays decided');
const cin = await db.query(`select type, payload->>'title' as title, payload->>'body' as body from public.inbox where profile_id = '${C}' and type like 'community_%' order by id`);
cin.rows.length === 2 && cin.rows[0].type === 'community_live' && cin.rows[1].body === 'Please link the main subreddit'
  ? ok('the lister hears both answers in their inbox') : bad('community inbox ' + JSON.stringify(cin.rows));
const liveNow = await asUser(B, `select id from public.communities`);
liveNow.rows.length === 1 && liveNow.rows[0].id === CM1 ? ok('an approved listing shows to everyone; a declined one does not') : bad('live ' + JSON.stringify(liveNow.rows));
await expectFail(C, `insert into public.community_votes (community_id, voter_id, value) values ('${CM1}', '${C}', 1)`, 'nobody votes on their own listing');
await expectOk(B, `insert into public.community_votes (community_id, voter_id, value) values ('${CM1}', '${B}', 1)`, 'another villager recommends it');
await expectOk(A, `insert into public.community_votes (community_id, voter_id, value) values ('${CM1}', '${A}', -1)`, 'a moderator says not for me');
await expectFail(B, `insert into public.community_votes (community_id, voter_id, value) values ('${CM2}', '${B}', 1)`, 'nobody votes on a listing that is not live');
const ct = await asUser(C, `select ups, downs from public.community_tallies('fortunes-weave')`);
const cv = await asUser(C, `select count(*)::int as n from public.community_votes`);
ct.rows[0]?.ups === 1 && ct.rows[0].downs === 1 && cv.rows[0].n === 0 ? ok('totals are shared, who voted how is not') : bad('community tallies ' + JSON.stringify([ct.rows, cv.rows]));
await expectOk(B, `insert into public.flags (community_id, reason, reporter_id) values ('${CM1}', 'spam', '${B}')`, 'a villager reports a listing');
const cfl = await db.query(`select game_id from public.flags where community_id = '${CM1}'`);
cfl.rows[0]?.game_id === 'fortunes-weave' ? ok('listing reports reach that game') : bad('community flag ' + JSON.stringify(cfl.rows));
await expectFail(B, `select public.remove_community('${CM1}')`, 'another villager cannot take a listing down');
await expectOk(A, `select public.remove_community('${CM1}')`, 'a moderator takes it down');
const cgone = await db.query(`select (select status from public.communities where id = '${CM1}') as st, (select status from public.flags where community_id = '${CM1}') as fl`);
cgone.rows[0].st === 'removed' && cgone.rows[0].fl === 'resolved' ? ok('taking it down hides it and closes its reports') : bad('community removal ' + JSON.stringify(cgone.rows));
await expectOk(C, `insert into public.communities (id, game_id, kind, invite, pitch, listed_by) values ('${CM3}', 'fortunes-weave', 'discord', 'WeaveFans', 'Back again', '${C}')`, 'a taken-down server can be listed again for review');
await expectOk(C, `select public.remove_community('${CM3}')`, 'the lister can take their own listing away');
await expectOk(C, `insert into public.communities (game_id, kind, invite, pitch, listed_by, created_at) values ('fortunes-weave', 'discord', 'spam1', 'Backdated', '${C}', '2020-01-01')`, 'a 5th, sent with last year\'s date');
const dated = await db.query(`select created_at > now() - interval '1 minute' as fresh from public.communities where invite = 'spam1'`);
dated.rows[0]?.fresh === true ? ok('a listing cannot be backdated: it is dated now') : bad('backdated ' + JSON.stringify(dated.rows));
await expectFail(C, `insert into public.communities (game_id, kind, invite, pitch, listed_by) values ('fortunes-weave', 'discord', 'spam9', 'Too many', '${C}')`, 'the 6th listing in a day is refused');
}

// Rate limits can't be dodged with a made-up date: a player's created_at is always now (the hub,
// 20261111130000_created_at_now.sql).
{
await expectOk(C, `insert into public.chat_messages (game_id, author_id, body, created_at) values ('fortunes-weave', '${C}', 'From the past', '2000-01-01')`, 'a villager sends a chat message dated 2000');
const when = await db.query(`select created_at > now() - interval '1 minute' as fresh from public.chat_messages where body = 'From the past'`);
when.rows[0]?.fresh === true ? ok('it is dated now, not 2000') : bad('backdated chat ' + JSON.stringify(when.rows));
}
