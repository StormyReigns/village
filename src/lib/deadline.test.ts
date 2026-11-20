// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVERY_WEEK, NO_DEADLINE, deadlineRank, earliest } from './deadline.ts';

test('a chapter in the text is the rank, with its date breaking ties', () => {
  assert.ok(deadlineRank('Choosing in Ch 8') < deadlineRank('Ch 11, 10/18–10/27'));
  assert.ok(deadlineRank('Ch 11, 10/5–10/17') < deadlineRank('Ch 11, 10/18–10/27'));
  assert.ok(deadlineRank('Part I, Ch 9 on that route') >= 9 && deadlineRank('Part I, Ch 9 on that route') < 10);
});

test('the end of Part I comes after its last chapter, before Part II', () => {
  assert.ok(deadlineRank('The end of Part I') > deadlineRank('Ch 12, 10/18–10/27'));
  assert.ok(deadlineRank('Moving into Part II') > deadlineRank('Ch 12, 10/18–10/27'));
  assert.ok(deadlineRank('Moving into Part II') < deadlineRank('Part II, Ch 1'));
  assert.ok(deadlineRank('Part II, Ch 6') < deadlineRank('Part III, Ch 1'));
});

test('weekly things and undated text sort last', () => {
  assert.equal(deadlineRank('Sunday each week'), EVERY_WEEK);
  assert.equal(deadlineRank('Whenever you like'), NO_DEADLINE);
  assert.equal(deadlineRank(undefined), NO_DEADLINE);
  assert.ok(deadlineRank('Whenever you like') < deadlineRank('Sunday each week'));
});

test('a deadline that differs by route ranks by its earliest', () => {
  assert.equal(earliest(['Ch 11, 9/17–9/22', 'Ch 9, 9/17–9/19']), deadlineRank('Ch 9, 9/17–9/19'));
  assert.equal(earliest([]), NO_DEADLINE);
});

test("every Fortune's Weave last chance gets a place before the weekly reset", async () => {
  const { CARDS } = await import('../data/content/fortunes-weave.ts');
  for (const c of CARDS.filter((x) => x.block === 'missables')) {
    const lines = (c.content.before ?? '').split('\n').map((l) => l.replace(/^(Cai|Dietrich|Theodora|Leda): /, ''));
    const r = earliest(lines);
    assert.ok(r < NO_DEADLINE || r === EVERY_WEEK || /week/i.test(c.content.before ?? ''), `no chapter in "${c.content.before}"`);
  }
});

test('a choose-one last chance lists its options and who each helps', async () => {
  const { choiceOptions, helpsWho } = await import('./deadline.ts');
  const opts = choiceOptions('"A Letter of Some Gravity" leads to the Haze Badge. "For the Empire\'s Safety" gives a Specialty License. You can only do one chain per route.');
  assert.deepEqual(opts, [{ name: 'A Letter of Some Gravity', gives: 'Haze Badge' }, { name: "For the Empire's Safety", gives: 'Specialty License' }]);
  assert.deepEqual(choiceOptions('Finish "My Late Sister\'s Accessory" (the Violet Brooch from Axion Gorge).'), [], 'one quest is not a choice');
  assert.deepEqual(helpsWho('Specialty License', { Specialty: ['Goliath', 'Ninae'], Advanced: ['Fabio'] }), ['Goliath', 'Ninae']);
  assert.deepEqual(helpsWho('Haze Badge', {}, { 'goods.haze-badge': ['Fabio'] }), ['Fabio']);
  assert.deepEqual(helpsWho('Haze Badge'), []);
});
