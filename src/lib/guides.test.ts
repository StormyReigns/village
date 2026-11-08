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
  // In short comes first, then Watch out, the body (Steps or Write-up) and the tip.
  assert.deepEqual(shownFields(howTo).map((f) => f.label), ['In short', 'Watch out', 'Steps', 'Write-up', 'Tip']);
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

test('a share card never shows a spoiler step or a picture mark', async () => {
  const { shareAnswer } = await import('../data/pages/links.ts');
  const block = { id: 'how-to', type: 'guide' as const, title: 'How to', icon: 'BookOpen', entries: [] };
  const entry = { id: 'x', name: 'Beat the fort', categories: {}, sections: [{ label: 'Steps', text: `Go to the bridge [picture:${A}]\n||The boss is a dragon||` }] };
  const a = shareAnswer(block, entry);
  assert.deepEqual(a.steps, ['Go to the bridge', 'A spoiler: open it in the app to read']);
  assert.ok(!a.text.includes('dragon') && !a.text.includes('[picture'));
});

test('a write-up reads as sections: heading, words, spoiler and picture', async () => {
  const { parseWriteup, writeupText, paragraphs } = await import('./guides.ts');
  const text = `Fabio is a mage first.\n## Early game\nTake Sage.\n\nIt pays off by chapter 5.\n[picture:${A}]\n## Late game\n[spoiler]\nHe becomes a Archsage.`;
  const s = parseWriteup(text);
  assert.deepEqual(s.map((x) => x.heading), ['', 'Early game', 'Late game']);
  assert.equal(s[1].picture, A);
  assert.deepEqual(paragraphs(s[1].text), ['Take Sage.', 'It pays off by chapter 5.']);
  assert.equal(s[2].spoiler, true);
  assert.equal(writeupText(s), text);
  // A section with no heading after the first keeps its place with a bare "##".
  assert.equal(writeupText([{ heading: 'A', text: 'one', spoiler: false }, { heading: '', text: 'two', spoiler: false }]), '## A\none\n##\ntwo');
});

test('a write-up only takes our own pictures, and words never turn into marks', async () => {
  const { parseWriteup, writeupText } = await import('./guides.ts');
  assert.equal(parseWriteup('## A\n[picture:https://example.com/x.webp]\nWords')[0].picture, undefined);
  const tricky = [{ heading: 'A', text: '## not a heading\n[spoiler]', spoiler: false }];
  const back = parseWriteup(writeupText(tricky));
  assert.equal(back.length, 1);
  assert.equal(back[0].spoiler, false);
  assert.equal(back[0].text, '## not a heading\n[spoiler]');
});

test('switching versions keeps everything that was written', async () => {
  const { stepsToWriteup, writeupToSteps, parseWriteup } = await import('./guides.ts');
  const steps = `Buy the license\nTake the exam [picture:${A}]\n||You pass at 75%||\nCelebrate`;
  const w = parseWriteup(stepsToWriteup(steps));
  assert.deepEqual(w.map((x) => [x.text, x.spoiler, x.picture]), [
    ['Buy the license', false, undefined], ['Take the exam', false, A], ['You pass at 75%', true, undefined], ['Celebrate', false, undefined],
  ]);
  assert.equal(writeupToSteps(stepsToWriteup(steps)), steps);
  assert.equal(writeupToSteps('## Early game\nTake Sage.\n\nThen Archsage.'), 'Early game: Take Sage.\nThen Archsage.');
});

test('a write-up share card covers spoiler sections and never shows marks', async () => {
  const { shareAnswer } = await import('../data/pages/links.ts');
  const block = { id: 'how-to', type: 'guide' as const, title: 'How to', icon: 'BookOpen', entries: [] };
  const entry = { id: 'y', name: 'Best classes for Fabio', description: 'Sage, then Archsage.', categories: {},
    sections: [{ label: 'Write-up', text: `## Early game\nTake Sage.\n[picture:${A}]\n## The twist\n[spoiler]\nHe was the king all along.` }] };
  const a = shareAnswer(block, entry);
  assert.deepEqual(a.facts, [{ label: 'Early game', text: 'Take Sage.' }, { label: 'Spoiler', text: 'Open it in the app to read.' }]);
  for (const bad of ['king', 'twist', '[picture', '##', '[spoiler]']) assert.ok(!a.text.includes(bad), bad);
});
