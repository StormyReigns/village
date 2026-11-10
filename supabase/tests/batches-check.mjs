// Checks batches (docs/blocks/spreadsheets.md, level 2) on an in-memory Postgres with the same
// Supabase-like stubs as schema-check.mjs: sending, the limits, voting, publishing with rows set
// aside, declining, withdrawing and "this row's off".
// Usage: node supabase/tests/batches-check.mjs supabase/migrations
/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars */
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
// Running the batches SQL a second time must be harmless.
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('draft_batches'))), 'utf8'));
ok('migrations applied, and the batches SQL runs twice');

const MOD = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '55555555-5555-5555-5555-555555555555';
const CARD = '33333333-3333-3333-3333-333333333333', OTHER = '66666666-6666-6666-6666-666666666666';
await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values ('${MOD}', '{"full_name":"Matt"}'), ('${B}', '{"full_name":"Mira"}'), ('${C}', '{}');
  insert into public.moderators (profile_id, game_id) values ('${MOD}', null);
  insert into public.games (id, title, status, preset) values ('fw', 'Fortune''s Weave', 'live', 'tactics-rpg');
  insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position) values ('fw', 'units-and-classes', 'Units and classes', 'Units', 'Users', 'berry', '', 0);
  insert into public.game_blocks (game_id, block_key, title, page_key, type) values ('fw', 'units', 'Units', 'units-and-classes', 'characters'), ('fw', 'items', 'Items', 'units-and-classes', 'items');
  insert into public.cards (id, game_id, block_key, slug) values ('${CARD}', 'fw', 'units', 'cai'), ('${OTHER}', 'fw', 'items', 'iron-ore');
  insert into public.card_revisions (card_id, content, summary) values ('${CARD}', '{"name":"Cai","sections":[],"categories":{}}', 'first'), ('${OTHER}', '{"name":"Iron Ore","sections":[],"categories":{}}', 'first');
  insert into public.card_pointers (card_id, channel, revision_id) select card_id, 'stable', id from public.card_revisions;
