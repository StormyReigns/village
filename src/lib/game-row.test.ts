// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameFromRow } from './game-row.ts';
import { STARTER_GAMES } from '../data/games.ts';

const fw = STARTER_GAMES.find((g) => g.id === 'fortunes-weave')!;

test('before the new columns exist, a starter game is exactly as games.ts has it', () => {
  const row = { id: 'fortunes-weave', title: fw.title, platform: fw.platform, release_date: fw.releaseDate, status: 'live', preset: 'tactics-rpg' };
  assert.deepEqual(JSON.parse(JSON.stringify(gameFromRow(row, fw))), JSON.parse(JSON.stringify(fw)));
});

test('after 20261130000000, the row is the same game', () => {
  const row = {
    id: 'fortunes-weave', title: fw.title, platform: fw.platform, release_date: fw.releaseDate, status: 'live',
    short_title: fw.shortTitle, genre: fw.genre, shade: fw.shade, hue: fw.hue, next: fw.next, popularity: fw.popularity,
    paths: fw.paths, moved_pages: fw.movedPages, cover: null,
  };
  assert.deepEqual(JSON.parse(JSON.stringify(gameFromRow(row, fw))), JSON.parse(JSON.stringify(fw)));
});

test('a game the database has and games.ts does not (started by a Builder) stands on its own', () => {
  const g = gameFromRow({ id: 'hollow-spire', title: 'Hollow Spire', short_title: 'Spire', platform: 'PC', release_date: '2027-02-01', status: 'prelaunch', genre: 'Metroidvania', shade: 'fantasy', hue: 'sky' });
  assert.equal(g?.shortTitle, 'Spire');
  assert.equal(g?.shade, 'fantasy');
  assert.equal(g?.paths, undefined);
  assert.equal(g?.popularity, 100);
});

test("what isn't ours falls back, and a game being built or archived isn't shown", () => {
  const odd = gameFromRow({ id: 'fortunes-weave', title: fw.title, status: 'live', shade: 'neon', hue: 'pink', cover: 'https://evil.example/x.png',
    paths: { question: 'Which?', options: [{ key: 'Bad Key', label: 'A' }] }, moved_pages: { 'Old Page': 'units' } }, fw);
  assert.equal(odd?.shade, fw.shade);
  assert.equal(odd?.hue, fw.hue);
  assert.equal(odd?.cover, fw.cover);
  assert.deepEqual(odd?.paths, fw.paths);
  assert.deepEqual(odd?.movedPages, fw.movedPages);
  assert.equal(gameFromRow({ id: 'x', title: 'X', status: 'draft' }), null);
  assert.equal(gameFromRow({ id: 'x', title: 'X', status: 'archived' }), null);
  assert.equal(gameFromRow({ id: 'x', status: 'live' }), null);
});
