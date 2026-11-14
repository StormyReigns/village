// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMember, firstSentence, fromSaved, moveMember, nextStep, partySize, planKey, plannerRosters, removeMember, samePlan,
  setClassStep, slotCount, tidyPlan, toSaved, toggleGear, toggleStepDone, unlockFields, type Plan, type StepContext,
} from './planner.ts';
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
const withDesc = { roster: 'units', unlock: ['Recruit', DESCRIPTION], slots: [{ key: 'weapons', label: 'Weapons', from: 'weapons', count: 2 }] };
const ctx = (over: Partial<StepContext> = {}): StepContext => ({ roster, route: 'theodora', recruited: false, setup: withDesc, ...over });

test('a party: add, refuse when full or already in, remove, move', () => {
  let p: Plan = { party: [] };
  p = addMember(p, 'a', 2); p = addMember(p, 'b', 2);
  assert.deepEqual(addMember(p, 'c', 2), p, 'full');
  assert.deepEqual(addMember(p, 'a', 5), p, 'already in');
  assert.deepEqual(moveMember(p, 'b', -1).party, ['b', 'a']);
  assert.deepEqual(moveMember(p, 'a', -1), p, 'the first cannot move up');
  assert.deepEqual(removeMember(p, 'a').party, ['b']);
});

test('the party size and slot counts: the setup, within the database ceilings', () => {
  assert.equal(partySize({ roster: 'units', size: 15 }), 15);
  assert.equal(partySize({ roster: 'units' }), 100);
  assert.equal(partySize({ roster: 'units', size: 500 }), 100);
  assert.equal(slotCount({ key: 'w', label: 'W', from: 'x' }), 1);
  assert.equal(slotCount({ key: 'w', label: 'W', from: 'x', count: 40 }), 10);
  assert.equal(planKey('all'), '');
  assert.equal(planKey('leda'), 'leda');
});

test('a build: a class per tier, done or not, and gear up to a slot\'s count; removing a unit drops it', () => {
  let p: Plan = { party: ['ninae'] };
  p = setClassStep(p, 'ninae', 'Beginner', 'myrmidon');
  p = setClassStep(p, 'ninae', 'Specialty', 'shido');
  p = toggleStepDone(p, 'ninae', 'Beginner');
  assert.deepEqual(p.builds?.ninae.classes, { Beginner: { id: 'myrmidon', done: true }, Specialty: { id: 'shido' } });
  assert.deepEqual(setClassStep(p, 'ninae', 'Beginner', 'myrmidon').builds?.ninae.classes?.Beginner, { id: 'myrmidon', done: true }, 'picking the same class keeps done');
  assert.equal(setClassStep(p, 'ninae', 'Beginner', 'soldier').builds?.ninae.classes?.Beginner.done, undefined, 'a new pick starts not done');
  p = toggleGear(p, 'ninae', 'weapons', 'iron-sword', 1);
  assert.deepEqual(toggleGear(p, 'ninae', 'weapons', 'levin-sword', 1), p, 'a full slot refuses');
  assert.deepEqual(toggleGear(p, 'ninae', 'weapons', 'iron-sword', 1).builds?.ninae.gear, undefined, 'tapping again takes it out');
  assert.deepEqual(setClassStep(p, 'goliath', 'Beginner', 'myrmidon'), p, 'only party members have builds');
  assert.equal(removeMember(p, 'ninae').builds, undefined);
  assert.ok(samePlan(setClassStep(setClassStep({ party: ['n'] }, 'n', 'A', 'x'), 'n', 'B', 'y'), setClassStep(setClassStep({ party: ['n'] }, 'n', 'B', 'y'), 'n', 'A', 'x')));
});

test('a stored plan is tidied: known units once each within the size, and builds that still fit', () => {
  const known = { ids: new Set(['a', 'b', 'c']), size: 2, classBand: new Map([['myrmidon', 'Beginner']]), slots: { weapons: { ids: new Set(['iron']), count: 1 } } };
  assert.deepEqual(tidyPlan({ party: ['a', 'x', 'a', 'b', 'c', 7] }, known).party, ['a', 'b']);
  assert.deepEqual(tidyPlan('junk', known).party, []);
  const t = tidyPlan({ party: ['a'], builds: { a: { classes: { Beginner: { id: 'myrmidon', done: true }, Specialty: { id: 'myrmidon' }, Master: { id: 'gone' } }, gear: { weapons: ['iron', 'iron', 'old'], rings: ['x'] } }, x: { classes: {} } } }, known);
  assert.deepEqual(t, { party: ['a'], builds: { a: { classes: { Beginner: { id: 'myrmidon', done: true } }, gear: { weapons: ['iron'] } } } });
});

