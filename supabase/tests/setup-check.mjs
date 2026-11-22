// Checks suggesting a Block's setup as a Draft (20261127000000_setup_drafts.sql) on an in-memory Postgres
// with the same Supabase-like stubs as structure-check.mjs: Set up's fields, a Planner's setup and a map
// picture, sent by anyone and published by a moderator; what's checked in what a player typed; that a
// setup which changed since the Draft was sent isn't overwritten; and that nothing reaches into another game.
// Usage: node supabase/tests/setup-check.mjs supabase/migrations
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
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('setup_drafts'))), 'utf8'));
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('list_setups'))), 'utf8'));
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('block_type_drafts'))), 'utf8'));
ok('migrations applied, and the setup Drafts SQL runs twice (re-running it after 20261128000000 too, so that comes again)');

const B = '22222222-2222-2222-2222-222222222222', C = '44444444-4444-4444-4444-444444444444', FWMOD = '77777777-7777-7777-7777-777777777777';
const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values ('${B}', '{"full_name":"Mira"}'), ('${C}', '{}'), ('${FWMOD}', '{}');
  insert into public.games (id, title, status, preset) values ('fw', 'Fortune''s Weave', 'live', 'tactics-rpg'), ('oot', 'Ocarina of Time', 'live', 'tactics-rpg');
  insert into public.moderators (profile_id, game_id) values ('${FWMOD}', 'fw');
  insert into public.app_pages (game_id, page_key, title, short, icon, tint, blurb, position) values
    ('fw', 'units', 'Units', 'Units', 'Users', 'berry', '', 0), ('oot', 'items', 'Items', 'Items', 'Backpack', 'sun', '', 0);
  insert into public.game_blocks (game_id, block_key, title, page_key, type, position, look) values
    ('fw', 'units', 'Units', 'units', 'characters', 0, null), ('fw', 'classes', 'Classes', 'units', 'classes', 1, null),
    ('fw', 'gear', 'Gear', 'units', 'items', 2, null), ('fw', 'party', 'Party', 'units', 'planner', 3, null),
    ('fw', 'places', 'Places', 'units', 'collection', 4, 'map'), ('oot', 'items', 'Items', 'items', 'items', 0, null),
    ('fw', 'chances', 'Last chances', 'units', 'checklist', 5, null), ('fw', 'story', 'Story', 'units', 'timeline', 6, null),
    ('fw', 'foes', 'Foes', 'units', 'collection', 7, 'rows');
  update public.game_blocks set fields = '[{"key":"Kind","label":"Kind","kind":"tag"}]', stats = '[{"key":"hp","label":"HP","better":"high"}]'
  where game_id = 'fw' and block_key = 'units';
  update public.game_blocks set plan_setup = '{"roster":"units"}' where game_id = 'fw' and block_key = 'party';
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
const block = async (key, game = 'fw') => (await db.query(`select fields, stats, plan_setup, map from public.game_blocks where game_id = '${game}' and block_key = '${key}'`)).rows[0];
/** The Block's setup now, as the Workshop sends it in "before". */
const before = async (key, game = 'fw') => {
  const b = await block(key, game);
  return { fields: b.fields, stats: b.stats, plan: b.plan_setup, map: b.map };
};
const send = async (key, setup, { game = 'fw', who = B, title = `New setup for ${key}`, was } = {}) => {
  const bef = was ?? (await before(key, game));
  return (await asUser(who, `insert into public.drafts (game_id, block_key, kind, title, content, author_id, action)
    values ('${game}', '${key}', 'opinion', '${title}', ${q({ name: title, sections: [], categories: {}, setup, before: bef })}::jsonb, '${who}', 'setup') returning id`)).rows[0].id;
};
const ship = (id) => asUser(FWMOD, `select public.ship_draft('${id}')`);
const status = async (id) => (await db.query(`select status from public.drafts where id = '${id}'`)).rows[0].status;

