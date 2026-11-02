// Run with: npm test
// Characters must stay exactly as they were when Items joined the fields model (2026-11-02):
// the snapshot holds what fieldsOf, withCommon and johnDoe gave for Characters Blocks then.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGES } from '../data/pages/fortunes-weave.ts';
import { FIELD_KINDS, fieldsOf, johnDoe, shownFields, withCommon } from './fields.ts';

const before = JSON.parse(readFileSync(new URL('./fields-characters.snapshot.json', import.meta.url), 'utf8'));
const units = PAGES.flatMap((p) => p.blocks).find((b) => b.id === 'units')!;
const bare = { fields: undefined, stats: [{ key: 'hp', label: 'HP', better: 'high' as const }] };
const plain = <T,>(v: T) => JSON.parse(JSON.stringify(v));

test('Characters fields are unchanged by Items', () => {
  assert.deepEqual(plain(fieldsOf(bare)), before.fieldsOfBare);
  assert.deepEqual(plain(fieldsOf(units)), before.fieldsOfUnits);
  assert.deepEqual(plain(withCommon(fieldsOf(units))), before.withCommonUnits);
  assert.deepEqual(plain(withCommon([])), before.withCommonEmpty);
  assert.deepEqual(plain(shownFields(units).map((f) => f.key)), before.shownUnits);
  assert.deepEqual(plain(FIELD_KINDS), before.kinds);
});

test('John Doe is unchanged by Items', () => {
  assert.deepEqual(plain(johnDoe(bare)), before.johnDoeBare);
  assert.deepEqual(plain(johnDoe(units)), before.johnDoeUnits);
});
