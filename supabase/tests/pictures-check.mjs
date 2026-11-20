// Checks profile pictures (20261125000000_profile_pictures.sql) on an in-memory Postgres with the
// same Supabase-like stubs as remove-check.mjs: what a picture can point at, who can change it,
// and a moderator taking one down. (The test database has no storage, so the bucket isn't here.)
// Usage: node supabase/tests/pictures-check.mjs supabase/migrations
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
await db.exec(readFileSync(join(process.argv[2], files.find((f) => f.includes('profile_pictures'))), 'utf8'));
ok('migrations applied, and the pictures SQL runs twice');

const MOD = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222', B = '33333333-3333-3333-3333-333333333333';
await db.exec(`
  insert into auth.users (id) values ('${MOD}'), ('${A}'), ('${B}');
  insert into public.games (id, title, status, preset) values ('fw', 'Fortune''s Weave', 'live', 'tactics-rpg');
  insert into public.moderators (profile_id, game_id) values ('${MOD}', 'fw');
`);
const asUser = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const works = async (uid, sql, label) => { try { await asUser(uid, sql); ok(label); } catch (e) { bad(`${label}: ${e.message}`); } };
const refused = async (uid, sql, label) => { try { await asUser(uid, sql); bad(label + ' (it went through)'); } catch { ok(label + ' (refused)'); } };
const pictureOf = async (who) => (await db.query(`select picture from public.profiles where id = '${who}'`)).rows[0].picture;
const FILE = `${A}/0f8fad5b-d9cb-469f-a165-70867728950e.webp`;

await works(A, `update public.profiles set picture = '${FILE}' where id = '${A}'`, 'you can set a picture you uploaded to your own folder');
await works(A, `update public.profiles set picture = 'none' where id = '${A}'`, 'you can remove your picture');
await works(A, `update public.profiles set picture = null where id = '${A}'`, 'you can go back to your Discord picture');
await refused(A, `update public.profiles set picture = 'https://example.com/me.png' where id = '${A}'`, 'a picture can’t point at another site');
await refused(A, `update public.profiles set picture = '${B}/0f8fad5b-d9cb-469f-a165-70867728950e.webp' where id = '${A}'`, 'a picture can’t point into someone else’s folder');
await refused(A, `update public.profiles set picture = '${A}/../x.webp' where id = '${A}'`, 'a picture path can’t climb out of your folder');
await asUser(B, `update public.profiles set picture = 'none' where id = '${A}'`);
(await pictureOf(A)) === null ? ok('you can’t change someone else’s picture') : bad('B changed A’s picture');
await refused(A, `update public.profiles set avatar_url = 'https://example.com/x.png' where id = '${A}'`, 'the Discord picture can’t be rewritten by hand');

// Taking one down
await asUser(A, `update public.profiles set picture = '${FILE}' where id = '${A}'`);
await refused(B, `select public.remove_picture('${A}', 'I just don''t like it')`, 'only moderators take pictures down');
await refused(MOD, `select public.remove_picture('${A}', '')`, 'a takedown needs a reason');
await works(MOD, `select public.remove_picture('${A}', 'Not suitable for everyone')`, 'a moderator can take a picture down');
(await pictureOf(A)) === 'none' ? ok('the picture is gone, initials show') : bad('picture is ' + (await pictureOf(A)));
const note = (await db.query(`select type, payload from public.inbox where profile_id = '${A}'`)).rows;
note.length === 1 && note[0].type === 'picture_removed' && note[0].payload.reason === 'Not suitable for everyone'
  ? ok('the person hears why in their inbox') : bad('inbox ' + JSON.stringify(note));
await works(A, `update public.profiles set picture = '${FILE}' where id = '${A}'`, 'they can upload another afterwards');
