// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byRenownAndLevel, chapterLabel, groupInOrder, levelOf, renownOf } from './my-run.ts';
import { deadlineRank } from './deadline.ts';

test('chapter groups are named from the deadline', () => {
  assert.equal(chapterLabel(deadlineRank('Choosing in Ch 8')), 'Chapter 8');
  assert.equal(chapterLabel(deadlineRank('Ch 11, 10/18–10/27')), 'Chapter 11');
  assert.equal(chapterLabel(deadlineRank('The end of Part I')), 'End of Part I');
  assert.equal(chapterLabel(deadlineRank('Moving into Part II')), 'End of Part I');
  assert.equal(chapterLabel(deadlineRank('Part II, Ch 2')), 'Part II, Chapter 2');
  assert.equal(chapterLabel(deadlineRank('Sunday each week')), 'Every week');
  assert.equal(chapterLabel(deadlineRank('Whenever')), 'Any time');
});

test('Renown and level are read from the words', () => {
  assert.equal(renownOf('Support 1, Renown 6'), 6);
  assert.equal(levelOf('Level 20 · Renown 4 · Specialty License'), 20);
  assert.equal(renownOf('Level 20 · Renown 4 · Specialty License'), 4);
  assert.equal(renownOf('Appears around 5/29.'), undefined);
});

test('things without a chapter go least Renown first, then lowest level, unknowns last', () => {
  const items = [
    { key: 'a', name: 'Recruit Goliath', needs: 'Support 3, Renown 9' },
    { key: 'b', name: 'Goliath: Brigand', needs: 'Level 20 · Renown 4 · Specialty License' },
    { key: 'c', name: 'Recruit Alexandra', needs: 'Support 1, Renown 6' },
    { key: 'd', name: 'Recruit Long', needs: 'Not known yet' },
    { key: 'e', name: 'Ninae: Fighter', needs: 'Level 5 · Renown 1' },
    { key: 'f', name: 'Ninae: Archer', needs: 'Level 22 · Renown 4' },
  ];
  assert.deepEqual(byRenownAndLevel(items).map((x) => x.key), ['e', 'b', 'f', 'c', 'a', 'd']);
});

test('a class step waits for its unit to be recruited, and recruits come first at the same Renown', () => {
  const items = [
    { key: 'class', name: 'Goliath: Brigand', needs: 'Level 20 · Renown 4', renown: 9 },
    { key: 'recruit', name: 'Recruit Goliath', needs: 'Support 3, Renown 9', first: true },
    { key: 'other', name: 'Ninae: Archer', needs: 'Level 22 · Renown 4' },
  ];
  assert.deepEqual(byRenownAndLevel(items).map((x) => x.key), ['other', 'recruit', 'class']);
});

test('groups keep the order they come in', () => {
  const g = groupInOrder([8, 8.5, 11, 11.2, 12.9], (r) => chapterLabel(r));
  assert.deepEqual(g.map((x) => [x.label, x.items.length]), [['Chapter 8', 2], ['Chapter 11', 2], ['End of Part I', 1]]);
});
