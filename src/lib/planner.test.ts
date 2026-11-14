// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMember, firstSentence, fromSaved, moveMember, nextStep, partySize, planKey, plannerRosters, removeMember, tidyPlan, toSaved, unlockFields } from './planner.ts';
import { DESCRIPTION } from './fields.ts';
import type { Block, Entry, Page } from '../data/pages/types.ts';

const roster: Block = {
  id: 'units', type: 'characters', title: 'Units', icon: 'Users', byRoute: true,
  fields: [{ key: 'Group', label: 'Group', kind: 'tag' }, { key: 'Recruit', label: 'How to recruit', kind: 'longtext' }],
  entries: [],
};
const goliath: Entry = {
  id: 'goliath', name: 'Goliath', description: "Deliver 3 Giant's Meat. A giant always appears in Sand-Shadow Fort.",
  sections: [], categories: { Group: 'Fiery Mane' },
  perRoute: { theodora: [{ label: 'Recruit', text: 'Support 3, Renown 9' }], cai: [{ label: 'Recruit', text: 'Support 3, Renown 7' }] },
};

test('a party: add, refuse when full or already in, remove, move', () => {
  let p = { party: [] as string[] };
  p = addMember(p, 'a', 2); p = addMember(p, 'b', 2);
  assert.deepEqual(addMember(p, 'c', 2), p, 'full');
  assert.deepEqual(addMember(p, 'a', 5), p, 'already in');
  assert.deepEqual(moveMember(p, 'b', -1).party, ['b', 'a']);
  assert.deepEqual(moveMember(p, 'a', -1), p, 'the first cannot move up');
  assert.deepEqual(removeMember(p, 'a').party, ['b']);
});

test('the party size: the setup, else the database ceiling', () => {
  assert.equal(partySize({ roster: 'units', size: 15 }), 15);
  assert.equal(partySize({ roster: 'units' }), 100);
  assert.equal(partySize({ roster: 'units', size: 500 }), 100);
  assert.equal(planKey('all'), '');
  assert.equal(planKey('leda'), 'leda');
});

test('a stored plan is tidied: known units, once each, within the size', () => {
  const ids = new Set(['a', 'b', 'c']);
  assert.deepEqual(tidyPlan({ party: ['a', 'x', 'a', 'b', 'c', 7] }, ids, 2).party, ['a', 'b']);
  assert.deepEqual(tidyPlan('junk', ids, 5).party, []);
});

test('the account keeps cards; the device keeps entry ids', () => {
  const card = (id: string) => ({ a: 'c-a', b: 'c-b' } as Record<string, string>)[id];
  const id = (c: string) => ({ 'c-a': 'a', 'c-b': 'b' } as Record<string, string>)[c];
  assert.deepEqual(toSaved({ party: ['a', 'gone', 'b'] }, card), { party: [{ card: 'c-a' }, { card: 'c-b' }] });
  assert.deepEqual(fromSaved({ party: [{ card: 'c-b' }, { card: 'nope' }, null] }, id).party, ['b']);
});

test('the next-step line: how to recruit, for the route, then "Recruited"', () => {
  const withDesc = { roster: 'units', unlock: ['Recruit', DESCRIPTION] };
  assert.deepEqual(nextStep(goliath, roster, 'theodora', false, withDesc), { kind: 'recruit', text: "Support 3, Renown 9 · Deliver 3 Giant's Meat." });
  assert.deepEqual(nextStep(goliath, roster, 'leda', false, withDesc), { kind: 'recruit', text: "Deliver 3 Giant's Meat." });
  assert.deepEqual(nextStep(goliath, roster, 'theodora', true, withDesc), { kind: 'got', text: 'Recruited' });
  // Without a setup, the roster's recruit field alone.
  assert.equal(unlockFields(roster)[0]?.key, 'Recruit');
  assert.deepEqual(nextStep(goliath, roster, 'cai', false), { kind: 'recruit', text: 'Support 3, Renown 7' });
  // No recruit steps at all (a Flame Lord): the description, without 'To recruit'.
  assert.deepEqual(nextStep({ ...goliath, perRoute: undefined, description: 'Flame Lord of the Wolf Obelisk.' }, roster, 'theodora', false, withDesc), { kind: 'none', text: 'Flame Lord of the Wolf Obelisk.' });
  // Joins on their own on this route.
  const auto = { ...goliath, perRoute: { leda: [{ label: 'Recruit', text: 'joins automatically' }] } };
  assert.deepEqual(nextStep(auto, roster, 'leda', false, withDesc), { kind: 'got', text: 'joins automatically' });
});

test('first sentences', () => {
  assert.equal(firstSentence('Pay 8,000G. Then wait.'), 'Pay 8,000G.');
  assert.equal(firstSentence('\nNo full stop here'), 'No full stop here');
});

test('a Planner finds its roster on another Page', () => {
  const planner: Block = { id: 'your-party', type: 'planner', title: 'Your party', icon: 'ClipboardList', entries: [], planSetup: { roster: 'units', size: 15 } };
  const pages: Page[] = [
    { id: 'units', title: 'Units', short: 'Units', icon: 'Users', tint: 'berry', blurb: '', blocks: [roster] },
    { id: 'party', title: 'Party', short: 'Party', icon: 'ClipboardList', tint: 'slate', blurb: '', blocks: [planner] },
  ];
  const r = plannerRosters(pages, pages[1]);
  assert.equal(r['your-party']?.block.id, 'units');
  assert.equal(r['your-party']?.page.tint, 'berry');
  assert.deepEqual(plannerRosters(pages, pages[0]), {});
});
