// Tier lists (docs/blocks/tier-lists.md): the tiers, a player's own list, and the community tier.
// Plain and tested (tiers.test.ts); the database only stores lists and counts
// (supabase/migrations/20261109000000_tier_lists.sql).

/** One tier. The key never changes, so renaming a tier keeps every list. */
export interface Tier { key: string; label: string }

/** How a Tier list Block is set up (game_blocks.tier_setup). */
export interface TierSetup {
  /** The Block whose pieces it ranks, on the same Page. */
  ranks: string;
  /** Best first. */
  tiers: Tier[];
  /** Optional: only pieces on these routes. */
  routes?: string[];
  /** Optional: only pieces with one of these values of a tag (Group: Fiery Mane, say). */
  tag?: { key: string; values: string[] };
}

export const DEFAULT_TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D'].map((l) => ({ key: l.toLowerCase(), label: l }));

/** Lists before the community tier is settled, like every other opinion vote. */
export const MIN_LISTS = 5;

/** The longest reason on a piece. */
export const REASON_MAX = 140;

/** The tiers a setup uses: its own, or S to D. */
export const tiersOf = (setup?: Partial<TierSetup> | null): Tier[] => (setup?.tiers?.length ? setup.tiers : DEFAULT_TIERS);

/** Is this entry in the tier list, given its optional route and group limits? */
export function inLimits(e: { routes?: string[]; categories?: Record<string, string> }, setup?: Partial<TierSetup> | null): boolean {
  if (setup?.routes?.length && e.routes?.length && !e.routes.some((r) => setup.routes!.includes(r))) return false;
  if (setup?.tag?.values.length && !setup.tag.values.includes(e.categories?.[setup.tag.key] ?? '')) return false;
  return true;
}

// ---------------------------------------------------------------------------- the community tier

/** How many lists put a piece in each tier, by tier key. */
export type Counts = Record<string, number>;

export interface Community {
  /** The community's tier key, or null when nobody has placed it. */
  tier: string | null;
  /** Lists that placed it (in tiers that still exist). */
  lists: number;
  /** 5 lists or more: the tier and counts can be shown. Before that it's only "leaning". */
  settled: boolean;
}

/**
 * The median tier: the best tier that more than half the lists put it in or above. A few joke
 * lists can't drag a favorite down, and it always lands on a real tier. Counts for tiers that no
 * longer exist are left out.
 */
export function communityTier(counts: Counts | undefined, tiers: Tier[]): Community {
  const n = tiers.reduce((sum, t) => sum + (counts?.[t.key] ?? 0), 0);
  if (!n) return { tier: null, lists: 0, settled: false };
  let seen = 0;
  for (const t of tiers) {
    seen += counts?.[t.key] ?? 0;
    if (seen * 2 > n) return { tier: t.key, lists: n, settled: n >= MIN_LISTS };
  }
  return { tier: tiers[tiers.length - 1].key, lists: n, settled: n >= MIN_LISTS };
}

/** Tallies from the database ({ card_id, tier_key, lists } rows) as counts per card. */
export function countsByCard(rows: { card_id: string; tier_key: string; lists: number }[]): Map<string, Counts> {
  const out = new Map<string, Counts>();
  for (const r of rows) {
    const c = out.get(r.card_id) ?? {};
    c[r.tier_key] = (c[r.tier_key] ?? 0) + r.lists;
    out.set(r.card_id, c);
  }
  return out;
}

/** What a piece's community tier says in words: "A", "Leaning A", or nothing yet. */
export function communityText(c: Community, tiers: Tier[]): string | null {
  const label = tiers.find((t) => t.key === c.tier)?.label;
  if (!label) return null;
  return c.settled ? label : `Leaning ${label}`;
}

/** How dark a tier's letter is: the best tier in the full Page color, fading down the list. */
export const tierGoodness = (i: number, n: number) => (n <= 1 ? 1 : 1 - (i / (n - 1)) * 0.8);

// ------------------------------------------------------------------------------- your own list

/** A player's list: the pieces in each tier, in order (left is better), and their reasons. */
export interface MyList {
  rows: Record<string, string[]>;
  reasons: Record<string, string>;
}

export const EMPTY_LIST: MyList = { rows: {}, reasons: {} };

/** The tier a piece is in, or null when it's still in the tray. */
export function tierOf(list: MyList, id: string): string | null {
  for (const [k, ids] of Object.entries(list.rows)) if (ids.includes(id)) return k;
  return null;
}

