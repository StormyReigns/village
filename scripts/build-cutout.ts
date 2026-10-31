// Cuts "village" (and a lone "v" for small pieces) out of the piece, with the wordmark's
// slice, and writes the results to src/lib/piece-cutout.ts as plain paths. Rerun it if the
// piece's outline changes: node scripts/build-cutout.ts
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
import polygonClipping from 'polygon-clipping';
import { OUTLINE, type Point } from '../src/lib/piece.ts';

const font = opentype.parse(readFileSync(new URL('../src/lib/og-fonts/Rubik-ExtraBold.ttf', import.meta.url)).buffer);
const CENTER = 884;

/** A curve or line as straight steps. */
function flatten(path: opentype.Path): Point[][] {
  const rings: Point[][] = [];
  let ring: Point[] = [], at: Point = [0, 0];
  const steps = 5;
  for (const c of path.commands) {
    if (c.type === 'M') { if (ring.length) rings.push(ring); ring = [[c.x, c.y]]; at = [c.x, c.y]; }
    else if (c.type === 'L') { ring.push([c.x, c.y]); at = [c.x, c.y]; }
    else if (c.type === 'Q') {
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        ring.push([u * u * at[0] + 2 * u * t * c.x1 + t * t * c.x, u * u * at[1] + 2 * u * t * c.y1 + t * t * c.y]);
      }
      at = [c.x, c.y];
    } else if (c.type === 'C') {
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        ring.push([
          u * u * u * at[0] + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * at[1] + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
      at = [c.x, c.y];
    } else if (c.type === 'Z') { if (ring.length) rings.push(ring); ring = []; }
  }
  if (ring.length) rings.push(ring);
  return rings;
}

/**
 * The word, set like the Wordmark (Rubik ExtraBold, pulled in 0.03em) and centred, with its
 * middle band (52% to 64% of the line) slid right by 0.09em.
 */
type Poly = polygonClipping.Polygon;
type Multi = polygonClipping.MultiPolygon;

function word(text: string, size: number, baseline: number): Multi {
  const scale = size / font.unitsPerEm, track = -0.03 * size;
  const glyphs = font.stringToGlyphs(text);
  const width = glyphs.reduce((w, g) => w + (g.advanceWidth ?? 0) * scale + track, -track);
  const asc = font.ascender / font.unitsPerEm, desc = -font.descender / font.unitsPerEm;
  const top = baseline - (asc + (1 - asc - desc) / 2) * size;
  // A letter's rings XOR together (its holes stay holes), then the letters are joined.
  let x = CENTER - width / 2;
  const letters: Multi[] = [];
  for (const g of glyphs) {
    letters.push(polygonClipping.xor(...(flatten(g.getPath(x, baseline, size)).map((r) => [r]) as [Poly, ...Poly[]])));
    x += (g.advanceWidth ?? 0) * scale + track;
  }
  const ink = polygonClipping.union(...(letters as [Multi, ...Multi[]]));
  // The slice: cut the band out of the letters, slide it right and put it back.
  const a = top + 0.52 * size, b = top + 0.64 * size, shift = 0.09 * size;
  const strip = (y1: number, y2: number): Poly => [[[0, y1], [1800, y1], [1800, y2], [0, y2]]];
  const band = polygonClipping.intersection(ink, strip(a, b))
    .map((poly) => poly.map((ring) => ring.map(([px, py]) => [px + shift, py] as Point)));
  return polygonClipping.union(polygonClipping.difference(ink, strip(a, b)), band);
}

/** Whole numbers are plenty at this scale and keep the path short. */
const ringPath = (ring: Point[]) => ring.slice(0, -1).map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x)} ${Math.round(y)}`).join('') + 'Z';

/** The outline minus the letters, as one path (holes and all, default fill rule). */
function cutout(letters: Multi): string {
  const result = polygonClipping.difference([OUTLINE], letters);
  return result.flatMap((poly) => poly.map((ring) => ringPath(ring as Point[]))).join('');
}

const full = cutout(word('village', 420, 1060));
const small = cutout(word('v', 900, 1240));

writeFileSync(new URL('../src/lib/piece-cutout.ts', import.meta.url), `// Made by scripts/build-cutout.ts: the piece with "village" cut out (and a lone "v" for
// small pieces), slice and all. Don't edit by hand; rerun the script.

/** The piece with "village" cut out, for pieces with nothing on them. */
export const PIECE_CUTOUT_PATH = '${full}';

/** The piece with just "v" cut out, for pieces under CUTOUT_WORD_FROM wide. */
export const PIECE_CUTOUT_SMALL_PATH = '${small}';

/** The word reads from this width (px) up; below it a lone "v" is cut out instead. */
export const CUTOUT_WORD_FROM = 64;
`);
console.log('village', full.length, 'chars; v', small.length, 'chars');
