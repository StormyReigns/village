// The real map of a Places Block (docs/blocks/world.md): a picture Builders choose, and a pin
// for each place. Plain helpers, tested in world-map.test.ts.
//
// Neither the picture nor the pins are checked by the database (moderators write the Block's
// `map` directly, and an entry's content is free-form), so everything that shows them reads
// them through `mapOf` and `spotOf` here.

import type { Block, BlockMap, EntryContent } from '../data/pages/types.ts';
import { isPicturePath } from './guides.ts';

/** Where map pictures live (supabase/migrations/20261110000000_world_map.sql). */
export const MAP_PICTURES = 'map-pictures';

/** How big a map picture is kept, on its longer side. Maps get zoomed into, so bigger than
 *  other pictures (1600), within the bucket's 10 MB. */
export const MAP_MAX_SIDE = 4096;

/** The longest credit line ("Map: Game8", "Drawn by stormyreigns"). */
export const CREDIT_MAX = 80;

const whole = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 20000;

/** The Block's map picture, if it has a real one: a path to one of our uploads (never a web
 *  address), a sensible size, and a short credit. Anything else counts as no map. */
export function mapOf(block: Pick<Block, 'map'>): BlockMap | null {
  const m = block.map as Partial<BlockMap> | null | undefined;
  if (!m || typeof m !== 'object' || typeof m.picture !== 'string' || !isPicturePath(m.picture)) return null;
  if (!whole(m.w) || !whole(m.h)) return null;
  const credit = typeof m.credit === 'string' ? m.credit.replace(/\s+/g, ' ').trim().slice(0, CREDIT_MAX) : '';
  return { picture: m.picture, w: Math.round(m.w as number), h: Math.round(m.h as number), ...(credit ? { credit } : {}) };
}

/** A pin's spot, kept to the picture: two finite numbers, each 0 to 100. Anything else is no pin. */
export function cleanSpot(spot: unknown): { x: number; y: number } | undefined {
  if (!spot || typeof spot !== 'object') return undefined;
  const { x, y } = spot as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const keep = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
  return { x: keep(x), y: keep(y) };
}

/** Where a place's pin sits, or null when it isn't on the map. */
export const spotOf = (e: Pick<EntryContent, 'spot'>) => cleanSpot(e.spot) ?? null;

/** "What changes" for a pin, in words: null when it didn't move. */
export function spotChange(before: unknown, after: unknown): { before?: string; after?: string } | null {
  const a = cleanSpot(before), b = cleanSpot(after);
  if (!a && !b) return null;
  if (a && b && a.x === b.x && a.y === b.y) return null;
  if (!a) return { after: 'Put on the map' };
  if (!b) return { before: 'On the map', after: 'Taken off the map' };
  return { before: 'On the map', after: 'Moved on the map' };
}

// ---------------------------------------------------------------- Moving and zooming
// The picture is drawn at its own size, then moved (x, y: where its top-left corner sits in the
// frame, in pixels) and scaled. A spot at (sx, sy) percent shows at
//   x + sx / 100 * w * scale,  y + sy / 100 * h * scale.

export interface View { x: number; y: number; scale: number }
export interface Size { w: number; h: number }

/** The scale that shows the whole picture in the frame. */
export const fitScale = (frame: Size, pic: Size) => Math.min(frame.w / pic.w, frame.h / pic.h);

/** The most zoomed in: the picture's own pixels shown three times over, and never less than
 *  four times the fitted size, so small pictures still zoom. */
export const maxScale = (frame: Size, pic: Size) => Math.max(3, fitScale(frame, pic) * 4);

/** The whole picture, centered. */
export function fitView(frame: Size, pic: Size): View {
  const scale = fitScale(frame, pic);
  return { scale, x: (frame.w - pic.w * scale) / 2, y: (frame.h - pic.h * scale) / 2 };
}

/** Keeps the view sensible: zoomed between the fitted size and the most, and the picture never
 *  dragged out of the frame (centered on a side where it's smaller than the frame). */
export function clampView(v: View, frame: Size, pic: Size): View {
  const scale = Math.min(maxScale(frame, pic), Math.max(fitScale(frame, pic), v.scale));
  const along = (pos: number, frameLen: number, len: number) =>
    len <= frameLen ? (frameLen - len) / 2 : Math.min(0, Math.max(frameLen - len, pos));
  return { scale, x: along(v.x, frame.w, pic.w * scale), y: along(v.y, frame.h, pic.h * scale) };
}

/** Zooms by `factor` around a point of the frame (a pinch's middle, the mouse), keeping that
 *  point of the picture under it. */
export function zoomAt(v: View, factor: number, at: { x: number; y: number }, frame: Size, pic: Size): View {
  const scale = Math.min(maxScale(frame, pic), Math.max(fitScale(frame, pic), v.scale * factor));
  const k = scale / v.scale;
  return clampView({ scale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k }, frame, pic);
}

/** Where a spot shows in the frame, in pixels. */
export const spotToFrame = (s: { x: number; y: number }, v: View, pic: Size) =>
  ({ x: v.x + (s.x / 100) * pic.w * v.scale, y: v.y + (s.y / 100) * pic.h * v.scale });

/** The spot under a point of the frame (a Builder's tap), or undefined when it's off the picture. */
export function frameToSpot(p: { x: number; y: number }, v: View, pic: Size) {
  const x = ((p.x - v.x) / (pic.w * v.scale)) * 100, y = ((p.y - v.y) / (pic.h * v.scale)) * 100;
  return x < 0 || x > 100 || y < 0 || y > 100 ? undefined : cleanSpot({ x, y });
}

/** Centers the view on a spot at a given scale (a link to a pin, "show it on the map"). */
export const centerOn = (s: { x: number; y: number }, scale: number, frame: Size, pic: Size): View =>
  clampView({ scale, x: frame.w / 2 - (s.x / 100) * pic.w * scale, y: frame.h / 2 - (s.y / 100) * pic.h * scale }, frame, pic);

// ---------------------------------------------------------------- Pins that would touch
// Pieces never touch, so pins closer than `gap` pixels on screen become one count ("3"), which
// zooms in on them when tapped.

export interface Pin { id: string; x: number; y: number }
export interface PinGroup { ids: string[]; x: number; y: number }

/** Groups pins (in frame pixels) that sit closer than `gap`, in the order given. A group sits at
 *  the middle of its pins. */
export function groupPins(pins: Pin[], gap: number): PinGroup[] {
  const groups: { ids: string[]; xs: number[]; ys: number[]; x: number; y: number }[] = [];
  for (const p of pins) {
    const near = groups.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < gap);
    if (near) {
      near.ids.push(p.id); near.xs.push(p.x); near.ys.push(p.y);
      near.x = near.xs.reduce((a, b) => a + b, 0) / near.xs.length;
      near.y = near.ys.reduce((a, b) => a + b, 0) / near.ys.length;
    } else groups.push({ ids: [p.id], xs: [p.x], ys: [p.y], x: p.x, y: p.y });
  }
  return groups.map(({ ids, x, y }) => ({ ids, x, y }));
}