// Set up: a Block's fields and stats ---------------------------------------------------------------
const FIELDS = [
  { key: 'Kind', label: 'Type', kind: 'tag', choices: [{ name: 'Boss' }, { name: 'Regular', about: 'Most foes' }] },
  { key: 'Weakness', label: 'Weakness', kind: 'list' },
  { key: 'Where', label: 'Where', kind: 'links', to: 'places' },
  { key: '@stats', label: 'Stats', kind: 'chart' },
];
const STATS = [{ key: 'hp', label: 'HP', better: 'high' }, { key: 'def', label: 'Def', better: 'high' }];
const setup = await send('units', { fields: FIELDS, stats: STATS });
setup ? ok('anyone signed in can suggest a setup') : bad('no setup Draft');
await expectFail(B, `select public.ship_draft('${setup}')`, 'only moderators publish it', 'moderators');
await ship(setup);
const u = await block('units');
u.fields.length === 4 && u.fields[0].label === 'Type' && u.fields[2].to === 'places' && u.stats.length === 2
  ? ok('publishing writes the fields and stats onto the Block') : bad('units ' + JSON.stringify(u));
(await status(setup)) === 'stable' ? ok('and the Draft is published') : bad('setup status');
const note = (await db.query(`select body, block_key from public.chat_messages where linked_draft_id = '${setup}'`)).rows[0];
note?.body === 'New setup for units is now in the app.' && note.block_key === 'units' ? ok('the Workshop chat says so, on its Page') : bad('note ' + JSON.stringify(note));
await expectFail(FWMOD, `select public.ship_draft('${setup}')`, 'it is published only once', 'already been decided');

// A setup that changed since it was sent isn't overwritten -------------------------------------------
const was = await before('units');
const first = await send('units', { fields: FIELDS.slice(0, 2), stats: null }, { was });
const second = await send('units', { fields: FIELDS.slice(0, 3), stats: STATS }, { was, who: C });
await ship(first);
const u2 = await block('units');
u2.fields.length === 2 && u2.stats === null ? ok('no stats clears them') : bad('first ' + JSON.stringify(u2));
await expectFail(FWMOD, `select public.ship_draft('${second}')`, 'a second setup sent from the same starting point is refused once the first is in', 'changed since');
(await status(second)) === 'open' ? ok('and it stays open, for its author to send again') : bad('second status');

// What a player typed is checked ----------------------------------------------------------------------
const refused = async (key, s, label, word, opts) => {
  const keep = JSON.stringify(await block(key, opts?.game));
  const id = await send(key, s, opts);
  await expectFail(FWMOD, `select public.ship_draft('${id}')`, label, word);
  (await status(id)) === 'open' ? null : bad(label + ': the Draft changed');
  JSON.stringify(await block(key, opts?.game)) === keep ? null : bad(label + ': the Block changed');
};
const many = Array.from({ length: 61 }, (_, i) => ({ key: `F${i}`, label: `F${i}`, kind: 'text' }));
await refused('units', { fields: many }, 'a Block has 60 fields at most', '60 fields');
await refused('units', { fields: [{ key: 'A', label: 'A', kind: 'text' }, { key: 'a', label: 'Again', kind: 'text' }] }, 'no two fields the same', 'same name');
await refused('units', { fields: [{ key: 'A', label: 'A', kind: 'script' }] }, 'only kinds we know', 'kind');
await refused('units', { fields: [{ key: 'A', label: '  ', kind: 'text' }] }, 'every field needs a name', 'name');
await refused('units', { fields: [{ key: 'A', label: 'x'.repeat(61), kind: 'text' }] }, 'a field name is 60 characters at most', 'name');
await refused('units', { fields: [{ key: 'L', label: 'Links', kind: 'links', to: 'items' }] }, "a links field can't point into another game", 'Block that isn');
await refused('units', { fields: [{ key: 'T', label: 'Tier', kind: 'tag', choices: Array.from({ length: 61 }, (_, i) => ({ name: `c${i}` })) }] }, 'a list of choices is capped', 'choices');
await refused('units', { fields: [{ key: '@stats', label: 'Stats', kind: 'chart' }], stats: [{ key: 'hp', label: 'HP', better: 'sideways' }] }, 'every stat says which way is better', 'stat');
await refused('units', { fields: 'lots' }, 'fields are a list', '60 fields');
await refused('party', { fields: FIELDS }, "a Planner isn't set up by fields", 'set up by fields');
await refused('units', {}, 'a Draft with no setup in it', 'no setup');

