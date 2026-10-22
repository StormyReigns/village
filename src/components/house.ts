// Every village block is a little house: its own roof, where the roof sits, and a slight
// lean. Chosen from the block's name, so the village looks varied but stays the same on
// every visit. See .vblock in globals.css for the shapes.

const ROOFS = ['wide', 'gable', 'bump', 'sprout', 'chimney', 'flag', 'thatch'] as const;
const SPOTS = ['26%', '36%', '50%', '62%', '72%'];
const TILTS = ['left', undefined, 'right'] as const;

export interface House {
  'data-roof': (typeof ROOFS)[number];
  'data-tilt'?: 'left' | 'right';
  style: React.CSSProperties;
}

/** The house for a block. `lean: false` keeps big blocks straight so lists stay easy to read. */
export function house(key: string, tint: string, { lean = true } = {}): House {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return {
    'data-roof': ROOFS[h % ROOFS.length],
    'data-tilt': lean ? TILTS[(h >>> 4) % TILTS.length] : undefined,
    style: { '--tint': `var(--${tint})`, '--at': SPOTS[(h >>> 8) % SPOTS.length] } as React.CSSProperties,
  };
}
