// Run with: npm test
// A guide's steps stay one line each in its "Steps" text, so the guides already live, Drafts
// and history work unchanged. These pin how the spoiler and picture marks read and write.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPicturePath, parseStep, parseSteps, stepCount, stepLine, stepsText, stepWords } from './guides.ts';

// Real picture paths look like this: game/person/picture.
const U = '0f8fad5b-d9cb-469f-a165-70867728950e';
const A = `fortunes-weave/${U}/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp`;
const B = `fortunes-weave/${U}/16fd2706-8baf-433b-82eb-8c7fada847da.jpg`;

test('a plain line is a plain step', () => {
  assert.deepEqual(parseStep('  Buy the license in Hightown '), { text: 'Buy the license in Hightown', spoiler: false, picture: undefined });
});

test('|| marks a spoiler step, and [picture:…] a picture', () => {
  assert.deepEqual(parseStep('||Fabio joins after the fight||'), { text: 'Fabio joins after the fight', spoiler: true, picture: undefined });
  assert.deepEqual(parseStep(`Go up the stairs [picture:${A}]`), { text: 'Go up the stairs', spoiler: false, picture: A });
  assert.deepEqual(parseStep(`||Behind the altar|| [picture:${B}]`), { text: 'Behind the altar', spoiler: true, picture: B });
  // A lone "||" or "||||" is just text, not an empty spoiler.
  assert.equal(parseStep('||||').spoiler, false);
});

test('steps write back exactly as they read', () => {
  const text = `Give them a gift\n||Raise Support to B|| [picture:${A}]\nMeet any extra condition`;
  assert.equal(stepsText(parseSteps(text)), text);
  assert.equal(stepCount(text), 3);
});

test('the guides already live read as plain steps', () => {
  const live = 'Buy the license from the License Vendor in Hightown\nTake the Certification Exam from the Exam Proctor next to him\nAim for a 75%+ pass chance';
  const steps = parseSteps(live);
  assert.equal(steps.length, 3);
  assert.ok(steps.every((s) => !s.spoiler && !s.picture));
  assert.equal(stepsText(steps), live);
});

test('a step never spills onto two lines, and empty steps drop out', () => {
  assert.equal(stepLine({ text: 'One\nmore', spoiler: false }), 'One more');
  assert.equal(stepsText([{ text: ' ', spoiler: true }, { text: 'Kept', spoiler: false }]), 'Kept');
  // A picture alone is still a step.
  assert.equal(stepLine({ text: '', spoiler: false, picture: B }), `[picture:${B}]`);
});

test('marks are spelled out in words for search and change lists', () => {
  assert.equal(stepWords({ text: 'Behind the altar', spoiler: true, picture: A }), '(spoiler) Behind the altar (picture)');
});

test('a picture mark only ever names one of our uploads', () => {
  assert.ok(isPicturePath(A));
  const bad = ['https://example.com/a.webp', '//evil.example/a.png', `fortunes-weave/${U}/../x.webp`, '../../secret',
    `fortunes-weave/${U}/a.svg`, `Fortunes/${U}/${U}.webp`, 'a.webp', 'javascript:alert(1)', ''];
  for (const b of bad) {
    assert.equal(isPicturePath(b), false, b);
    assert.equal(parseStep(`Look here [picture:${b}]`).picture, undefined, b);
    assert.equal(stepLine({ text: 'Look here', spoiler: false, picture: b }), 'Look here', b);
  }
  // The mark is still taken out of the words, and doesn't come back.
  assert.equal(stepLine(parseStep('Look here [picture:https://example.com/a.webp]')), 'Look here');
});

test('the live guides fit the Guides fields: every part they have is a field that is on', async () => {
  const { PAGES } = await import('../data/pages/fortunes-weave.ts');
  const { DESCRIPTION, byFields, fieldsOf, johnDoe, kindsFor, shownFields } = await import('./fields.ts');
  const howTo = PAGES.flatMap((p) => p.blocks).find((b) => b.id === 'how-to')!;
  assert.equal(byFields(howTo), true);
  const on = new Set(shownFields(howTo).map((f) => f.key));
  assert.ok(on.has(DESCRIPTION) && on.has('Steps') && on.has('Tip'));
  for (const e of howTo.entries) {
    assert.ok(e.description, `${e.name} has an In short`);
    for (const s of e.sections) assert.ok(on.has(s.label), `${e.name}: ${s.label}`);
  }
  // In short comes first, then Watch out, the steps and the tip.
  assert.deepEqual(shownFields(howTo).map((f) => f.label), ['In short', 'Watch out', 'Steps', 'Tip']);
  // Steps are offered in Guides only; Guides get no charts.
  assert.ok(kindsFor('guide').some((k) => k.kind === 'steps'));
  assert.ok(!kindsFor('guide').some((k) => k.kind === 'chart'));
  assert.ok(!kindsFor('characters').some((k) => k.kind === 'steps'));
  assert.ok(!kindsFor('items').some((k) => k.kind === 'steps'));
  // The builders' sample is a guide, with a spoiler step.
  const sample = johnDoe({ type: 'guide', fields: fieldsOf(howTo), stats: [] });
  assert.equal(sample.name, 'Beat the bridge fort');
  assert.ok(sample.sections.find((s) => s.label === 'Steps')!.text.includes('||'));
});
