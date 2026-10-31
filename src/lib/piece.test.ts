// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slideBand, toPath, OUTLINE, PIECE_PATH, PIECE_VIEWBOX, SNAP_PATHS, type Point } from './piece.ts';
import { PIECE_CUTOUT_PATH, PIECE_CUTOUT_SMALL_PATH } from './piece-cutout.ts';

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
const inside = (path: string) => {
  const v = PIECE_VIEWBOX, n = numbers(path);
  const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  return Math.min(...xs) >= v.x && Math.max(...xs) <= v.x + v.width && Math.min(...ys) >= v.y && Math.max(...ys) <= v.y + v.height;
};

test('the piece and its cutouts fit the view box', () => {
  for (const d of [PIECE_PATH, PIECE_CUTOUT_PATH, PIECE_CUTOUT_SMALL_PATH]) {
    assert.ok(inside(d));
    assert.ok(!d.includes('NaN'));
  }
});

test('the snap outlines have the same points as the piece, so it can move between them', () => {
  const count = (d: string) => numbers(d).length;
  assert.equal(count(SNAP_PATHS.from), count(PIECE_PATH));
  assert.equal(count(SNAP_PATHS.over), count(PIECE_PATH));
  assert.notEqual(SNAP_PATHS.from, PIECE_PATH);
  assert.ok(numbers(PIECE_PATH).length >= OUTLINE.length * 2);
});

test('the cutouts have holes: more than one ring', () => {
  const rings = (d: string) => (d.match(/M/g) ?? []).length;
  assert.ok(rings(PIECE_CUTOUT_PATH) > 7, 'one hole or more per letter');
  assert.ok(rings(PIECE_CUTOUT_SMALL_PATH) >= 2);
  assert.ok(toPath([[0, 0], [1, 1]]).endsWith('Z'));
});
