// Checks asking to remove an entry (20261120000000_remove_requests.sql) on an in-memory Postgres
// with the same Supabase-like stubs as batches-check.mjs: sending a removal, publishing it, what
// happens to fixes still waiting, and that nothing can reach into another game.
// Usage: node supabase/tests/remove-check.mjs supabase/migrations
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
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('remove_requests'))), 'utf8'));
ok('migrations applied, and the removals SQL runs twice');

const MOD = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '55555555-5555-5555-5555-555555555555';
const FWMOD = '77777777-7777-7777-7777-777777777777';
const CARD = '33333333-3333-3333-3333-333333333333', KEEP = '44444444-4444-4444-4444-444444444444', ELSEWHERE = '66666666-6666-6666-6666-666666666666';
await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values ('${MOD}', '{"full_name":"Matt"}'), ('${B}', '{"full_name":"Mira"}'), ('${C}', '{}'), ('${FWMOD}', '{}');
  insert into public.moderators (profile_id, game_id) values ('${MOD}', null);
  insert into public.games (id, title, status, preset) values ('fw', 'Fortune''s Weave', 'live', 'tactics-rpg'), ('oot', 'Ocarina of Time', 'live', 'tactics-rpg');
  insert into public.moderators (profile_id, game_id) values ('${FWMOD}', 'fw');
  insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position) values ('fw', 'classes', 'Classes', 'Classes', 'Users', 'indigo', '', 0), ('oot', 'items', 'Items', 'Items', 'Users', 'sun', '', 0);
  insert into public.game_blocks (game_id, block_key, title, page_key, type) values ('fw', 'classes', 'Classes', 'classes', 'classes'), ('oot', 'items', 'Items', 'items', 'items');
  insert into public.cards (id, game_id, block_key, slug) values ('${CARD}', 'fw', 'classes', 'advanced-classes'), ('${KEEP}', 'fw', 'classes', 'lord'), ('${ELSEWHERE}', 'oot', 'items', 'hookshot');
  insert into public.card_revisions (card_id, content, summary) values
    ('${CARD}', '{"name":"Advanced classes","sections":[],"categories":{}}', 'first'),
    ('${KEEP}', '{"name":"Lord","sections":[],"categories":{}}', 'first'),
    ('${ELSEWHERE}', '{"name":"Hookshot","sections":[],"categories":{}}', 'first');
  insert into public.card_pointers (card_id, channel, revision_id) select card_id, 'stable', id from public.card_revisions;
  insert into public.card_pointers (card_id, channel, revision_id) select card_id, 'preview', id from public.card_revisions where card_id = '${CARD}';
