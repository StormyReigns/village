// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandOrder, classShape, needsOf, pathAround, rankLine } from './classes.ts';
import { CLASS_FIELDS, LEADS_TO, fieldsOf } from './fields.ts';
import { CLASS_SETUP, classEntries } from '../data/pages/fortunes-weave-classes.ts';
import type { EntryContent, FieldDef } from '../data/pages/types.ts';

const names = (es: EntryContent[]) => es.map((e) => e.name);

// A Fire Emblem-style Block: tiers as bands, skill ranks that draw the path.
const RANKS: FieldDef[] = [{ key: 'Tier', label: 'Tier', kind: 'tag' }, { key: 'Exam needs', label: 'Exam needs', kind: 'list' }, { key: LEADS_TO, label: 'Leads to', kind: 'links' }];
const cls = (name: string, tier: string, exam: string, leads?: string): EntryContent => ({ name, categories: { Tier: tier },
  sections: [{ label: 'Exam needs', text: exam }, ...(leads ? [{ label: LEADS_TO, text: leads }] : [])] });
const head = (tier: string, order: number): EntryContent => ({ name: `${tier} classes`, header: true, order, categories: { Tier: tier }, sections: [] });
const fe = [head('Specialty', 1), head('Advanced', 2),
  cls('Myrmidon', 'Specialty', 'Swords: C'), cls('Rogue', 'Specialty', 'Bows: C\nSwords: C'), cls('Archer', 'Specialty', 'Bows: C'),
  cls('Shido', 'Advanced', 'Swords: B'), cls('Dancer', 'Advanced', 'Bows: B\nSwords: B'), cls('Sniper', 'Advanced', 'Bows: B')];
const feShape = classShape({ fields: RANKS, filters: ['Tier'], entries: fe });
const at = (n: string) => fe.find((e) => e.name === n)!;

test('skill ranks read as skills and ranks; other lines are left out', () => {
  assert.deepEqual(needsOf('Swords: B\nRiding: e+\nA note without a rank\nBows: Z'), [{ skill: 'Swords', rank: 'B' }, { skill: 'Riding', rank: 'E+' }]);
  assert.equal(rankLine(at('Dancer'), feShape.ranks), 'Bows B · Swords B');
});

test("a Block's shape comes from its setup: the first tag is the bands, a list of ranks is found, Leads to when on", () => {
  assert.deepEqual(feShape, { band: 'Tier', ranks: 'Exam needs', leads: LEADS_TO });
  // Skills ("Combat Arts +1") aren't ranks, so a Block without an exam list has none.
  const skills = [cls('A', 'X', ''), cls('B', 'X', ''), cls('C', 'X', '')].map((e) => ({ ...e, sections: [{ label: 'Skills', text: 'Combat Arts +1\nSword Crit +3' }] }));
  assert.equal(classShape({ fields: [{ key: 'Skills', label: 'Skills', kind: 'list' }], filters: [], entries: skills }).ranks, undefined);
});

test('a list of "Skill: Rank" lines turns the worked-out path on, under any name; any other list leaves it off', () => {
  const renamed = fe.map((e) => ({ ...e, sections: e.sections.map((s) => (s.label === 'Exam needs' ? { ...s, label: 'Prerequisites' } : s)) }));
  const shape = classShape({ fields: [RANKS[0], { key: 'Prerequisites', label: 'Prerequisites', kind: 'list' }], filters: [], entries: renamed });
  assert.equal(shape.ranks, 'Prerequisites');
  assert.deepEqual(names(pathAround(renamed.find((e) => e.name === 'Shido')!, renamed, shape).before), ['Myrmidon']);
  // Requirements written as sentences, or with levels and quests mixed in, aren't ranks: no worked-out path.
  const prose = fe.map((e) => ({ ...e, sections: e.header ? [] : [{ label: 'Exam needs', text: 'Level 30\nFinish the quest "A Knight\'s Oath"' }] }));
  const off = classShape({ fields: RANKS.slice(0, 2), filters: [], entries: prose });
  assert.equal(off.ranks, undefined);
  assert.deepEqual(pathAround(prose.find((e) => e.name === 'Shido')!, prose, off), { next: [], before: [] });
});

test('Leads to names that match no class are left out of the path (the card shows them as plain text); matching ignores case and header cards', () => {
  const es: EntryContent[] = [head('Specialty', 1), cls('Squire', 'Specialty', '', 'knight\nSpecialty classes\nA class nobody added yet'), cls('Knight', 'Advanced', '')];
  const shape = classShape({ fields: RANKS, filters: ['Tier'], entries: es });
  assert.deepEqual(names(pathAround(es[1], es, shape).next), ['Knight']);
  assert.deepEqual(names(pathAround(es[2], es, shape).before), ['Squire']);
});

test('bands go in their header cards’ order, then bands with no header', () => {
  assert.deepEqual(bandOrder([cls('Odd', 'Hidden', ''), head('Specialty', 2), head('Beginner', 1), cls('Archer', 'Specialty', '')], 'Tier'), ['Beginner', 'Specialty', 'Hidden']);
});