/**
 * Puts a piece in a tier (at `at`, else the end of the row), or back in the tray (tier null).
 * Its reason stays with it while it's placed and goes when it returns to the tray.
 */
export function place(list: MyList, id: string, tier: string | null, at?: number): MyList {
  const rows: Record<string, string[]> = {};
  for (const [k, ids] of Object.entries(list.rows)) {
    const kept = ids.filter((x) => x !== id);
    if (kept.length) rows[k] = kept;
  }
  const reasons = { ...list.reasons };
  if (tier) {
    const row = [...(rows[tier] ?? [])];
    row.splice(at === undefined ? row.length : Math.max(0, Math.min(at, row.length)), 0, id);
    rows[tier] = row;
  } else delete reasons[id];
  return { rows, reasons };
}

/** Sets or clears a placed piece's reason (one line, at most REASON_MAX characters). */
export function setReason(list: MyList, id: string, reason: string): MyList {
  const reasons = { ...list.reasons };
  const text = reason.replace(/\s+/g, ' ').slice(0, REASON_MAX);
  if (text.trim() && tierOf(list, id)) reasons[id] = text; else delete reasons[id];
  return { ...list, reasons };
}

/** Drops pieces and tiers that are no longer there (an entry removed, a tier renamed away). */
export function tidy(list: MyList, ids: Set<string>, tiers: Tier[]): MyList {
  const keys = new Set(tiers.map((t) => t.key));
  const rows: Record<string, string[]> = {};
  for (const [k, row] of Object.entries(list.rows)) {
    const kept = keys.has(k) ? row.filter((x) => ids.has(x)) : [];
    if (kept.length) rows[k] = kept;
  }
  const placed = new Set(Object.values(rows).flat());
  const reasons = Object.fromEntries(Object.entries(list.reasons).filter(([id, r]) => placed.has(id) && r.trim()));
  return { rows, reasons };
}

/** How many pieces are placed. */
export const placedCount = (list: MyList) => Object.values(list.rows).reduce((n, r) => n + r.length, 0);

/** A list filled from the community tiers, so a player only moves the ones they disagree with. */
export function fromCommunity(ids: string[], tierFor: (id: string) => string | null): MyList {
  let list = EMPTY_LIST;
  for (const id of ids) {
    const t = tierFor(id);
    if (t) list = place(list, id, t);
  }
  return list;
}

/** The list as save_tier_list takes it: every placed piece with its card, tier and reason, in row order. */
export function toPieces(list: MyList, tiers: Tier[], cardOf: (id: string) => string | undefined) {
  return tiers.flatMap((t) => (list.rows[t.key] ?? []).map((id) => {
    const card = cardOf(id);
    if (!card) return null;
    const reason = list.reasons[id]?.trim();
    return reason ? { card, tier: t.key, reason } : { card, tier: t.key };
  }).filter((p): p is NonNullable<typeof p> => Boolean(p)));
}

/** A saved list (tier_placements rows, by card) back as a MyList, by entry id. */
export function fromPlacements(rows: { card_id: string; tier_key: string; position: number; reason: string | null }[], idOf: (card: string) => string | undefined): MyList {
  let list = EMPTY_LIST;
  for (const r of [...rows].sort((a, b) => a.position - b.position)) {
    const id = idOf(r.card_id);
    if (!id) continue;
    list = place(list, id, r.tier_key);
    if (r.reason) list = setReason(list, id, r.reason);
  }
  return list;
}

/** Reads a list kept on the device; anything unreadable is an empty list. */
export function readList(raw: string | null): MyList {
  try {
    const v = JSON.parse(raw ?? '');
    if (!v || typeof v !== 'object' || typeof v.rows !== 'object') return EMPTY_LIST;
    const rows: Record<string, string[]> = {};
    for (const [k, ids] of Object.entries(v.rows as Record<string, unknown>)) {
      if (Array.isArray(ids)) rows[k] = ids.filter((x): x is string => typeof x === 'string');
    }
    const reasons: Record<string, string> = {};
    for (const [k, r] of Object.entries((v.reasons ?? {}) as Record<string, unknown>)) if (typeof r === 'string') reasons[k] = r.slice(0, REASON_MAX);
    return { rows, reasons };
  } catch { return EMPTY_LIST; }
}
