// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endsIn, isOpen, pollProblem, pollToSend, result, tally, toPoll, voterLine, type Poll } from './polls.ts';

const NOW = Date.parse('2026-11-21T12:00:00Z');
const poll: Poll = { options: [{ label: 'Head only' }, { label: 'Shoulders' }, { label: 'Full' }], endsAt: '2026-11-22T12:00:00Z' };

test('a stored poll is read, and anything else is not a poll', () => {
  const p = toPoll({ options: [{ label: 'A', image: { path: 'fw/u/a.webp', w: 10, h: 20 } }, { label: 'B' }], ends_at: '2026-11-22T12:00:00Z' });
  assert.deepEqual(p, { options: [{ label: 'A', image: { path: 'fw/u/a.webp', w: 10, h: 20 } }, { label: 'B' }], endsAt: '2026-11-22T12:00:00Z' });
  assert.equal(toPoll(null), null);
  assert.equal(toPoll({ options: [{ label: 'A' }], ends_at: 'x' }), null);
  assert.equal(toPoll({ options: 'no' }), null);
});

test('what gets sent: labels trimmed, blanks dropped, the end worked out', () => {
  const sent = pollToSend([{ label: ' A ' }, { label: '' }, { label: 'B' }], 24, NOW);
  assert.deepEqual(sent.options, [{ label: 'A' }, { label: 'B' }]);
  assert.equal(sent.ends_at, '2026-11-22T12:00:00.000Z');
});

test('a poll needs a question, two named choices, and names on pictures', () => {
  assert.match(pollProblem('', [{ label: 'A' }, { label: 'B' }])!, /question/);
  assert.match(pollProblem('Which?', [{ label: 'A' }, { label: ' ' }])!, /two choices/);
  assert.match(pollProblem('Which?', [{ label: 'A' }, { label: 'B' }, { label: '', image: { path: 'x', w: 1, h: 1 } }])!, /name/);
  assert.match(pollProblem('Which?', [{ label: 'x'.repeat(81) }, { label: 'B' }])!, /80/);
  assert.equal(pollProblem('Which?', [{ label: 'A' }, { label: 'B' }, { label: '' }]), null);
});

test('open or ended, and how long is left', () => {
  assert.equal(isOpen(poll, NOW), true);
  assert.equal(isOpen(poll, Date.parse('2026-11-22T12:00:00Z')), false);
  assert.equal(endsIn(poll, NOW), 'ends in 24h');
  assert.equal(endsIn(poll, Date.parse('2026-11-22T11:20:00Z')), 'ends in 40m');
  assert.equal(endsIn(poll, Date.parse('2026-11-22T11:59:30Z')), 'ends in under a minute');
  assert.equal(endsIn({ ...poll, endsAt: '2026-11-24T12:00:00Z' }, NOW), 'ends in 3 days');
});

test('counting votes, the leaders, and the result line', () => {
  const votes = [{ choice: 0, by: 'a', name: 'You' }, { choice: 1, by: 'b', name: 'Ana' }, { choice: 0, by: 'c', name: 'Theo' }, { choice: 9, by: 'd', name: 'Odd' }];
  const t = tally(poll, votes);
  assert.deepEqual(t.counts, [2, 1, 0]);
  assert.deepEqual(t.names[0], ['You', 'Theo']);
  assert.equal(t.total, 3);
  assert.deepEqual(t.leaders, [0]);
  assert.equal(result(poll, votes), 'Ended · Head only won · 2 of 3 votes');
  assert.equal(result(poll, votes.slice(0, 2)), 'Ended · tied: Head only and Shoulders (1 each)');
  assert.equal(result(poll, []), 'Ended · no votes');
  assert.deepEqual(tally(poll, []).leaders, []);
});

test('who voted, kept short', () => {
  assert.equal(voterLine(['You', 'Ana']), 'You, Ana');
  assert.equal(voterLine(['You', 'Ana', 'Theo']), 'You, Ana, Theo');
  assert.equal(voterLine(['You', 'Ana', 'Theo', 'Kai', 'Mo']), 'You, Ana and 3 more');
});
