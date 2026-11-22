// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedSettings, gameSettingsOf, routeKey, settingsChanges, settingsContent, settingsOfRow, type GameSettings } from './game-settings.ts';

const row = { title: 'Hollow Spire', short_title: 'Spire', platform: 'PC', release_date: '2027-02-01', genre: 'Metroidvania', shade: 'fantasy', cover: null, paths: null };
const was = settingsOfRow(row);

test('a row becomes settings, and only what changed is sent, with what it was', () => {
  assert.equal(was.shortTitle, 'Spire');
  const now: GameSettings = { ...was, platform: 'PC and Switch 2', shade: 'openworld' };
  assert.deepEqual(changedSettings(was, now), { platform: 'PC and Switch 2', shade: 'openworld' });
  const c = settingsContent(was, now);
  assert.deepEqual(c.before, { platform: 'PC', shade: 'fantasy' });
  assert.equal(c.name, 'New settings for Spire');
  assert.ok(gameSettingsOf(c));
  assert.equal(gameSettingsOf({ name: 'Wren', sections: [] }), null);
  assert.equal(gameSettingsOf({ game: {} }), null);
});

test('what a Draft changes, in words', () => {
  assert.deepEqual(settingsChanges(was, { platform: 'Switch 2', releaseDate: '2027-03-15', shade: 'cozy', cover: 'spire/a/b.webp' }),
    ['Played on Switch 2', 'Comes out March 15, 2027', 'Look: Cozy', 'Adds a cover picture']);
  const paths = { question: 'Which knight?', options: [{ key: 'ash', label: 'Ash', note: '' }, { key: 'iris', label: 'Iris', note: '' }] };
  assert.deepEqual(settingsChanges({ paths: null }, { paths }), ['Routes: "Which knight?" Ash, Iris']);
  assert.deepEqual(settingsChanges({ paths }, { paths: { question: 'Which knight are you?', options: [{ key: 'ash', label: 'Ash the Bold', note: '' }, paths.options[1], { key: 'rook', label: 'Rook', note: '' }] } }),
    ['The route question: "Which knight are you?"', 'Renames the route Ash to Ash the Bold', 'Adds the route Rook']);
});

test("a new route's key is plain and never one already there", () => {
  assert.equal(routeKey('Ash the Bold', []), 'ash-the-bold');
  assert.equal(routeKey('Ash', ['ash']), 'ash-2');
  assert.equal(routeKey('!!!', []), 'route');
});
