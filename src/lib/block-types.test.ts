// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retypeProblem, typeName } from './block-types.ts';

const empty = { id: 'foes', type: 'collection' as const, title: 'Foes', entries: [] };

test('an empty Block can change its type', () => {
  assert.equal(retypeProblem(empty, []), null);
  assert.equal(typeName('items'), 'an Items');
  assert.equal(typeName('collection'), 'a Collection');
});

test("a Block with entries, a Tier list or Planner, or one they use, keeps its type", () => {
  assert.match(retypeProblem({ ...empty, entries: [{ id: 'x', name: 'Keese', sections: [], categories: {} }] }, []) ?? '', /has entries/);
  assert.match(retypeProblem({ ...empty, type: 'planner' }, []) ?? '', /Planner/);
  assert.match(retypeProblem(empty, [{ id: 'tiers', tierSetup: { ranks: 'foes', tiers: [] } }]) ?? '', /uses Foes/);
  assert.match(retypeProblem(empty, [{ id: 'party', planSetup: { roster: 'units', slots: [{ key: 'w', label: 'Weapon', from: 'foes' }] } }]) ?? '', /uses Foes/);
});

test('a map Block keeps its type', () => {
  assert.match(retypeProblem({ ...empty, look: 'map' }, []) ?? '', /map Block/);
});
