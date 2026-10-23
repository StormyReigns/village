// Village titles and badges, from the Village Rewards doc
// (https://claude.ai/code/artifact/441b94bc-cc93-46a7-952d-da63d5684254).
// A title has two parts: tenure (from active weeks) and role (from harvests).
// A harvest is a Draft that reached the app. At launch, sizes don't affect rank.

export interface Step { name: string; at: number; note: string }

export const TENURE: Step[] = [
  { name: 'New', at: 0, note: 'Everyone starts here.' },
  { name: 'Settled', at: 4, note: 'About a month of active weeks.' },
  { name: 'Seasoned', at: 26, note: 'About half a year. Counts toward the reviewer role.' },
  { name: 'Elder', at: 52, note: 'A year of active weeks. Recognition only.' },
];

export const ROLE: Step[] = [
  { name: 'Villager', at: 0, note: 'Everyone starts here.' },
  { name: 'Builder', at: 1, note: 'Your first change is in the app.' },
  { name: 'Artisan', at: 5, note: 'Five changes in the app.' },
  { name: 'Architect', at: 15, note: 'Fifteen changes. Architects can run Village Projects.' },
  { name: 'Keeper', at: 40, note: 'Forty changes. Every 25 more adds a star.' },
];

/** Small pips that fill on the way to the next role. */
const PIPS: Record<string, number[]> = { Villager: [], Builder: [2, 3], Artisan: [8, 11], Architect: [23, 31], Keeper: [] };

/** Where someone stands on a ladder: their step, the next one, and progress toward it. */
export function standing(ladder: Step[], value: number) {
  let i = 0;
  while (i + 1 < ladder.length && value >= ladder[i + 1].at) i++;
  const now = ladder[i], next = ladder[i + 1];
  const progress = next ? (value - now.at) / (next.at - now.at) : 1;
  return { now, next, progress: Math.max(0, Math.min(1, progress)) };
}

/** The pips between the current role and the next, and which are filled. */
export function pips(role: string, harvests: number) {
  return (PIPS[role] ?? []).map((at) => ({ at, filled: harvests >= at }));
}

/** Keeper stars: one for every 25 harvests past 40. */
export const keeperStars = (harvests: number) => (harvests >= 65 ? Math.floor((harvests - 40) / 25) : 0);

/** A game badge's leaves (its game rank): 1, 5, 15 and 40 harvests in that game. */
export const leaves = (harvests: number) => [1, 5, 15, 40].filter((n) => harvests >= n).length;

/** Distinct weeks (Monday to Sunday) in a list of times: the "active weeks" of tenure. */
export function activeWeeks(times: string[]) {
  const week = 7 * 24 * 60 * 60 * 1000, monday = 4 * 24 * 60 * 60 * 1000; // 1 Jan 1970 was a Thursday
  return new Set(times.map((t) => Math.floor((new Date(t).getTime() - monday) / week))).size;
}
