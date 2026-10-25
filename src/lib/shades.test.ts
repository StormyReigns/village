// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHADES, shadeHex, shadeVars } from './shades.ts';

const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('white text stays readable on every shaded piece, and ink on every field', () => {
  for (const [shade, set] of Object.entries(SHADES)) {
    for (const [tint, [solid, field]] of Object.entries(set.colors)) {
      assert.ok(contrast(solid, '#ffffff') >= 4.5, `${shade} ${tint}: white on ${solid}`);
      assert.ok(contrast('#15171c', field) >= 4.5, `${shade} ${tint}: ink on ${field}`);
    }
  }
});

test('the standard shade changes nothing; others set every Page color and the corners', () => {
  assert.deepEqual(shadeVars(), {});
  assert.deepEqual(shadeVars('standard'), {});
  const vars = shadeVars('fantasy');
  for (const t of ['berry', 'sun', 'plum', 'sky', 'teal', 'leaf']) assert.ok(vars[`--${t}`] && vars[`--${t}-soft`], t);
  assert.ok(vars['--radius-2xl']);
  assert.equal(shadeHex('berry'), '#c23a5c');
  assert.equal(shadeHex('berry', 'fantasy'), SHADES.fantasy.colors.berry[0]);
});