test('the account keeps cards and builds; the device keeps entry ids', () => {
  const m = (o: Record<string, string>) => (k: string) => o[k];
  const refs = { roster: m({ a: 'c-a', b: 'c-b' }), classes: m({ myr: 'c-myr' }), item: (_s: string, id: string) => m({ iron: 'c-iron' })(id) };
  const back = { roster: m({ 'c-a': 'a', 'c-b': 'b' }), classes: m({ 'c-myr': 'myr' }), item: (_s: string, c: string) => m({ 'c-iron': 'iron' })(c) };
  const plan: Plan = { party: ['a', 'gone', 'b'], builds: { a: { classes: { Beginner: { id: 'myr', done: true } }, gear: { weapons: ['iron', 'nope'] } } } };
  const saved = toSaved(plan, refs);
  assert.deepEqual(saved, { party: [{ card: 'c-a', classes: [{ band: 'Beginner', card: 'c-myr', done: true }], gear: [{ slot: 'weapons', cards: ['c-iron'] }] }, { card: 'c-b' }] });
  assert.deepEqual(fromSaved(saved, back), { party: ['a', 'b'], builds: { a: { classes: { Beginner: { id: 'myr', done: true } }, gear: { weapons: ['iron'] } } } });
  assert.deepEqual(fromSaved({ party: [{ card: 'c-b' }, { card: 'nope' }, null] }, back).party, ['b']);
});

test('the next-step line: recruit, then gear to get, then the next class, then the plan', () => {
  assert.deepEqual(nextStep(goliath, ctx()), { kind: 'recruit', text: "Support 3, Renown 9 · Deliver 3 Giant's Meat." });
  assert.deepEqual(nextStep(goliath, ctx({ route: 'leda' })), { kind: 'recruit', text: "Deliver 3 Giant's Meat." });
  assert.deepEqual(nextStep(goliath, ctx({ recruited: true })), { kind: 'got', text: 'Recruited' });
  const build = { classes: { Beginner: { id: 'gla', done: true }, Specialty: { id: 'bri' } }, gear: { weapons: ['axe'] } };
  const classOf = (id: string) => ({ gla: { name: 'Gladiator', exam: 'Axes D' }, bri: { name: 'Brigand', exam: 'Axes C' } } as Record<string, { name: string; exam: string }>)[id];
  let got = false;
  const itemOf = (_s: string, id: string) => (id === 'axe' ? { name: 'Steel Axe', where: 'Hightown armory. Also dropped by bandits.', got } : undefined);
  const planned = ctx({ recruited: true, build, bands: ['Beginner', 'Specialty'], classOf, itemOf });
  assert.deepEqual(nextStep(goliath, { ...planned, recruited: false }).kind, 'recruit', 'recruiting comes first');
  assert.deepEqual(nextStep(goliath, planned), { kind: 'gear', text: 'Steel Axe · Hightown armory.' });
  got = true;
  assert.deepEqual(nextStep(goliath, planned), { kind: 'class', text: 'Brigand · Axes C' });
  assert.deepEqual(nextStep(goliath, { ...planned, build: { ...build, classes: { ...build.classes, Specialty: { id: 'bri', done: true } } } }), { kind: 'planned', text: 'Brigand · Steel Axe' });
  // Without a setup, the roster's recruit field alone.
  assert.equal(unlockFields(roster)[0]?.key, 'Recruit');
  assert.deepEqual(nextStep(goliath, { roster, route: 'cai', recruited: false }), { kind: 'recruit', text: 'Support 3, Renown 7' });
  // No recruit steps at all (a Flame Lord): the description, without "To recruit".
  assert.deepEqual(nextStep({ ...goliath, perRoute: undefined, description: 'Flame Lord of the Wolf Obelisk.' }, ctx()), { kind: 'none', text: 'Flame Lord of the Wolf Obelisk.' });
  // Joins on their own on this route, then their plan.
  const auto = { ...goliath, perRoute: { leda: [{ label: 'Recruit', text: 'joins automatically' }] } };
  assert.deepEqual(nextStep(auto, ctx({ route: 'leda' })), { kind: 'got', text: 'joins automatically' });
  assert.deepEqual(nextStep(auto, { ...planned, route: 'leda', recruited: false }), { kind: 'class', text: 'Brigand · Axes C' });
});

