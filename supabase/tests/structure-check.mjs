// Checks suggesting a new Page or Block as a Draft (20261122000000_page_block_drafts.sql) on an
// in-memory Postgres with the same Supabase-like stubs as remove-check.mjs: sending one, publishing
// it, what's checked in what a player typed, and that nothing reaches into another game.
// Usage: node supabase/tests/structure-check.mjs supabase/migrations
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
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('page_block_drafts'))), 'utf8'));
ok('migrations applied, and the Page and Block Drafts SQL runs twice');

const B = '22222222-2222-2222-2222-222222222222', FWMOD = '77777777-7777-7777-7777-777777777777';
await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values ('${B}', '{"full_name":"Mira"}'), ('${FWMOD}', '{}');
  insert into public.games (id, title, status, preset) values ('fw', 'Fortune''s Weave', 'live', 'tactics-rpg'), ('oot', 'Ocarina of Time', 'live', 'tactics-rpg');
  insert into public.moderators (profile_id, game_id) values ('${FWMOD}', 'fw');
  insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position) values
    ('fw', 'units', 'Units', 'Units', 'Users', 'berry', '', 0), ('oot', 'items', 'Items', 'Items', 'Backpack', 'sun', '', 0);
  insert into public.game_blocks (game_id, block_key, title, page_key, type, position) values
    ('fw', 'units', 'Units', 'units', 'characters', 0), ('fw', 'classes', 'Classes', 'units', 'classes', 1), ('oot', 'items', 'Items', 'items', 'items', 0);
`);

const asUser = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const expectFail = async (uid, sql, label, word) => {
  try { await asUser(uid, sql); bad(label + ' (it went through)'); }
  catch (e) { !word || e.message.includes(word) ? ok(label + ' (refused)') : bad(`${label}: wrong reason "${e.message}"`); }
};
const q = (s) => `'${JSON.stringify(s).replace(/'/g, "''")}'`;
const send = async (action, content, { key = 'new-block', game = 'fw', title = 'A new thing', card = null } = {}) =>
  (await asUser(B, `insert into public.drafts (game_id, block_key, card_id, kind, title, content, author_id, action)
    values ('${game}', '${key}', ${card ? `'${card}'` : 'null'}, 'opinion', '${title}', ${q({ name: title, sections: [], categories: {}, ...content })}::jsonb, '${B}', '${action}') returning id`)).rows[0].id;
const ship = (id) => asUser(FWMOD, `select public.ship_draft('${id}')`);
const status = async (id) => (await db.query(`select status, block_key from public.drafts where id = '${id}'`)).rows[0];

// A new Page with its first Block ----------------------------------------------------------------
const page = await send('add_page', { page: { title: 'Bestiary', icon: 'Skull', tint: 'leaf' }, block: { title: 'Foes', type: 'characters', icon: 'Skull', intro: 'Who you fight', filters: ['Role or class'], byRoute: true } },
  { key: 'foes', title: 'New Page: Bestiary' });
page ? ok('anyone signed in can suggest a new Page') : bad('no Page Draft');
await expectFail(B, `select public.ship_draft('${page}')`, 'only moderators publish it', 'moderators');
await ship(page);
const p = (await db.query(`select title, short, icon, tint from public.app_pages where game_id = 'fw' and page_key = 'bestiary'`)).rows[0];
p?.title === 'Bestiary' && p.short === 'Bestiary' && p.tint === 'leaf' ? ok('publishing makes the Page, with a short name from its first word') : bad('page ' + JSON.stringify(p));
const fb = (await db.query(`select title, type, icon, intro, filters, by_route, page_key from public.game_blocks where game_id = 'fw' and block_key = 'foes'`)).rows[0];
fb?.page_key === 'bestiary' && fb.type === 'characters' && fb.intro === 'Who you fight' && fb.filters[0] === 'Role or class' && fb.by_route === true
  ? ok('and its first Block on it') : bad('block ' + JSON.stringify(fb));
const ps = await status(page);
ps.status === 'stable' && ps.block_key === 'foes' ? ok('the Draft is published and names the new Block') : bad('draft ' + JSON.stringify(ps));
const note = (await db.query(`select body, block_key from public.chat_messages where linked_draft_id = '${page}'`)).rows[0];
note?.body === 'New Page: Bestiary is now in the app.' && note.block_key === 'bestiary' ? ok('the Workshop chat says so, on the new Page') : bad('note ' + JSON.stringify(note));
await expectFail(FWMOD, `select public.ship_draft('${page}')`, 'it is published only once', 'already been decided');

// Names that clash get their own keys ------------------------------------------------------------
const again = await send('add_page', { page: { title: 'Bestiary', icon: 'Skull', tint: 'sky' }, block: { title: 'Foes', type: 'items', icon: 'Skull' } }, { key: 'foes', title: 'New Page: Bestiary' });
await ship(again);
const keys = (await db.query(`select (select count(*)::int from public.app_pages where page_key = 'bestiary-2') as page2, (select block_key from public.drafts where id = '${again}') as block2`)).rows[0];
keys.page2 === 1 && keys.block2 === 'foes-2' ? ok('a second Page and Block with the same names get keys of their own') : bad('keys ' + JSON.stringify(keys));

