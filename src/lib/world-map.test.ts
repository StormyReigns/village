// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSpot, clampView, fitView, frameToSpot, groupPins, mapOf, spotChange, spotOf, spotToFrame, zoomAt } from './world-map.ts';

const U = '0b8d7c5e-1f2a-4b3c-9d4e-5f6a7b8c9d0e';
const PATH = `fortunes-weave/${U}/${U}.webp`;

test('a map is only one of our uploads, with a sensible size and a short credit', () => {
  assert.deepEqual(mapOf({ map: { picture: PATH, w: 4096, h: 3000, credit: '  Map:   Game8 ' } }), { picture: PATH, w: 4096, h: 3000, credit: 'Map: Game8' });
  assert.equal(mapOf({ map: { picture: 'https://evil.example/map.png', w: 10, h: 10 } }), null);
  assert.equal(mapOf({ map: { picture: `../${PATH}`, w: 10, h: 10 } }), null);
  assert.equal(mapOf({ map: { picture: PATH, w: 0, h: 10 } }), null);
  assert.equal(mapOf({ map: { picture: PATH, w: Number.NaN, h: 10 } }), null);
  assert.equal(mapOf({}), null);
  assert.equal(mapOf({ map: { picture: PATH, w: 10, h: 10, credit: 'x'.repeat(200) } })?.credit?.length, 80);
});

test('a pin is two finite numbers kept to 0–100, rounded to a tenth', () => {
  assert.deepEqual(cleanSpot({ x: 42.123, y: 61.98 }), { x: 42.1, y: 62 });
  assert.deepEqual(cleanSpot({ x: -5, y: 140 }), { x: 0, y: 100 });
  assert.equal(cleanSpot({ x: '4', y: 5 }), undefined);
  assert.equal(cleanSpot({ x: Infinity, y: 5 }), undefined);
  assert.equal(cleanSpot([1, 2]), undefined);
  assert.equal(cleanSpot(null), undefined);
  assert.equal(spotOf({}), null);
});

test('"What changes" says what happened to the pin', () => {
  assert.equal(spotChange(undefined, undefined), null);
  assert.equal(spotChange({ x: 1, y: 2 }, { x: 1, y: 2 }), null);
  assert.deepEqual(spotChange(undefined, { x: 1, y: 2 }), { after: 'Put on the map' });
  assert.deepEqual(spotChange({ x: 1, y: 2 }, { x: 3, y: 2 }), { before: 'On the map', after: 'Moved on the map' });
  assert.deepEqual(spotChange({ x: 1, y: 2 }, undefined), { before: 'On the map', after: 'Taken off the map' });
});

test('fitting, zooming and dragging keep the picture in the frame', () => {
  const frame = { w: 400, h: 300 }, pic = { w: 2000, h: 1000 };
  const fit = fitView(frame, pic);
  assert.equal(fit.scale, 0.2);
  assert.deepEqual(fit, { scale: 0.2, x: 0, y: 50 });
  // Can't zoom out past the whole picture, or drag it away.
  assert.deepEqual(clampView({ scale: 0.01, x: 999, y: -999 }, frame, pic), fit);
  // Zooming around a point keeps that point of the picture under it.
  const z = zoomAt(fit, 2, { x: 200, y: 150 }, frame, pic);
  assert.equal(z.scale, 0.4);
  const before = { x: (200 - fit.x) / fit.scale, y: (150 - fit.y) / fit.scale };
  assert.deepEqual({ x: (200 - z.x) / z.scale, y: (150 - z.y) / z.scale }, before);
});

test('a tap lands on the spot under it, and spots show where they sit', () => {
  const pic = { w: 1000, h: 500 }, v = { x: 10, y: 20, scale: 0.5 };
  assert.deepEqual(frameToSpot({ x: 260, y: 145 }, v, pic), { x: 50, y: 50 });
  assert.deepEqual(spotToFrame({ x: 50, y: 50 }, v, pic), { x: 260, y: 145 });
  assert.equal(frameToSpot({ x: 5, y: 145 }, v, pic), undefined);
});

test('pins that would touch become one group at their middle', () => {
  const g = groupPins([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 0 }, { id: 'c', x: 100, y: 100 }], 30);
  assert.deepEqual(g, [{ ids: ['a', 'b'], x: 5, y: 0 }, { ids: ['c'], x: 100, y: 100 }]);
});
