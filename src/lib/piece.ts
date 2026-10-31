// The Village piece: the outline of the logo, the house in its ring of five genre tiles, as
// one flat shape in one color. Worked out once as a single plain outline, with no clip masks,
// so it draws the same in the app, in share images and in icons, and any number of pieces
// can sit on one page. A piece with nothing on it shows "village" cut out of it
// (`piece-cutout.ts`, made by `scripts/build-cutout.ts`).

export type Point = [number, number];

/** Matt's silhouette of the logo (logo-silhouette-*.svg), in the logo picture's units. */
export const OUTLINE: Point[] = [
  [1295, 74], [1278, 72], [1250, 78], [1146, 136], [1087, 93], [1035, 76], [1002, 75], [970, 80], [906, 107], [904, 68],
  [898, 54], [886, 42], [872, 34], [850, 29], [825, 30], [803, 37], [784, 52], [775, 72], [774, 334], [765, 340],
  [762, 334], [762, 240], [752, 216], [741, 206], [523, 82], [499, 73], [483, 72], [463, 77], [212, 210], [170, 236],
  [153, 260], [89, 506], [87, 539], [103, 605], [111, 620], [128, 636], [217, 685], [250, 699], [265, 697], [276, 689],
  [293, 645], [300, 637], [314, 637], [330, 646], [329, 658], [278, 705], [275, 796], [258, 804], [246, 802], [237, 788],
  [230, 748], [220, 740], [206, 739], [112, 784], [90, 806], [83, 825], [30, 1069], [31, 1088], [45, 1134], [59, 1159],
  [90, 1184], [354, 1346], [382, 1348], [392, 1345], [466, 1298], [474, 1355], [486, 1374], [501, 1388], [825, 1570], [850, 1575],
  [878, 1572], [901, 1562], [1210, 1387], [1236, 1358], [1243, 1334], [1246, 1298], [1340, 1359], [1356, 1363], [1385, 1360], [1695, 1170],
  [1711, 1151], [1732, 1090], [1733, 1064], [1682, 825], [1675, 808], [1650, 785], [1550, 742], [1539, 743], [1528, 752], [1520, 797],
  [1512, 807], [1499, 810], [1481, 802], [1478, 717], [1473, 709], [1432, 680], [1431, 659], [1449, 649], [1459, 648], [1469, 656],
  [1477, 681], [1486, 693], [1499, 699], [1514, 698], [1635, 633], [1659, 605], [1676, 535], [1675, 510], [1608, 257], [1600, 243],
  [1579, 225],
];

/** The silhouette with a little room around it for an outline's stroke. */
export const PIECE_VIEWBOX = { x: 0, y: 0, width: 1772, height: 1610 } as const;

/**
 * Where initials or a symbol go: the middle of the body, as fractions of the view box.
 */
export const PIECE_SPOT = { x: 884 / PIECE_VIEWBOX.width, y: 860 / PIECE_VIEWBOX.height } as const;

/** The slice for the snap: this band slides back into place when a piece turns solid. */
export const SLICE = { top: 860, bottom: 1000, shift: 120 } as const;

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

/** The piece as everyone sees it. Drawn through `slideBand` with no slide, so it has the
 *  same points as the snap outlines and can move smoothly between them. */
export const PIECE_PATH = toPath(slideBand(OUTLINE, { ...SLICE, shift: 0 }));

/** The band slid out, and slid a little past home the other way: the snap runs between them. */
export const SNAP_PATHS = {
  from: toPath(slideBand(OUTLINE)),
  over: toPath(slideBand(OUTLINE, { ...SLICE, shift: -SLICE.shift * 0.4 })),
} as const;

/** The piece as a CSS mask, for cutting a picture to its shape (no ids needed). */
export const PIECE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${PIECE_VIEWBOX.x} ${PIECE_VIEWBOX.y} ${PIECE_VIEWBOX.width} ${PIECE_VIEWBOX.height}"><path d="${PIECE_PATH}"/></svg>`,
)}")`;
