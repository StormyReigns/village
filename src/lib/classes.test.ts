// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { examLine, needsOf, stepsAround, tierOrder } from './classes.ts';
import { classEntries } from '../data/pages/fortunes-weave-classes.ts';
import type { EntryContent } from '../data/pages/types.ts';

const cls = (name: string, tier: string, exam: string): EntryContent => ({ name, categories: { Tier: tier }, sections: [{ label: 'Exam needs', text: exam }] });
const head = (tier: string, order: number): EntryContent => ({ name: `${tier} classes`, header: true, order, categories: { Tier: tier }, sections: [] });

test('exam lines read as skills and ranks; other lines are left out', () => {
  assert.deepEqual(needsOf('Swords: B\nRiding: e+\nA note without a rank\nBows: Z'), [{ skill: 'Swords', rank: 'B' }, { skill: 'Riding', rank: 'E+' }]);
  assert.equal(examLine(cls('Dancer', 'Advanced', 'Bows: B\nSwords: B')), 'Bows B · Swords B');
});

test('tiers go in their header cards’ order, then tiers with no header', () => {
  assert.deepEqual(tierOrder([cls('Odd', 'Hidden', ''), head('Specialty', 2), head('Beginner', 1), cls('Archer', 'Specialty', '')]), ['Beginner', 'Specialty', 'Hidden']);
});

test('steps follow the skills: the most alike class a tier down, and the other way round', () => {
  const all = [head('Specialty', 1), head('Advanced', 2),
    cls('Myrmidon', 'Specialty', 'Swords: C'), cls('Rogue', 'Specialty', 'Bows: C\nSwords: C'), cls('Archer', 'Specialty', 'Bows: C'),
    cls('Shido', 'Advanced', 'Swords: B'), cls('Dancer', 'Advanced', 'Bows: B\nSwords: B'), cls('Sniper', 'Advanced', 'Bows: B')];
  const at = (n: string) => all.find((e) => e.name === n)!;
  const names = (es: EntryContent[]) => es.map((e) => e.name);
  assert.deepEqual(names(stepsAround(at('Shido'), all).before), ['Myrmidon']);
  assert.deepEqual(names(stepsAround(at('Dancer'), all).before), ['Rogue', 'Archer', 'Myrmidon'], 'the most alike first, then the ones it builds on');
  assert.deepEqual(names(stepsAround(at('Archer'), all).next), ['Dancer', 'Sniper']);
  assert.deepEqual(names(stepsAround(at('Rogue'), all).next), ['Dancer']);
  assert.deepEqual(names(stepsAround(at('Myrmidon'), all).before), [], 'the top tier has nothing before it');
  assert.deepEqual(stepsAround(at('Specialty classes'), all).before, [], 'a header card has no steps');
});

test("Fortune's Weave: 58 classes in five tiers, every exam readable, old ids kept", () => {
  const es = classEntries();
  const classes = es.filter((e) => !e.header);
  assert.equal(classes.length, 58);
  assert.deepEqual(tierOrder(es), ['Beginner', 'Specialty', 'Advanced', 'Master', 'Divine']);
  for (const e of classes) assert.ok(needsOf(e.sections.find((s) => s.label === 'Exam needs')?.text).length, `${e.name} has an exam`);
  for (const e of classes) assert.equal(Object.keys(e.stats ?? {}).length, 9, `${e.name} has nine growth modifiers`);
  const ids = new Set(es.map((e) => e.id));
  assert.equal(ids.size, es.length, 'no two entries share an id');
  for (const id of ['beginner-classes', 'specialty-classes', 'advanced-classes', 'master-classes', 'dancer', 'ranger', 'troubadour', 'caladrius', 'dragoon', 'guardian', 'cataphract', 'blacksmith'])
    assert.ok(ids.has(id), `${id} still exists`);
  // Every class past the first tier has a step before it, so the ladder never dead-ends.
  for (const e of classes.filter((c) => c.categories.Tier !== 'Beginner')) assert.ok(stepsAround(e, es).before.length, `${e.name} has a step before`);
});
