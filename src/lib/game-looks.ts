// The looks a game can take, in players' words, each a color shade (src/lib/shades.ts) and a tile hue. Used by
// starting a game (src/app/start/StartGame.tsx) and its settings (src/app/g/[game]/workshop/GameSettings.tsx).

import type { Game } from '../data/games.ts';
import type { Shade } from './shades.ts';

export const LOOKS: { shade: Shade; label: string; hint: string; hue: Game['hue'] }[] = [
  { shade: 'fantasy', label: 'Fantasy and adventure', hint: 'RPGs, quests, swords and spells', hue: 'berry' },
  { shade: 'cozy', label: 'Cozy', hint: 'Farming, life sims, gentle games', hue: 'sun' },
  { shade: 'shooter', label: 'Action and shooters', hint: 'Fast, loud, competitive', hue: 'sky' },
  { shade: 'openworld', label: 'Open world', hint: 'Big maps to explore', hue: 'leaf' },
  { shade: 'standard', label: 'Something else', hint: 'Puzzles, racing, sports, anything', hue: 'sky' },
];

export const lookOf = (shade?: Shade | null) => LOOKS.find((l) => l.shade === (shade ?? 'standard')) ?? LOOKS[LOOKS.length - 1];

/** A first guess at the look from the kind of game typed, until the Builder picks one. */
export function guessLook(kind: string): Shade | null {
  const k = kind.toLowerCase();
  if (/farm|cozy|life|sim|cook|town/.test(k)) return 'cozy';
  if (/shoot|fps|battle royale|action|fight|hero/.test(k)) return 'shooter';
  if (/open world|sandbox|survival|craft/.test(k)) return 'openworld';
  if (/rpg|fantasy|adventure|tactic|quest|souls|metroid|zelda|dungeon/.test(k)) return 'fantasy';
  return k.trim() ? 'standard' : null;
}