`);
const rev = async (card) => (await db.query(`select revision_id from public.card_pointers where card_id = '${card}' and channel = 'stable'`)).rows[0].revision_id;
const caiRev = await rev(CARD), oreRev = await rev(OTHER);

const asUser = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const expectFail = async (uid, sql, label, word) => {
  try { const r = await asUser(uid, sql); (r.affectedRows ?? 0) === 0 && !r.rows?.length ? ok(label + ' (no rows changed)') : bad(label); }
  catch (e) { !word || e.message.includes(word) ? ok(label + ' (refused)') : bad(`${label}: wrong reason "${e.message}"`); }
};
const one = async (uid, sql) => (await asUser(uid, sql)).rows[0];
const row = (name, card = null, revision = null, extra = {}) => ({ content: { name, sections: [], categories: {}, ...extra }, card, revision });
const send = (rows, title = 'Changes from Mira\'s stat sheet', block = 'units') =>
  `select public.send_batch('fw', '${block}', '${title.replace(/'/g, "''")}', 'Fan stat sheet by Mira', '${JSON.stringify(rows).replace(/'/g, "''")}'::jsonb) as id`;

// Sending ---------------------------------------------------------------------------------------
const b1 = (await one(B, send([row('Goliath'), row('Cai', CARD, caiRev, { description: 'Fixed' })]))).id;
const n1 = await db.query(`select count(*)::int as n, count(*) filter (where card_id is null)::int as fresh, bool_and(source = 'Fan stat sheet by Mira') as src from public.drafts where batch_id = '${b1}'`);
n1.rows[0].n === 2 && n1.rows[0].fresh === 1 && n1.rows[0].src ? ok('a batch is sent as one Draft per row, with its source') : bad('send ' + JSON.stringify(n1.rows));
const cr = await db.query(`select count(*)::int as n from public.draft_credits c join public.drafts d on d.id = c.draft_id where d.batch_id = '${b1}' and c.role = 'author'`);
cr.rows[0].n === 2 ? ok('the sender is credited on every row') : bad('credits ' + JSON.stringify(cr.rows));

await expectFail(B, `insert into public.drafts (game_id, block_key, kind, title, content, author_id, batch_id) values ('fw', 'units', 'fact', 'Sneaky', '{"name":"Sneaky"}', '${B}', '${b1}')`, 'a Draft cannot be slipped into a batch by hand', 'batch');
await expectFail(B, `insert into public.draft_batches (game_id, block_key, title, source, author_id) values ('fw', 'units', 'Mine', 'Me me me', '${B}')`, 'a batch cannot be made by hand');
await expectFail(C, send([row('Cai', OTHER, oreRev)]), 'a row cannot point at an entry in another Block', 'isn');
await expectFail(C, send([row('Cai', CARD, caiRev), row('Cai again', CARD, caiRev)]), 'two rows cannot change the same entry', 'same entry');
await expectFail(C, send([row('Cai', CARD, null)]), 'a fix needs the version it was based on', 'version');
await expectFail(C, send([row('Al')]), 'every row needs a proper name', 'name');
await expectFail(C, send(Array.from({ length: 201 }, (_, i) => row(`Unit ${i}`))), 'a batch holds 200 rows at most', '200');
await expectFail(C, `select public.send_batch('fw', 'units', 'No source', ' ', '[{"content":{"name":"Goliath"}}]'::jsonb)`, 'a batch needs a source', 'credited');
await expectFail(C, `select public.send_batch('fw', 'nowhere', 'Wrong', 'Somewhere', '[{"content":{"name":"Goliath"}}]'::jsonb)`, 'a batch needs a real Block', 'Block');

// Limits ----------------------------------------------------------------------------------------
const big = (await one(C, send(Array.from({ length: 30 }, (_, i) => row(`Recruit ${i}`)), '30 recruits'))).id;
try { await asUser(C, `insert into public.drafts (game_id, block_key, kind, title, content, author_id) values ('fw', 'units', 'fact', 'One more', '{"name":"One more"}', '${C}')`); ok('a 30-row batch counts as one Draft: a Draft right after is fine'); }
catch (e) { bad('batch counted row by row: ' + e.message); }
await one(C, send([row('Second batch')], 'Second'));
await one(C, send([row('Third batch')], 'Third'));
const third = await db.query(`select count(*)::int as n from public.draft_batches where author_id = '${C}'`);
third.rows[0].n === 3 ? ok('three batches in a day are fine') : bad('third ' + JSON.stringify(third.rows));
await expectFail(C, send([row('Fourth batch')], 'Fourth'), 'the 4th batch in a day is refused', '3 batches');
await db.exec(`update public.draft_batches set created_at = now() - interval '2 hours' where author_id = '${C}'`);
await db.exec(`update public.drafts set created_at = now() - interval '2 hours' where author_id = '${C}'`);
for (let i = 0; i < 20; i++) await asUser(C, `insert into public.drafts (game_id, block_key, kind, title, content, author_id) values ('fw', 'units', 'fact', 'Draft ${i}', '{"name":"Draft ${i}"}', '${C}')`);
await expectFail(C, `insert into public.drafts (game_id, block_key, kind, title, content, author_id) values ('fw', 'units', 'fact', 'Draft 21', '{"name":"Draft 21"}', '${C}')`, 'the hourly limit still holds for single Drafts', '20 Drafts');

// Voting ----------------------------------------------------------------------------------------
await expectFail(B, `insert into public.batch_votes (batch_id, voter_id, value) values ('${b1}', '${B}', 1)`, 'the sender cannot vote on their own batch');
await expectFail(C, `insert into public.batch_votes (batch_id, voter_id, value) values ('${b1}', '${B}', 1)`, 'nobody votes as someone else');
await asUser(C, `insert into public.batch_votes (batch_id, voter_id, value) values ('${b1}', '${C}', 1)`);
const sc = await db.query(`select ups, downs from public.batch_scores where batch_id = '${b1}'`);
sc.rows[0]?.ups === 1 && sc.rows[0]?.downs === 0 ? ok('a vote counts once for the whole batch') : bad('scores ' + JSON.stringify(sc.rows));

// Publishing ------------------------------------------------------------------------------------
await expectFail(B, `select public.ship_batch('${b1}')`, 'only moderators publish a batch', 'moderators');
const res = (await one(MOD, `select public.ship_batch('${b1}') as r`)).r;
res.shipped === 2 && res.aside === 0 ? ok('a moderator publishes the whole batch at once') : bad('ship ' + JSON.stringify(res));
const after = await db.query(`select (select count(*)::int from public.drafts where batch_id = '${b1}' and status = 'stable') as stable,
  (select count(*)::int from public.cards where block_key = 'units') as cards,
  (select r.content->>'description' from public.card_pointers p join public.card_revisions r on r.id = p.revision_id where p.card_id = '${CARD}' and p.channel = 'stable') as cai,
  (select status from public.draft_batches where id = '${b1}') as status`);
const a = after.rows[0];
a.stable === 2 && a.cards === 2 && a.cai === 'Fixed' && a.status === 'stable' ? ok('its rows are in the app: Goliath added, Cai fixed') : bad('after ship ' + JSON.stringify(a));
const notes = await db.query(`select event->>'type' as type, thread_key from public.chat_messages where kind = 'system'`);
notes.rows.length === 1 && notes.rows[0].type === 'batch_published' && notes.rows[0].thread_key === 'block:units'
  ? ok('one chat note for the batch, none per row') : bad('notes ' + JSON.stringify(notes.rows));
const inbox = await db.query(`select type, payload->>'title' as title from public.inbox where profile_id = '${B}'`);
inbox.rows.length === 1 && inbox.rows[0].type === 'batch_published' ? ok('the sender hears: ' + inbox.rows[0].title) : bad('inbox ' + JSON.stringify(inbox.rows));
await expectFail(MOD, `select public.ship_batch('${b1}')`, 'a batch is published only once', 'already');

// A row whose entry changed since, and a new row whose name now exists, are set aside.
const caiNow = await rev(CARD);
const b2 = (await one(B, send([row('Cai', CARD, caiNow, { description: 'Sheet says' }), row('Goliath'), row('Brand new')], 'Second sheet'))).id;
await db.exec(`insert into public.card_revisions (card_id, content, summary) values ('${CARD}', '{"name":"Cai","description":"Someone else fixed it","sections":[],"categories":{}}', 'newer');
  update public.card_pointers set revision_id = (select max(id) from public.card_revisions where card_id = '${CARD}') where card_id = '${CARD}' and channel = 'stable';`);
const res2 = (await one(MOD, `select public.ship_batch('${b2}') as r`)).r;
const aside = await db.query(`select title, status, batch_id from public.drafts where title in ('Cai', 'Goliath') and status = 'open'`);
res2.shipped === 1 && res2.aside === 2 && aside.rows.length === 2 && aside.rows.every((r) => r.batch_id === null)
  ? ok('rows that would overwrite a newer fix or add a duplicate are set aside as Drafts of their own') : bad('aside ' + JSON.stringify({ res2, rows: aside.rows }));
const kept = await db.query(`select r.content->>'description' as d from public.card_pointers p join public.card_revisions r on r.id = p.revision_id where p.card_id = '${CARD}' and p.channel = 'stable'`);
kept.rows[0].d === 'Someone else fixed it' ? ok('the newer fix is kept') : bad('overwrote ' + JSON.stringify(kept.rows));

// A row that fails to publish is set aside, and the rest still publish.
await db.exec(`update public.draft_batches set created_at = now() - interval '2 days' where author_id = '${B}'`);
const bx = (await one(B, send([row('Explodes on publish'), row('Publishes fine')], 'Sheet with a bad row'))).id;
await db.exec(`create function pg_temp.boom() returns trigger language plpgsql as $$ begin
    if new.content->>'name' = 'Explodes on publish' then raise exception 'boom'; end if; return new; end $$;
  create trigger boom before insert on public.card_revisions for each row execute function pg_temp.boom();`);
let resx = null;
try { resx = (await one(MOD, `select public.ship_batch('${bx}') as r`)).r; } catch (e) { bad('one bad row sank the publish: ' + e.message); }
await db.exec(`drop trigger boom on public.card_revisions`);
const bxRows = await db.query(`select title, status, batch_id from public.drafts where title in ('Explodes on publish', 'Publishes fine') order by title`);
resx?.shipped === 1 && resx?.aside === 1 && bxRows.rows[0].status === 'open' && bxRows.rows[0].batch_id === null && bxRows.rows[1].status === 'stable'
  ? ok('a row that fails to publish is set aside, and the rest still publish') : bad('bad row ' + JSON.stringify({ resx, rows: bxRows.rows }));
const inv = await db.query(`select reloptions from pg_class where relname = 'batch_scores'`);
String(inv.rows[0]?.reloptions).includes('security_invoker=true') ? ok('batch_scores runs as whoever reads it') : bad('view options ' + JSON.stringify(inv.rows));

// "This row's off", declining and withdrawing --------------------------------------------------
await db.exec(`update public.draft_batches set created_at = now() - interval '2 days' where author_id = '${B}'`);
const b3 = (await one(B, send([row('Row one'), row('Row two')], 'Third sheet'))).id;
const rowOne = (await db.query(`select id from public.drafts where batch_id = '${b3}' and title = 'Row one'`)).rows[0].id;
await expectFail(C, `select public.set_aside_row('${rowOne}', '')`, 'setting a row aside needs a reason', 'what');
await asUser(C, `select public.set_aside_row('${rowOne}', 'Wrong stats')`);
const off = await db.query(`select (select batch_id from public.drafts where id = '${rowOne}') as batch, (select count(*)::int from public.flags where draft_id = '${rowOne}') as flags`);
off.rows[0].batch === null && off.rows[0].flags === 1 ? ok('a flagged row leaves the batch and moderators get a report') : bad('set aside ' + JSON.stringify(off.rows));
await expectFail(MOD, `select public.decline_batch('${b3}', '')`, 'declining needs a reason', 'why');
await asUser(MOD, `select public.decline_batch('${b3}', 'These are from an old version of the game')`);
const dec = await db.query(`select status from public.drafts where batch_id = '${b3}'`);
dec.rows.length === 1 && dec.rows[0].status === 'declined' ? ok('declining declines every row still in the batch') : bad('decline ' + JSON.stringify(dec.rows));
const b4 = (await one(B, send([row('Row three')], 'Fourth sheet'))).id;
await expectFail(C, `select public.withdraw_batch('${b4}')`, 'only the sender can take a batch back', 'Only');
await asUser(B, `select public.withdraw_batch('${b4}')`);
const wd = await db.query(`select (select status from public.draft_batches where id = '${b4}') as b, (select status from public.drafts where batch_id = '${b4}') as d`);
wd.rows[0].b === 'removed' && wd.rows[0].d === 'removed' ? ok('the sender can take back an undecided batch') : bad('withdraw ' + JSON.stringify(wd.rows));
const seen = await asUser(C, `select count(*)::int as n from public.draft_batches where id = '${b4}'`);
seen.rows[0].n === 0 ? ok('a taken-back batch is hidden from players') : bad('removed batch visible');

// Ordinary Drafts still get their own chat note.
const single = (await one(B, `insert into public.drafts (game_id, block_key, kind, title, content, author_id) values ('fw', 'units', 'fact', 'Solo fix', '{"name":"Solo fix"}', '${B}') returning id`)).id;
await asUser(MOD, `select public.ship_draft('${single}')`);
const solo = await db.query(`select count(*)::int as n from public.chat_messages where kind = 'system' and event->>'type' = 'published'`);
solo.rows[0].n === 1 ? ok('a single published Draft still gets its chat note') : bad('solo note ' + JSON.stringify(solo.rows));
