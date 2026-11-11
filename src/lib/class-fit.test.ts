// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classKin, classesFor, inClass, strengthFit, strengths, whoSuits } from './class-fit.ts';
import { PAGES } from '../data/pages/fortunes-weave.ts';
import type { Page, StatDef } from '../data/pages/types.ts';

const defs: StatDef[] = ['hp', 'str', 'mag', 'spd'].map((key) => ({ key, label: key.toUpperCase(), better: 'high' as const }));
const s = (hp: number, str: number, mag: number, spd: number) => ({ hp, str, mag, spd });

test("a unit's strengths are the stats they grow better than the cast's average, strongest first", () => {
  const cast = [s(50, 40, 20, 30), s(50, 20, 40, 30), s(50, 30, 30, 60)];
  assert.deepEqual(strengths(cast[2], cast, defs).map((x) => x.def.key), ['spd']);
  assert.deepEqual(strengths(cast[0], cast, defs).map((x) => x.def.key), ['str']);
  assert.deepEqual(strengths(undefined, cast, defs), [], 'no numbers, no strengths');
});

test('by strengths, the class that raises what the unit is good at comes first, with its reason', () => {
  const cast = [s(50, 40, 20, 30), s(50, 20, 40, 30), s(50, 30, 30, 60)];
  const classes = [{ name: 'Mage', stats: s(0, -5, 20, 0) }, { name: 'Myrmidon', stats: s(10, 0, 0, 15) }, { name: 'Brute', stats: s(20, 20, -5, -5) }];
  const fast = classesFor(cast[2], cast, classes, defs);
  assert.deepEqual(fast.map((f) => f.row.name), ['Myrmidon', 'Mage', 'Brute']);
  assert.deepEqual(fast[0].reason.map((d) => d.key), ['spd']);
  assert.deepEqual(fast[2].reason, [], 'a class that lowers their strength gives no reason');
  // By one stat instead: their growth in it once in the class.
  assert.deepEqual(classesFor(cast[1], cast, classes, defs, 'stat:mag').map((f) => f.row.name), ['Mage', 'Myrmidon', 'Brute']);
  assert.equal(inClass(cast[1], classes[0].stats, 'mag'), 60);
});

test('a stat where lower is better counts the other way', () => {
  const low: StatDef[] = [...defs.slice(0, 3), { key: 'wt', label: 'Wt', better: 'low' }];
  const cast = [{ hp: 1, str: 1, mag: 1, wt: 2 }, { hp: 1, str: 1, mag: 1, wt: 10 }];
  assert.deepEqual(strengths(cast[0], cast, low).map((x) => x.def.key), ['wt']);
  assert.ok(strengthFit(strengths(cast[0], cast, low), { wt: -5 }).score > 0, 'lowering a low-is-better stat helps');
});

test('who suits a class: the units it helps most, each by their own strengths', () => {
  const units = [{ name: 'Fast', stats: s(50, 30, 30, 60) }, { name: 'Strong', stats: s(50, 40, 20, 30) }, { name: 'Smart', stats: s(50, 20, 40, 30) }];
  assert.deepEqual(whoSuits(s(10, 0, 0, 15), units, defs).map((f) => f.row.name), ['Fast']);
  assert.deepEqual(whoSuits(s(0, -5, 20, 0), units, defs).map((f) => f.row.name), ['Smart']);
});

test("Fortune's Weave: Units and Classes are kin both ways, on the nine growth stats", () => {
  const units = PAGES.find((p) => p.id === 'units')!;
  const classes = PAGES.find((p) => p.id === 'classes')!;
  const onUnits = classKin('fortunes-weave', PAGES, units);
  assert.equal(onUnits.length, 1);
  assert.equal(onUnits[0].side, 'classes');
  assert.equal(onUnits[0].defs.length, 9);
  assert.equal(onUnits[0].rows.length, 58, 'every class, no tier cards');
  assert.deepEqual(onUnits[0].bands, ['Beginner', 'Specialty', 'Advanced', 'Master', 'Divine']);
  const onClasses = classKin('fortunes-weave', PAGES, classes);
  assert.equal(onClasses[0].side, 'units');
  assert.ok(onClasses[0].rows.length > 50, 'the units with growths');
  // Units carry their routes and spoilers, so a card can follow the route switcher and hide spoilers.
  const fabio = onClasses[0].rows.find((r) => r.name === 'Fabio')!;
  assert.deepEqual(fabio.routes, ['dietrich', 'leda']);
  assert.equal(fabio.spoiler, true);
  // Pages with neither have none.
  assert.deepEqual(classKin('fortunes-weave', PAGES, PAGES.find((p) => p.id === 'items')!), []);
});

test('a World of Warcraft-style Classes Block, with no stats in common, pairs with nothing', () => {
  const wow: Page = { id: 'classes', title: 'Classes', short: 'Classes', icon: 'Shield', tint: 'indigo', blurb: '',
    blocks: [{ id: 'classes', type: 'classes', title: 'Classes', icon: 'Shield', fields: [{ key: 'Role', label: 'Role', kind: 'tag' }], entries: [] }] };
  const units = PAGES.find((p) => p.id === 'units')!;
  assert.deepEqual(classKin('wow', [units, wow], wow), []);
  assert.deepEqual(classKin('wow', [units, wow], units), []);
});
