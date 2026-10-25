// The Village piece: a cut-corner block with dovetail sockets on the top and left and tabs
// on the bottom and right, with one band through the middle slid to the right (the slice).
// Worked out once as a single plain outline, with no clip masks, so it draws the same in the
// app, in share images and in icons, and any number of pieces can sit on one page.

/** The body is 180 x 132 piece units; tabs stick out 20 more on the bottom and right. */
export const PIECE = { width: 180, height: 132, corner: 30, tab: 20 } as const;

/** The slice: this band of the piece slides right by `shift`. The same on every piece. */
export const SLICE = { top: 50, bottom: 66, shift: 16 } as const;

/** Room for the tabs, the slide and an outline's stroke. */
export const PIECE_VIEWBOX = { x: -8, y: -8, width: 232, height: 168 } as const;

/**
 * Where initials or a symbol go: the middle of the body below the slice, as fractions of
 * the view box. Text there never crosses the band or the socket on the left.
 */
export const PIECE_SPOT = {
  x: (PIECE.width / 2 - PIECE_VIEWBOX.x) / PIECE_VIEWBOX.width,
  y: (94 - PIECE_VIEWBOX.y) / PIECE_VIEWBOX.height,
} as const;

export type Point = [number, number];

/** The corners of the piece, each with how much to round it: [x, y, radius]. */
function corners(): [number, number, number][] {
  const { width: W, height: H, corner: c, tab: d } = PIECE;
  const cx = W / 2, cy = H / 2, neck = 11, flare = 19, j = 4, q = 2;
  return [
    [0, c, j], [c, 0, j],
    [cx - neck, 0, q], [cx - flare, d, q], [cx + flare, d, q], [cx + neck, 0, q],
    [W - c, 0, j], [W, c, j],
    [W, cy - neck, q], [W + d, cy - flare, q], [W + d, cy + flare, q], [W, cy + neck, q],
    [W, H - c, j], [W - c, H, j],
    [cx + neck, H, q], [cx + flare, H + d, q], [cx - flare, H + d, q], [cx - neck, H, q],
    [c, H, j], [0, H - c, j],
    [0, cy + neck, q], [d, cy + flare, q], [d, cy - flare, q], [0, cy - neck, q],
  ];
}

/** Round each corner with a short curve, drawn as a few straight steps. */
function rounded(points: [number, number, number][], steps = 4): Point[] {
  const out: Point[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i - 1 + n) % n], [x, y, r] = points[i], [nx, ny] = points[(i + 1) % n];
    const l1 = Math.hypot(px - x, py - y), l2 = Math.hypot(nx - x, ny - y);
    const t = Math.min(r, l1 / 2, l2 / 2);
    if (t <= 0) { out.push([x, y]); continue; }
    const a: Point = [x + (px - x) / l1 * t, y + (py - y) / l1 * t];
    const b: Point = [x + (nx - x) / l2 * t, y + (ny - y) / l2 * t];
    for (let s = 0; s <= steps; s++) {
      const u = s / steps, v = 1 - u;
      out.push([v * v * a[0] + 2 * v * u * x + u * u * b[0], v * v * a[1] + 2 * v * u * y + u * u * b[1]]);
    }
  }
  return out;
}

/**
 * Slide one band of an outline sideways. Every point inside the band moves right; where an
 * edge crosses the band's top or bottom, the outline takes a small sideways step. Filled
 * with the default rule, the result looks exactly like the band was cut out and slid.
 */
export function slideBand(outline: Point[], band: { top: number; bottom: number; shift: number } = SLICE): Point[] {
  const zone = (y: number) => (y < band.top ? 0 : y < band.bottom ? 1 : 2);
  const dx = (z: number) => (z === 1 ? band.shift : 0);
  const out: Point[] = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = outline[i], [x2, y2] = outline[(i + 1) % n];
    out.push([x1 + dx(zone(y1)), y1]);
    // Each boundary line this edge crosses, in the order it meets them.
    const down = y2 > y1;
    const lines = [band.top, band.bottom].filter((ly) => (y1 < ly) !== (y2 < ly));
    if (!down) lines.reverse();
    for (const ly of lines) {
      const x = x1 + (x2 - x1) * (ly - y1) / (y2 - y1);
      const above = dx(zone(ly - 1e-6)), below = dx(zone(ly));
      out.push(down ? [x + above, ly] : [x + below, ly], down ? [x + below, ly] : [x + above, ly]);
    }
  }
  return out;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** An outline as an SVG path. */
export function toPath(points: Point[]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ') + ' Z';
}

/** The piece without the slice (for tests and comparisons). */
export const PIECE_PLAIN_PATH = toPath(rounded(corners()));

/** The piece as everyone sees it: with the slice. */
export const PIECE_PATH = toPath(slideBand(rounded(corners())));