// A Planner's setup: rebuilt, clamped, and checked ------------------------------------------------------
const plan = await send('party', { plan: {
  roster: 'units', size: 1e12, classes: 'classes', unlock: ['Recruit', '@description', 'Recruit'], extra: '<x>',
  slots: [{ key: 'weapon', label: ' Weapon ', from: 'gear', count: 99, tag: { key: 'Type', values: ['Sword', 'Lance', 'Sword'] }, junk: 1 }],
} });
await ship(plan);
const pl = (await block('party')).plan_setup;
JSON.stringify(pl) === JSON.stringify({ size: 100, slots: [{ key: 'weapon', tag: { key: 'Type', values: ['Sword', 'Lance'] }, from: 'gear', count: 10, label: 'Weapon' }], roster: 'units', unlock: ['Recruit', '@description'], classes: 'classes' })
  ? ok('a Planner keeps only what it uses: size and counts clamped, lists in order without repeats') : bad('plan ' + JSON.stringify(pl));
await refused('party', { plan: { roster: 'classes' } }, 'a party comes from a Characters Block', 'Characters Block');
await refused('party', { plan: { roster: 'units', classes: 'gear' } }, 'class steps come from a Classes Block', 'Classes Block');
await refused('party', { plan: { roster: 'units', slots: [{ key: 'w', label: 'Weapon', from: 'units' }] } }, 'gear comes from an Items Block', 'Items Block');
await refused('party', { plan: { roster: 'units', slots: [{ key: 'w', label: 'Weapon', from: 'items' }] } }, "gear can't come from another game", 'Items Block');
await refused('party', { plan: { roster: 'units', slots: [{ key: 'Bad Key', label: 'Weapon', from: 'gear' }] } }, 'a gear slot has a plain key', 'gear slot');
await refused('units', { plan: { roster: 'units' } }, 'only a Planner takes a Planner setup', 'Planner');

// A map picture -----------------------------------------------------------------------------------------
const pic = (game, who) => `${game}/${who}/${U1}.webp`;
const map = await send('places', { map: { picture: pic('fw', B), w: 2400.4, h: 1e9, credit: '  Map:   Game8  ', extra: 1 } });
await ship(map);
const mp = (await block('places')).map;
JSON.stringify(mp) === JSON.stringify({ h: 20000, w: 2400, credit: 'Map: Game8', picture: pic('fw', B) })
  ? ok("a Builder's own upload becomes the map, sizes and credit tidied") : bad('map ' + JSON.stringify(mp));
const modPic = await send('places', { map: { picture: pic('fw', FWMOD), w: 100, h: 100 } }, { who: C });
await ship(modPic);
(await block('places')).map.picture === pic('fw', FWMOD) ? ok("a moderator's upload can be suggested too") : bad('mod picture');
await refused('places', { map: { picture: pic('fw', C), w: 100, h: 100 } }, "someone else's upload can't be suggested", 'someone else');
await refused('places', { map: { picture: pic('oot', B), w: 100, h: 100 } }, "another game's picture can't be used", 'isn');
await refused('places', { map: { picture: 'https://example.com/map.png', w: 100, h: 100 } }, 'a web address is never a map picture', 'isn');
await refused('places', { map: { picture: pic('fw', B), w: 'big', h: 100 } }, 'a map needs its size', 'size');
await refused('units', { map: { picture: pic('fw', B), w: 100, h: 100 } }, 'only a map Block takes a map', 'no map');

// Checklists and Timelines take a Set up too (20261128000000) -----------------------------------------------
const lc = await send('chances', { fields: [{ key: 'Before', label: 'Deadline', kind: 'when' }, { key: 'Where', label: 'Where', kind: 'place', tile: true, group: true }] });
await ship(lc);
(await block('chances')).fields?.[1]?.group === true ? ok("a Checklist's fields publish, with its row and group choices") : bad('checklist ' + JSON.stringify(await block('chances')));
const tl = await send('story', { fields: [{ key: 'Boss', label: 'Boss', kind: 'text' }] });
await ship(tl);
(await block('story')).fields?.[0]?.key === 'Boss' ? ok("and a Timeline's") : bad('timeline');
await refused('places', { fields: [{ key: 'A', label: 'A', kind: 'text' }] }, "a Collection still isn't set up by fields", 'set up by fields');