`);
const rev = async (card) => (await db.query(`select revision_id from public.card_pointers where card_id = '${card}' and channel = 'stable'`)).rows[0]?.revision_id;
const advRev = await rev(CARD), keepRev = await rev(KEEP), elseRev = await rev(ELSEWHERE);

const asUser = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const expectFail = async (uid, sql, label, word) => {
  try { await asUser(uid, sql); bad(label + ' (it went through)'); }
  catch (e) { !word || e.message.includes(word) ? ok(label + ' (refused)') : bad(`${label}: wrong reason "${e.message}"`); }
};
const one = async (uid, sql) => (await asUser(uid, sql)).rows[0];
const draft = (uid, { game = 'fw', block = 'classes', card = null, base = null, action = 'edit', name = 'Advanced classes', source = null }) =>
  `insert into public.drafts (game_id, block_key, card_id, base_revision_id, kind, title, content, source, author_id, action)
   values ('${game}', '${block}', ${card ? `'${card}'` : 'null'}, ${base ?? 'null'}, 'fact', '${action === 'remove' ? 'Remove ' : ''}${name}',
     '{"name":"${name}","sections":[],"categories":{}}', ${source ? `'${source}'` : 'null'}, '${uid}', '${action}') returning id`;

// Sending ---------------------------------------------------------------------------------------
const removal = (await one(B, draft(B, { card: CARD, base: advRev, action: 'remove', source: 'It is a heading, not a class' }))).id;
removal ? ok('anyone signed in can ask to remove an entry they did not write') : bad('no removal Draft');
await expectFail(B, draft(B, { action: 'remove', name: 'Nothing' }), 'a removal has to name an entry', 'drafts_action_check');
await expectFail(B, draft(B, { card: CARD, base: advRev, action: 'delete' }), 'only edit and remove are actions', 'drafts_action_check');
const fix = (await one(C, draft(C, { card: CARD, base: advRev, name: 'Advanced classes (fixed)' }))).id;
const keepFix = (await one(C, draft(C, { card: KEEP, base: keepRev, name: 'Lord (fixed)' }))).id;
// Someone points a Draft in Fortune's Weave at Ocarina of Time's Hookshot.
const sneaky = (await one(B, draft(B, { card: ELSEWHERE, base: elseRev, action: 'remove', name: 'Hookshot' }))).id;

// Publishing ------------------------------------------------------------------------------------
await expectFail(C, `select public.ship_draft('${removal}')`, 'only moderators publish a removal', 'moderators');
await expectFail(FWMOD, `select public.ship_draft('${sneaky}')`, "a Draft can't remove an entry from another game", 'this game');
(await rev(ELSEWHERE)) === elseRev ? ok('the other game\'s entry is still there') : bad('Hookshot gone');

await asUser(FWMOD, `select public.ship_draft('${removal}')`);
const after = (await db.query(`select
  (select count(*)::int from public.card_pointers where card_id = '${CARD}') as pointers,
  (select count(*)::int from public.card_revisions where card_id = '${CARD}') as revisions,
  (select count(*)::int from public.cards where id = '${CARD}') as cards,
  (select status from public.drafts where id = '${removal}') as removal,
  (select status || ': ' || decline_reason from public.drafts where id = '${fix}') as fix,
  (select status from public.drafts where id = '${keepFix}') as keep_fix`)).rows[0];
after.pointers === 0 ? ok('publishing a removal takes the entry out of the app (Stable and Preview)') : bad('pointers ' + JSON.stringify(after));
after.revisions === 1 && after.cards === 1 ? ok('the entry and its versions are kept, to bring it back') : bad('kept ' + JSON.stringify(after));
after.removal === 'stable' ? ok('the removal Draft is marked published') : bad('removal ' + after.removal);
after.fix === 'declined: The entry was removed from the app.' ? ok('a fix still waiting on it is declined, with the reason') : bad('fix ' + after.fix);
after.keep_fix === 'open' ? ok('fixes to other entries are left alone') : bad('keep fix ' + after.keep_fix);

const note = (await db.query(`select body, event->>'type' as type, event->>'removed' as removed from public.chat_messages where linked_draft_id = '${removal}'`)).rows[0];
note?.body === 'Advanced classes was removed from the app.' && note.type === 'published' && note.removed === 'true'
  ? ok('the Workshop chat says it was removed') : bad('note ' + JSON.stringify(note));

const late = (await one(C, draft(C, { card: CARD, base: advRev, name: 'Advanced classes again' }))).id;
await expectFail(FWMOD, `select public.ship_draft('${late}')`, "a fix to a removed entry can't bring it back by accident", 'removed');
await expectFail(FWMOD, `select public.ship_draft('${removal}')`, 'a removal is published only once', 'already been decided');

// Everything else still publishes as before ------------------------------------------------------
await asUser(FWMOD, `select public.ship_draft('${keepFix}')`);
const lord = (await db.query(`select r.content->>'name' as name from public.card_pointers p join public.card_revisions r on r.id = p.revision_id where p.card_id = '${KEEP}' and p.channel = 'stable'`)).rows[0];
lord?.name === 'Lord (fixed)' ? ok('a normal fix still publishes') : bad('fix ' + JSON.stringify(lord));
const fresh = (await one(C, draft(C, { name: 'Great Lord' }))).id;
await asUser(FWMOD, `select public.ship_draft('${fresh}')`);
const added = (await db.query(`select count(*)::int as n from public.cards c join public.card_pointers p on p.card_id = c.id where c.slug = 'great-lord'`)).rows[0];
added.n === 1 ? ok('a new entry still publishes') : bad('new ' + JSON.stringify(added));
const declined = (await one(C, draft(C, { card: KEEP, base: await rev(KEEP), action: 'remove', name: 'Lord' }))).id;
await asUser(FWMOD, `update public.drafts set status = 'declined', decline_reason = 'Lord is a real class', decided_by = '${FWMOD}', decided_at = now() where id = '${declined}'`);
(await rev(KEEP)) ? ok('a declined removal leaves the entry in the app') : bad('Lord gone after decline');

// Bringing it back (20261120120000_bring_back_entries.sql) ----------------------------------------
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('bring_back_entries'))), 'utf8'));
await expectFail(C, `select public.restore_entry('${removal}')`, 'only moderators bring an entry back', 'moderators');
await expectFail(FWMOD, `select public.restore_entry('${keepFix}')`, 'only a removal can be undone this way', "isn't a removal");
await expectFail(FWMOD, `select public.restore_entry('${declined}')`, 'a declined removal has nothing to bring back', 'never removed');
await asUser(FWMOD, `select public.restore_entry('${removal}')`);
(await rev(CARD)) === advRev ? ok('a moderator brings it back, as its newest version') : bad('restore ' + (await rev(CARD)));
const back = (await db.query(`select body, event->>'restored' as restored from public.chat_messages where linked_draft_id = '${removal}' order by id desc limit 1`)).rows[0];
back?.body === 'Advanced classes is back in the app.' && back.restored === 'true' ? ok('the Workshop chat says it is back') : bad('back note ' + JSON.stringify(back));
await expectFail(FWMOD, `select public.restore_entry('${removal}')`, 'it can only come back once', 'already back');
const anon = (await db.query(`select has_function_privilege('anon', 'public.restore_entry(uuid)', 'execute') as p`)).rows[0].p;
anon === false ? ok('signed-out visitors cannot call it') : bad('anon can restore');

const trig = (await db.query(`select pg_get_triggerdef(oid) as d from pg_trigger where tgname = 'drafts_discord'`)).rows[0]?.d ?? '';
trig.includes("action = 'edit'") ? ok('removals are not posted to Discord') : bad('discord trigger ' + trig);
