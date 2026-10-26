// Starter weapons and magic for Fortune's Weave, from a player-made stat table (a heatmap
// shared in the community, Oct 2026). Numbers as the table gave them; our own wording.

import type { Entry, StatDef } from './types.ts';

export const WEAPON_STATS: StatDef[] = [
  { key: 'might', label: 'Might', better: 'high' },
  { key: 'hit', label: 'Hit', better: 'high' },
  { key: 'weight', label: 'Weight', better: 'low' },
  { key: 'crit', label: 'Crit', better: 'high' },
];

const SOURCE = "A player-made weapon table shared in the community (Oct 2026). Know who made it? Tell us so we can credit them.";

const slug = (s: string) => s.toLowerCase().replace(/\+/g, 'plus ').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

// Rank (as the table lists it; "-" has none), name, Might, Hit, Weight, Crit, effect, note.
type Row = [string, string, number, number, number, number, string?, string?];

const ROWS: Row[] = [
  ['C', 'Levin Sword +1', 14, 70, 8, 0],
  ['C', 'Levin Sword +3', 20, 70, 8, 0],
  ['E', 'Salamander +5', 21, 85, 3, 0],
  ['D–C', 'Blizzard', 4, 80, 6, 5],
  ['D–C', 'Fire', 3, 90, 5, 0],
  ['D–C', 'Thunder', 5, 75, 7, 0],
  ['D–C', 'Wind', 3, 100, 3, 0],
  ['D–C', 'Miasma', 5, 80, 5, 0, '', 'Only Fabio can use it.'],
  ['D–C', 'Nosferatu', 1, 80, 8, 0, 'Heals you for half the damage dealt.'],
  ['C', "Earth's Jaws", 17, 90, 25, 0, 'Range 3–10.', 'Only Anatolia can use it.'],
  ['C', 'Mire', 3, 70, 15, 0, 'Range 1–3.'],
  ['C–B', 'Seraphim', 10, 75, 10, 0, 'Extra damage against Undead.'],
  ['C', 'Sword of Judgment', 6, 80, 10, 0, 'Brave (strikes twice), and hits Protection instead of Resistance.', 'Only Anatolia can use it.'],
  ['-', 'Swarm', 4, 65, 21, 0, 'Lowers the target\'s Speed by 3 on a hit.'],
  ['', 'Bolganone', 10, 85, 8, 0],
  ['B–A', 'Cutting Gale', 7, 95, 8, 5, 'Extra damage against flying units.'],
  ['B', 'Death', 15, 75, 13, 20],
  ['B', 'Glass Wheel', 12, 90, 7, 0, 'Hits Protection instead of Resistance. Extra damage against flying units.', 'Only Anatolia and Hong Hua can use it.'],
  ['B–A', 'Ice Blade', 12, 75, 10, 5],
  ['B', 'Starlight', 13, 90, 30, 0, '', 'Only Orchel can use it.'],
  ['B–A', 'Thoron', 20, 55, 25, 5, 'Range 1–3.'],
  ['A', 'Luna', 1, 50, 20, 0, 'Ignores the target\'s Resistance.', 'Only Fabio can use it.'],
  ['-', 'Banshee', 8, 50, 23, 0, 'Range 1–3. Stops the target from moving.', 'Only one scroll in the game.'],
  ['S', 'Aura', 22, 70, 18, 0, '', 'Rank A for Orchel.'],
  ['S', 'Bolting', 10, 50, 30, 5, "Range 3–10. Can't strike twice."],
  ['S', 'Dark Spikes', 20, 60, 20, 0, 'Extra-strong against cavalry.', "Fabio's. Only one scroll in the game."],
  ['S', 'Excalibur', 15, 100, 10, 10],
  ['S', 'Sagittae', 13, 100, 12, 0],
  ['-', "Agnea's Arrow", 25, 90, 15, 5, '', 'Only one scroll in the game.'],
  ['-', 'Fimbulvetr Night', 30, 80, 28, 10, '', 'Only one scroll in the game.'],
];

export function weapons(): Entry[] {
  return ROWS.map(([rank, name, might, hit, weight, crit, effect, note]) => ({
    id: slug(name),
    name,
    sections: [
      ...(effect ? [{ label: 'Effect', text: effect }] : []),
      ...(note ? [{ label: 'Note', text: note }] : []),
    ],
    categories: { Rank: rank === '-' ? 'No rank' : rank || 'Unlisted' },
    stats: { might, hit, weight, crit },
    source: SOURCE,
  }));
}
