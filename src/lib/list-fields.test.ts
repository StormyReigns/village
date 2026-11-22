// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKLIST_FIELDS, DEADLINE, extraFields, fieldForm, fieldsOf, groupField, hasFieldSetup, rowFields } from './fields.ts';
import type { FieldDef } from '../data/pages/types.ts';

test('a Checklist or Timeline with no Set up is exactly as before', () => {
  assert.deepEqual(extraFields({ type: 'checklist' }), []);
  assert.deepEqual(rowFields({ type: 'checklist' }), []);
  assert.equal(groupField({ type: 'checklist' }), undefined);
  assert.equal(fieldForm({ type: 'checklist' }), false);
  assert.equal(fieldForm({ type: 'characters' }), true);
  assert.ok(hasFieldSetup({ type: 'timeline' }) && !hasFieldSetup({ type: 'collection' }));
});

test('the deadline keeps the key Last chances already use', () => {
  assert.equal(fieldsOf({ type: 'checklist' })[0].key, DEADLINE);
  assert.equal(DEADLINE, 'Before');
});

test('a row shows two fields at most, never a spoiler, the deadline or the description', () => {
  const fields: FieldDef[] = [
    ...CHECKLIST_FIELDS.map((f) => ({ ...f, off: undefined, tile: true })),
    { key: 'Night', label: 'Night only', kind: 'yesno', tile: true },
    { key: 'Secret', label: 'Secret', kind: 'text', tile: true, spoiler: true },
  ];
  const row = rowFields({ type: 'checklist', fields }).map((f) => f.key);
  assert.deepEqual(row, ['Where', 'How to get it']);
  assert.ok(!extraFields({ type: 'checklist', fields }).some((f) => f.key === DEADLINE || f.key === '@description'));
});

test('a list groups by a switched-on place or tag only', () => {
  const where: FieldDef = { key: 'Where', label: 'Where', kind: 'place', group: true };
  assert.equal(groupField({ type: 'checklist', fields: [where] })?.key, 'Where');
  assert.equal(groupField({ type: 'checklist', fields: [{ ...where, off: true }] }), undefined);
  assert.equal(groupField({ type: 'checklist', fields: [{ ...where, kind: 'list' }] }), undefined);
  assert.equal(fieldForm({ type: 'checklist', fields: [where] }), true);
});