// An empty Block changes its type (20261129000000) ---------------------------------------------------------
const retype = await send('foes', { type: 'characters' }, { was: { type: 'collection' } });
await ship(retype);
const fo = (await db.query(`select type, look, filters, fields from public.game_blocks where game_id = 'fw' and block_key = 'foes'`)).rows[0];
fo.type === 'characters' && fo.look === null && fo.filters[0] === 'Role or class' && fo.fields === null
  ? ok('an empty Collection becomes a Characters Block, with its usual filter and no old look') : bad('retype ' + JSON.stringify(fo));
(await status(retype)) === 'stable' ? ok('and the Draft is published') : bad('retype status');
await refused('foes', { type: 'items' }, 'a type sent from an older type is refused', 'changed since', { was: { type: 'collection' } });
await refused('foes', { type: 'characters' }, 'the same type again', 'already', { was: { type: 'characters' } });
await refused('foes', { type: 'items', fields: [] }, 'a type changes on its own, before its Set up', 'on its own', { was: { type: 'characters' } });
await refused('foes', { type: 'tierlist' }, "a Block can't become a Tier list this way", "can't be chosen", { was: { type: 'characters' } });
await refused('foes', { type: 'collection' }, "nor go back to a Collection", "can't be chosen", { was: { type: 'characters' } });
await refused('party', { type: 'characters' }, "a Planner's type can't change", 'Planner', { was: { type: 'planner' } });
await refused('places', { type: 'characters' }, 'a map Block keeps its type', 'map Block', { was: { type: 'collection' } });
await refused('units', { type: 'items' }, 'a Block a Planner picks from keeps its type', 'uses', { was: { type: 'characters' } });
const cls = (await asUser(B, `insert into public.drafts (game_id, block_key, kind, title, content, author_id)
  values ('fw', 'classes', 'fact', 'Knight', '{"name":"Knight","sections":[],"categories":{}}', '${B}') returning id`)).rows[0].id;
await ship(cls);
await refused('classes', { type: 'items' }, 'a Block with entries in the app keeps its type', 'has entries', { was: { type: 'classes' } });

// Another game's moderator, and the action rules ----------------------------------------------------------
const elsewhere = await send('items', { fields: [{ key: 'A', label: 'A', kind: 'text' }] }, { game: 'oot' });
await expectFail(FWMOD, `select public.ship_draft('${elsewhere}')`, "a moderator of one game can't publish into another", 'moderators');
const CARD = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into public.cards (id, game_id, block_key, slug) values ('${CARD}', 'fw', 'units', 'wren')`);
await expectFail(B, `insert into public.drafts (game_id, block_key, card_id, kind, title, content, author_id, action)
  values ('fw', 'units', '${CARD}', 'opinion', 'Odd one', '{}'::jsonb, '${B}', 'setup')`, "a setup Draft can't name an entry", 'drafts_action_check');
const gone = await send('units', { fields: FIELDS.slice(0, 1) });
await db.exec(`delete from public.game_blocks where game_id = 'fw' and block_key = 'units'`);
await expectFail(FWMOD, `select public.ship_draft('${gone}')`, 'a setup for a Block that has gone', "isn't in the app");

// Everything else still publishes -------------------------------------------------------------------------
const entry = (await asUser(B, `insert into public.drafts (game_id, block_key, kind, title, content, author_id)
  values ('fw', 'gear', 'fact', 'Sword', '{"name":"Sword","sections":[],"categories":{}}', '${B}') returning id`)).rows[0].id;
await ship(entry);
(await status(entry)) === 'stable' ? ok('a new entry still publishes') : bad('entry not published');
const nb = (await asUser(B, `insert into public.drafts (game_id, block_key, kind, title, content, author_id, action)
  values ('fw', 'tiers', 'opinion', 'Tiers on Units', ${q({ name: 'Tiers', sections: [], categories: {}, pageKey: 'units', block: { title: 'Tiers', type: 'items', icon: 'Trophy' } })}::jsonb, '${B}', 'add_block') returning id`)).rows[0].id;
await ship(nb);
(await status(nb)) === 'stable' ? ok('a new Block still publishes') : bad('block not published');
