// Checks game settings as Drafts (20261204000000_game_settings.sql) on an in-memory Postgres with the same
// Supabase-like stubs as launch-check.mjs: anyone suggests, the game's moderators publish, what was typed is checked,
// routes the game has stay, a cover is only an upload for this game, and a setting changed since isn't overwritten.
// Usage: node supabase/tests/game-settings-check.mjs supabase/migrations
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
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('game_settings'))), 'utf8'));
ok('migrations applied, and the game settings SQL runs twice');

const STARTER = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', FWMOD = '77777777-7777-7777-7777-777777777777';
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await db.exec(`
  insert into auth.users (id) values ('${STARTER}'), ('${B}'), ('${FWMOD}');
  insert into public.moderators (profile_id, game_id) values ('${FWMOD}', 'fortunes-weave');
`);
const as = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const fails = async (uid, sql, label, word) => {
  try { await as(uid, sql); bad(label + ' (it went through)'); }
  catch (e) { !word || e.message.includes(word) ? ok(label + ' (refused)') : bad(`${label}: wrong reason "${e.message}"`); }
};
const q = (s) => `'${JSON.stringify(s).replace(/'/g, "''")}'`;
const row = async (id) => (await db.query(`select title, short_title, platform, release_date::text as release_date, genre, shade, cover, paths from public.games where id = '${id}'`)).rows[0];
const before = async (id) => { const r = await row(id); return { title: r.title, shortTitle: r.short_title, platform: r.platform, releaseDate: r.release_date, genre: r.genre, shade: r.shade, cover: r.cover, paths: r.paths }; };
const send = async (id, game, { who = B, was } = {}) => {
  const all = was ?? (await before(id));
  const bef = Object.fromEntries(Object.keys(game).map((k) => [k, all[k] ?? null]));
  return (await as(who, `insert into public.drafts (game_id, block_key, kind, title, content, author_id, action)
    values ('${id}', '@game', 'opinion', 'New settings', ${q({ name: 'New settings', sections: [], categories: {}, game, before: bef })}::jsonb, '${who}', 'game') returning id`)).rows[0].id;
};
const status = async (id) => (await db.query(`select status from public.drafts where id = '${id}'`)).rows[0].status;

const spire = (await as(STARTER, `select public.start_game('Hollow Spire', 'Spire', 'PC', '2027-02-01'::date, 'Metroidvania', 'fantasy') as id`)).rows[0].id;

// Suggesting and publishing ----------------------------------------------------------------------------------
const first = await send(spire, { platform: 'PC and Switch 2', releaseDate: '2027-03-15', shade: 'openworld', cover: `${spire}/${B}/${U}.webp`,
  paths: { question: 'Which knight are you?', options: [{ key: 'ash', label: 'Ash', note: '' }, { key: 'iris', label: 'Iris', note: 'The second knight' }] } });
await fails(B, `select public.ship_draft('${first}')`, 'only its moderators publish it', 'moderators');
await as(STARTER, `select public.ship_draft('${first}')`);
const r = await row(spire);
r.platform === 'PC and Switch 2' && r.release_date === '2027-03-15' && r.shade === 'openworld' && r.cover === `${spire}/${B}/${U}.webp` && r.paths.options.length === 2
  ? ok("its starter publishes it: the game's settings change") : bad('row ' + JSON.stringify(r));
(await status(first)) === 'stable' ? ok('and the Draft is published') : bad('status');
const note = (await db.query(`select body from public.chat_messages where linked_draft_id = '${first}'`)).rows[0];
note?.body === 'New settings is now in the app.' ? ok('the Workshop chat says so') : bad('note ' + JSON.stringify(note));

// Nothing changed since is overwritten -----------------------------------------------------------------------
const was = await before(spire);
const a = await send(spire, { genre: 'Action' }, { was });
const b = await send(spire, { genre: 'Puzzle' }, { was });
await as(STARTER, `select public.ship_draft('${a}')`);
await fails(STARTER, `select public.ship_draft('${b}')`, 'a second Draft from the same starting point, once the first is in', 'changed since');

// What was typed is checked ---------------------------------------------------------------------------------
const refused = async (game, label, word, opts) => {
  const keep = JSON.stringify(await row(spire));
  const id = await send(spire, game, opts);
  await fails(STARTER, `select public.ship_draft('${id}')`, label, word);
  JSON.stringify(await row(spire)) === keep ? null : bad(label + ': the game changed');
};
await refused({ title: 'X' }, 'a name of one letter', 'name');
await refused({ shortTitle: '' }, 'an empty short name', 'short name');
await refused({ releaseDate: '2099-01-01' }, 'a date far ahead', 'release date');
await refused({ releaseDate: 'soon' }, 'a date that is not a date', 'release date');
await refused({ shade: 'neon' }, 'a look that is not ours', 'look');
await refused({ title: "Fire Emblem: Fortune's Weave" }, "another game's name", 'another game');
await refused({ status: 'live' }, "the status can't be set this way (launching is votes)", "can't be changed");
await refused({ cover: 'https://example.com/x.png' }, 'a web address is never a cover', "isn't one of ours");
await refused({ cover: `fortunes-weave/${B}/${U}.webp` }, "another game's upload is never a cover", "isn't one of ours");
await refused({ cover: `${spire}/${FWMOD}/${U}.webp` }, "someone else's upload is never a cover", 'someone else');
await refused({ paths: { question: 'Which knight?', options: [{ key: 'ash', label: 'Ash', note: '' }, { key: 'rook', label: 'Rook', note: '' }] } },
  'a route the game has stays (entries depend on it)', 'stays');
await refused({ paths: null }, "routes can't be taken away", "can't be taken away");
await refused({ paths: { question: 'Which?', options: [{ key: 'ash', label: 'Ash' }] } }, 'one choice is not routes', '2 to 8');
const renamed = await send(spire, { paths: { question: 'Which knight are you playing?', options: [{ key: 'ash', label: 'Ash the Bold', note: '' }, { key: 'iris', label: 'Iris', note: '' }, { key: 'rook', label: 'Rook', note: '' }] } });
await as(STARTER, `select public.ship_draft('${renamed}')`);
(await row(spire)).paths.options.length === 3 ? ok('routes can be renamed, and new ones added') : bad('renamed');
const nocover = await send(spire, { cover: null });
await as(STARTER, `select public.ship_draft('${nocover}')`);
(await row(spire)).cover === null ? ok('a cover can be taken away (the tile shows its piece)') : bad('no cover');

// Another game's moderator, and the action rules ----------------------------------------------------------------
const elsewhere = await send(spire, { genre: 'RPG' });
await fails(FWMOD, `select public.ship_draft('${elsewhere}')`, "a moderator of another game can't publish it", 'moderators');
await fails(B, `insert into public.drafts (game_id, block_key, kind, title, content, author_id, action)
  values ('${spire}', 'units', 'opinion', 'Odd', '{}'::jsonb, '${B}', 'game')`, "a game settings Draft can't name a Block", 'drafts_action_check');
