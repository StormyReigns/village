// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerHref, oldestFirst, openFor, openOn, similarQuestions, toQuestion, waitingOn, wantCount, type Question } from './questions.ts';

const q = (id: string, body: string, extra: Partial<Question> = {}): Question => ({
  id, gameId: 'fortunes-weave', pageKey: 'units-and-classes', cardId: null, body, spoiler: false, note: null, askedBy: 'a',
  status: 'open', reply: null, answerCardId: null, answerDraftId: null, answeredBy: null, answeredAt: null,
  createdAt: '2026-11-01T00:00:00Z', meToo: [], ...extra,
});

test('the asker and every "me too" count as wanting to know; moved Mysteries have no asker', () => {
  assert.equal(wantCount(q('1', 'x', { meToo: ['b', 'c'] })), 3);
  assert.equal(wantCount(q('1', 'x', { askedBy: null })), 0);
  assert.ok(waitingOn(q('1', 'x', { meToo: ['b'] }), 'b'));
  assert.ok(waitingOn(q('1', 'x'), 'a'));
  assert.ok(!waitingOn(q('1', 'x'), null));
});

test('oldest first, and only the open ones about that Page', () => {
  const list = [
    q('new', 'New one', { createdAt: '2026-11-07T00:00:00Z' }),
    q('old', 'Old one', { createdAt: '2026-10-01T00:00:00Z' }),
    q('done', 'Answered', { status: 'answered', createdAt: '2026-09-01T00:00:00Z' }),
    q('other', 'Elsewhere', { pageKey: 'guides', createdAt: '2026-09-01T00:00:00Z' }),
  ];
  assert.deepEqual(openOn(list, 'units-and-classes').map((x) => x.id), ['old', 'new']);
  assert.deepEqual(oldestFirst(list).map((x) => x.id)[0], 'done');
});

test('how long open reads in plain words', () => {
  const now = new Date('2026-11-08T12:00:00Z').getTime();
  assert.equal(openFor('2026-11-08T01:00:00Z', now), 'today');
  assert.equal(openFor('2026-11-07T11:00:00Z', now), '1 day');
  assert.equal(openFor('2026-11-04T12:00:00Z', now), '4 days');
  assert.equal(openFor('2026-10-18T12:00:00Z', now), '3 weeks');
  assert.equal(openFor('2026-06-01T12:00:00Z', now), '5 months');
});

test('typing a question finds the same one already asked, typos and all', () => {
  const list = [q('long', 'How does Long join?'), q('cai', 'Does Cai have good STR?'), q('gone', 'How does Long join the army?', { status: 'answered' })];
  assert.deepEqual(similarQuestions(list, 'how do i get long').map((x) => x.id), ['long']);
  assert.deepEqual(similarQuestions(list, 'cai str').map((x) => x.id), ['cai']);
  assert.deepEqual(similarQuestions(list, 'ho'), []);
});

test('answers link to the entry: guides open in place, the rest open their panel', () => {
  assert.equal(answerHref('fw', { page: 'units-and-classes', block: 'units', blockType: 'characters', slug: 'cai' }), '/g/fw/units-and-classes?e=units.cai');
  assert.equal(answerHref('fw', { page: 'guides', block: 'how-to', blockType: 'guide', slug: 'reclass' }), '/g/fw/guides#how-to-reclass');
  assert.equal(answerHref('fw', { page: 'guides' }), '/g/fw/guides');
  assert.equal(answerHref('fw', {}), null);
});

test('database rows become questions with their "me too"s', () => {
  const x = toQuestion({ id: '1', game_id: 'fw', page_key: 'guides', body: 'Hi there', status: 'open', created_at: 'x', question_askers: [{ profile_id: 'b' }] });
  assert.deepEqual(x.meToo, ['b']);
  assert.equal(x.askedBy, null);
  assert.equal(x.spoiler, false);
});
