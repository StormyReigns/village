// Standouts: the default Draft sort.
//
// Score = net up-votes per unique viewer, taken at the low end of what's believable for
// how few people have seen it (the Wilson lower bound). Two votes from two viewers
// can't jump to the top, but a Draft that most of its viewers back beats an old one
// that many people saw and few backed. Same maths as public.wilson_lower in the database.

export function wilsonLower(successes: number, trials: number, z = 1.96): number {
  if (trials <= 0) return 0;
  const p = successes / trials;
  const z2 = z * z;
  const centre = p + z2 / (2 * trials);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return Math.max(0, (centre - spread) / (1 + z2 / trials));
}

export interface DraftStats {
  id: string;
  ups: number;
  downs: number;
  viewers: number;
  createdAt: string;
}

export function standoutScore(d: DraftStats): number {
  const net = Math.max(d.ups - d.downs, 0);
  const trials = Math.max(d.viewers, d.ups + d.downs);
  return wilsonLower(net, trials);
}

/** Drafts with fewer viewers than this are "still finding an audience". */
export const NEW_DRAFT_VIEWERS = 5;

/**
 * Sort by score, but keep one of the top five places for the newest Draft that hasn't
 * found an audience yet, so every Draft gets seen.
 */
export function sortStandouts<T extends DraftStats>(drafts: T[]): T[] {
  const sorted = [...drafts].sort((a, b) => standoutScore(b) - standoutScore(a) || b.createdAt.localeCompare(a.createdAt));
  const fresh = sorted
    .filter((d) => d.viewers < NEW_DRAFT_VIEWERS)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!fresh || sorted.slice(0, 5).includes(fresh)) return sorted;
  const rest = sorted.filter((d) => d !== fresh);
  const slot = Math.min(4, rest.length);
  return [...rest.slice(0, slot), fresh, ...rest.slice(slot)];
}
