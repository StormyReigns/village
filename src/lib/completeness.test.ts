// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeness, needsFor } from './completeness.ts';
import { DESCRIPTION, ITEM_FIELDS, GUIDE_FIELDS, COMMON_FIELDS } from './fields.ts';
import type { Block, Entry } from '../data/pages/types.ts';

const e = (id: string, more: Partial<Entry> = {}): Entry => ({ id, name: id, sections: [], categories: {}, ...more });
const sec = (o: Record<string, string>) => Object.entries(o).map(([label, text]) => ({ label, text }));

test('items need what they do and where to get them, not rare fields like Made from', () => {
  const block: Block = { id: 'items', type: 'items', title: 'Items', icon: 'Backpack', fields: ITEM_FIELDS, entries: [
    e('potion', { sections: sec({ 'What it does': 'Heals', 'Where to get it': 'Shop' }) }),
    e('herb', { sections: sec({ 'What it does': 'Crafting' }) }),
    e('ore', { sections: sec({ 'Made from': 'Rock: 2' }) }),
  ] };
  assert.deepEqual(needsFor(block).map((n) => n.label), ['What it does', 'Where to get it']);
  const c = completeness(block);
  assert.equal(c.done, 1);
  assert.deepEqual(c.missing.get('herb'), ['Where to get it']);
  assert.deepEqual(c.missing.get('ore'), ['What it does', 'Where to get it']);
});

test('a guide needs Steps or a Write-up, either one', () => {
  const block: Block = { id: 'how', type: 'guide', title: 'How to', icon: 'BookOpen', fields: GUIDE_FIELDS, entries: [
    e('steps', { description: 'Short', sections: sec({ Steps: 'Do this' }) }),
    e('writeup', { description: 'Short', sections: sec({ 'Write-up': 'Words' }) }),
    e('bare', { description: 'Short' }),
  ] };
  assert.ok(needsFor(block).some((n) => n.label === 'Steps or Write-up'));
  const c = completeness(block);
  assert.equal(c.done, 2);
  assert.deepEqual(c.missing.get('bare'), ['Steps or Write-up']);
});

test('a field most entries have counts too, and one few have does not', () => {
  const base = { sections: sec({ 'How to recruit': 'Talk to them' }), description: 'Who' };
  const entries = ['a', 'b', 'c', 'd', 'e'].map((id, i) => e(id, { ...base, categories: i < 4 ? { 'Role or class': 'Knight' } : {}, ...(i === 0 ? { sections: [...base.sections, ...sec({ Birthday: 'Spring' })] } : {}) }));
  const block: Block = { id: 'units', type: 'characters', title: 'Units', icon: 'Users', fields: [...COMMON_FIELDS, { key: 'Birthday', label: 'Birthday', kind: 'text' }], entries };
  const labels = needsFor(block).map((n) => n.label);
  assert.ok(labels.includes('Role or class'), 'four of five have a role');
  assert.ok(!labels.includes('Birthday'), 'one of five has a birthday');
  assert.deepEqual(completeness(block).missing.get('e'), ['Role or class']);
});

test('checklists need a description, collections a description or any section, and headers are not counted', () => {
  const list: Block = { id: 'l', type: 'checklist', title: 'Last chances', icon: 'Hourglass', entries: [e('x', { description: 'Before chapter 5' }), e('y')] };
  assert.deepEqual(completeness(list), { done: 1, total: 2, missing: new Map([['x', []], ['y', ['A description']]]) });
  const places: Block = { id: 'p', type: 'collection', title: 'Places', icon: 'MapPin', entries: [e('cave', { sections: sec({ Loot: 'Gold' }) }), e('band', { header: true })] };
  assert.equal(completeness(places).total, 1);
  assert.equal(completeness(places).done, 1);
  assert.equal(DESCRIPTION, '@description');
});