// A Block on a Page that's there ------------------------------------------------------------------
const tier = await send('add_block', { pageKey: 'units', block: { title: 'Unit tiers', type: 'tierlist', icon: 'Trophy', ranks: 'units' } }, { key: 'unit-tiers', title: 'Unit tiers on Units' });
await ship(tier);
const t = (await db.query(`select tier_setup from public.game_blocks where block_key = 'unit-tiers'`)).rows[0];
t?.tier_setup?.ranks === 'units' && t.tier_setup.tiers.length === 5 ? ok('a Tier list is set up to rank the Block it named, with S to D') : bad('tier ' + JSON.stringify(t));
const plan = await send('add_block', { pageKey: 'units', block: { title: 'Your party', type: 'planner', icon: 'ClipboardList', roster: 'units', classes: 'classes', size: 250, extra: 'x' } }, { key: 'your-party', title: 'Your party on Units' });
await ship(plan);
const pl = (await db.query(`select plan_setup from public.game_blocks where block_key = 'your-party'`)).rows[0];
JSON.stringify(pl?.plan_setup) === JSON.stringify({ size: 100, roster: 'units', classes: 'classes' }) ? ok('a Planner keeps only its roster, classes and a size of 100 at most') : bad('plan ' + JSON.stringify(pl));

// What a player typed is checked ------------------------------------------------------------------
const refused = async (content, label, word, opts = {}) => {
  const id = await send(opts.action ?? 'add_block', content, opts);
  await expectFail(FWMOD, `select public.ship_draft('${id}')`, label, word);
  (await status(id)).status === 'open' ? null : bad(label + ': the Draft changed');
};
await refused({ pageKey: 'units', block: { title: 'Map', type: 'collection', icon: 'MapPin' } }, 'only the types Add Block offers', 'type');
await refused({ pageKey: 'units', block: { title: 'Odd', type: 'items', icon: '<script>' } }, 'symbols are letters and digits', 'symbol');
await refused({ pageKey: 'units', block: { title: '', type: 'items', icon: 'Gem' } }, 'a Block needs a name', 'name');
await refused({ pageKey: 'units', block: { title: 'x'.repeat(61), type: 'items', icon: 'Gem' } }, 'a Block name is 60 characters at most', 'name');
await refused({ pageKey: 'gone', block: { title: 'Gear', type: 'items', icon: 'Gem' } }, 'a Block needs its Page to be there', 'Page');
await refused({ pageKey: 'units', block: { title: 'Tiers', type: 'tierlist', icon: 'Trophy', ranks: 'items' } }, "a Tier list can't rank another game's Block", 'Tier list');
await refused({ pageKey: 'units', block: { title: 'Tiers', type: 'tierlist', icon: 'Trophy', ranks: 'foes' } }, 'a Tier list ranks a Block on its own Page', 'Tier list');
await refused({ pageKey: 'units', block: { title: 'Party', type: 'planner', icon: 'Users', roster: 'classes' } }, 'a Planner picks from a Characters Block', 'Planner');
await refused({ page: { title: 'Loot', icon: 'Gem', tint: 'pink' }, block: { title: 'Loot', type: 'items', icon: 'Gem' } }, 'a Page takes one of the eight colors', 'color', { action: 'add_page' });
await refused({ page: { title: '', icon: 'Gem', tint: 'sun' }, block: { title: 'Loot', type: 'items', icon: 'Gem' } }, 'a Page needs a name', 'Page needs a name', { action: 'add_page' });
const before = (await db.query(`select count(*)::int as n from public.app_pages`)).rows[0].n;
before === 3 + 1 ? ok('nothing half-made is left behind by a refused Draft') : bad('pages ' + before);

// Another game's moderator, and the action rules ------------------------------------------------------
const elsewhere = await send('add_block', { pageKey: 'items', block: { title: 'Masks', type: 'items', icon: 'Gem' } }, { game: 'oot', key: 'masks', title: 'Masks on Items' });
await expectFail(FWMOD, `select public.ship_draft('${elsewhere}')`, "a moderator of one game can't publish into another", 'moderators');
const CARD = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into public.cards (id, game_id, block_key, slug) values ('${CARD}', 'fw', 'units', 'wren')`);
await expectFail(B, `insert into public.drafts (game_id, block_key, card_id, kind, title, content, author_id, action)
  values ('fw', 'x', '${CARD}', 'opinion', 'Odd one', '{}'::jsonb, '${B}', 'add_block')`, "a Page or Block Draft can't name an entry", 'drafts_action_check');

// Everything else still publishes ---------------------------------------------------------------------
const entry = (await asUser(B, `insert into public.drafts (game_id, block_key, kind, title, content, author_id)
  values ('fw', 'units', 'fact', 'Wren', '{"name":"Wren","sections":[],"categories":{}}', '${B}') returning id`)).rows[0].id;
await ship(entry);
(await status(entry)).status === 'stable' ? ok('a new entry still publishes') : bad('entry not published');
