// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slideBand, toPath, PIECE_PATH, PIECE_PLAIN_PATH, PIECE_VIEWBOX, type Point } from './piece.ts';

test('sliding a band steps a square out on both sides', () => {
  const square: Point[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
  assert.deepEqual(slideBand(square, { top: 50, bottom: 66, shift: 16 }), [
    [0, 0], [100, 0], [100, 50], [116, 50], [116, 66], [100, 66], [100, 100], [0, 100],
    [0, 66], [16, 66], [16, 50], [0, 50],
  ]);
});

test('an outline with nothing in the band is left alone', () => {
  const low: Point[] = [[0, 70], [10, 70], [10, 80]];
  assert.deepEqual(slideBand(low, { top: 50, bottom: 66, shift: 16 }), low);
});

const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

test('the piece fits its view box with room to spare', () => {
  const v = PIECE_VIEWBOX;
  const n = numbers(PIECE_PATH);
  const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...xs) >= v.x && Math.max(...xs) <= v.x + v.width, 'x inside');
  assert.ok(Math.min(...ys) >= v.y && Math.max(...ys) <= v.y + v.height, 'y inside');
  assert.equal(Math.max(...xs), 216, 'the right tab, slid by the slice, reaches 216');
});

test('the slice changes the outline and nothing is lost', () => {
  assert.notEqual(PIECE_PATH, PIECE_PLAIN_PATH);
  assert.ok(!PIECE_PATH.includes('NaN'));
  assert.ok(toPath([[0, 0], [1, 1]]).endsWith('Z'));
});