test('with skill ranks, the path follows the skills: the most alike class a band down, then the ones it builds on', () => {
  assert.deepEqual(names(pathAround(at('Shido'), fe, feShape).before), ['Myrmidon']);
  assert.deepEqual(names(pathAround(at('Dancer'), fe, feShape).before), ['Rogue', 'Archer', 'Myrmidon']);
  assert.deepEqual(names(pathAround(at('Archer'), fe, feShape).next), ['Dancer', 'Sniper']);
  assert.deepEqual(names(pathAround(at('Myrmidon'), fe, feShape).before), [], 'the top band has nothing before it');
  assert.deepEqual(pathAround(at('Specialty classes'), fe, feShape), { next: [], before: [] }, 'a header card has no path');
});

test('World of Warcraft-shaped: roles as bands, no ranks, specs typed under Leads to, Comes from worked out', () => {
  const fields: FieldDef[] = [{ key: 'Role', label: 'Role', kind: 'tag' }, { key: 'Armor', label: 'Armor', kind: 'tag' }, { key: LEADS_TO, label: 'Specs', kind: 'links' }];
  const wow = (name: string, role: string, specs?: string): EntryContent => ({ name, categories: { Role: role, Armor: 'Plate' }, sections: specs ? [{ label: LEADS_TO, text: specs }] : [] });
  const es = [{ name: 'Tank', header: true, order: 1, categories: { Role: 'Tank' }, sections: [], description: 'Takes the hits.' } as EntryContent,
    wow('Warrior', 'Tank', 'Arms: two-handed weapons\nFury\nProtection'), wow('Arms', 'Damage'), wow('Fury', 'Damage'), wow('Protection', 'Tank')];
  const shape = classShape({ fields, filters: [], entries: es });
  assert.deepEqual(shape, { band: 'Role', ranks: undefined, leads: LEADS_TO });
  assert.deepEqual(bandOrder(es, shape.band), ['Tank', 'Damage']);
  const warrior = pathAround(es[1], es, shape);
  assert.deepEqual(names(warrior.next), ['Arms', 'Fury', 'Protection']);
  assert.deepEqual(names(pathAround(es[2], es, shape).before), ['Warrior']);
});

test('Final Fantasy XIV-shaped: a typed path joins one class to its job, both ways', () => {
  const fields: FieldDef[] = [{ key: 'Tier', label: 'Base class or job', kind: 'tag' }, { key: LEADS_TO, label: 'Becomes', kind: 'links' }];
  const es: EntryContent[] = [
    { name: 'Gladiator', categories: { Tier: 'Class' }, sections: [{ label: LEADS_TO, text: 'Paladin: at level 30' }] },
    { name: 'Paladin', categories: { Tier: 'Job' }, sections: [] },
  ];
  const shape = classShape({ fields, filters: ['Tier'], entries: es });
  assert.deepEqual(names(pathAround(es[0], es, shape).next), ['Paladin']);
  assert.deepEqual(names(pathAround(es[1], es, shape).before), ['Gladiator']);
});

test('the common class fields name no game: Fire Emblem words stay in its own setup', () => {
  assert.equal(fieldsOf({ type: 'classes' }), CLASS_FIELDS);
  const labels = CLASS_FIELDS.map((f) => f.label).join(' ');
  for (const word of ['Exam', 'Growth', 'Mastery', 'Moves', 'License']) assert.ok(!labels.includes(word), `${word} isn't a common label`);
  assert.ok(CLASS_FIELDS.some((f) => f.key === LEADS_TO && f.kind === 'links'));
});

test("Fortune's Weave: 58 classes in five tiers, ranks found, old ids kept, every later class has a step before", () => {
  const es = classEntries();
  const classes = es.filter((e) => !e.header);
  const shape = classShape({ fields: CLASS_SETUP, filters: ['Tier', 'Moves'], entries: es });
  assert.deepEqual(shape, { band: 'Tier', ranks: 'Exam needs', leads: LEADS_TO });
  assert.equal(classes.length, 58);
  assert.deepEqual(bandOrder(es, shape.band), ['Beginner', 'Specialty', 'Advanced', 'Master', 'Divine']);
  for (const e of classes) assert.ok(rankLine(e, shape.ranks), `${e.name} has an exam`);
  for (const e of classes) assert.equal(Object.keys(e.stats ?? {}).length, 9, `${e.name} has nine growth modifiers`);
  const ids = new Set(es.map((e) => e.id));
  assert.equal(ids.size, es.length, 'no two entries share an id');
  for (const id of ['beginner-classes', 'specialty-classes', 'advanced-classes', 'master-classes', 'dancer', 'ranger', 'troubadour', 'caladrius', 'dragoon', 'guardian', 'cataphract', 'blacksmith'])
    assert.ok(ids.has(id), `${id} still exists`);
  for (const e of classes.filter((c) => c.categories.Tier !== 'Beginner')) assert.ok(pathAround(e, es, shape).before.length, `${e.name} has a step before`);
});

test("the live Fortune's Weave setup (saved before Leads to existed) still draws its path from the exams", () => {
  const es = classEntries();
  const saved = CLASS_SETUP.filter((f) => f.key !== LEADS_TO);
  const shape = classShape({ fields: saved, filters: ['Tier', 'Moves'], entries: es });
  assert.equal(shape.leads, undefined);
  const dancer = es.find((e) => e.name === 'Dancer')!;
  assert.deepEqual(names(pathAround(dancer, es, shape).next), ['Shadow Seeker']);
});
