// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials } from './initials.ts';

test('small joining words are skipped', () => {
  assert.equal(initials('Inside the Deku Tree'), 'DT');
  assert.equal(initials('Temple of Time'), 'TT');
  assert.equal(initials('Bottom of the Well'), 'BW');
  assert.equal(initials('Edelgard von Hresvelg'), 'EH');
});

test('names keep their first two words', () => {
  assert.equal(initials('Forest Temple'), 'FT');
  assert.equal(initials("Inside Jabu-Jabu's Belly"), 'JB');
  assert.equal(initials('Great Deku Tree Sprout'), 'GD');
  assert.equal(initials('Mu'), 'M');
});

test('a name of only small words, or with symbols, still gets letters', () => {
  assert.equal(initials('The End'), 'E');
  assert.equal(initials('Of'), 'O');
  assert.equal(initials('The Of'), 'TO');
  assert.equal(initials('★ Silver Gauntlets'), 'SG');
  assert.equal(initials(''), '');
});