test('first sentences', () => {
  assert.equal(firstSentence('Pay 8,000G. Then wait.'), 'Pay 8,000G.');
  assert.equal(firstSentence('\nNo full stop here'), 'No full stop here');
});

test('a Planner finds its roster, classes and gear Blocks on other Pages', () => {
  const classes: Block = { id: 'classes', type: 'classes', title: 'Classes', icon: 'Shield', entries: [] };
  const weapons: Block = { id: 'weapons', type: 'items', title: 'Weapons', icon: 'Swords', entries: [] };
  const planner: Block = { id: 'your-party', type: 'planner', title: 'Your party', icon: 'ClipboardList', entries: [],
    planSetup: { roster: 'units', size: 15, classes: 'classes', slots: [{ key: 'weapons', label: 'Weapons', from: 'weapons' }, { key: 'rings', label: 'Rings', from: 'nowhere' }] } };
  const pages: Page[] = [
    { id: 'units', title: 'Units', short: 'Units', icon: 'Users', tint: 'berry', blurb: '', blocks: [roster] },
    { id: 'party', title: 'Party', short: 'Party', icon: 'ClipboardList', tint: 'slate', blurb: '', blocks: [planner] },
    { id: 'classes', title: 'Classes', short: 'Classes', icon: 'Shield', tint: 'indigo', blurb: '', blocks: [classes] },
    { id: 'items', title: 'Items', short: 'Items', icon: 'Backpack', tint: 'sun', blurb: '', blocks: [weapons] },
  ];
  const r = plannerRosters(pages, pages[1])['your-party'];
  assert.equal(r?.block.id, 'units');
  assert.equal(r?.page.tint, 'berry');
  assert.equal(r?.classes?.page.tint, 'indigo');
  assert.deepEqual(Object.keys(r?.slots ?? {}), ['weapons']);
  assert.deepEqual(plannerRosters(pages, pages[0]), {});
});

test('dragging moves a unit to a place', async () => {
  const { moveMemberTo } = await import('./planner.ts');
  const p: Plan = { party: ['a', 'b', 'c', 'd'] };
  assert.deepEqual(moveMemberTo(p, 'd', 0).party, ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveMemberTo(p, 'a', 2).party, ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveMemberTo(p, 'b', 1), p, 'same place, same plan');
  assert.deepEqual(moveMemberTo(p, 'x', 0), p);
});

test('the party index: members and planned items, for marks on other Pages', async () => {
  const { partyIndexRoute, readPartyIndex } = await import('./planner.ts');
  const plan: Plan = { party: ['goliath', 'ninae'], builds: { goliath: { gear: { weapons: ['steel-axe'] } }, ninae: { gear: { weapons: ['steel-axe', 'levin'] } } } };
  const names: Record<string, string> = { goliath: 'Goliath', ninae: 'Ninae' };
  const idx = partyIndexRoute(plan, 'units', (id) => names[id], (s) => (s === 'weapons' ? 'weapons-and-magic' : undefined));
  assert.deepEqual(idx, { members: ['units.goliath', 'units.ninae'], items: { 'weapons-and-magic.steel-axe': ['Goliath', 'Ninae'], 'weapons-and-magic.levin': ['Ninae'] } });
  assert.equal(readPartyIndex({ href: 'https://evil.example', byRoute: {} }), null, 'only paths in Village');
  assert.deepEqual(readPartyIndex({ href: '/g/x/party', byRoute: { leda: { members: ['units.a', 3], items: { 'w.i': ['A', 1], bad: 'x' } } } }),
    { href: '/g/x/party', byRoute: { leda: { members: ['units.a'], items: { 'w.i': ['A'] } } } });
});
