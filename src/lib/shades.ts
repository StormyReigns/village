import type { Tint } from '@/data/pages';

// Genre shades (brand rules in CLAUDE.md): every game uses the same six Page colors, and a
// game's genre nudges their shade and its corners. Each Page keeps its hue, so Units is
// always the pink-red family. Worked out from the site's colors on the "Block Silhouettes"
// canvas (board 16): saturation and lightness shifted per genre, then darkened only as far
// as white text on each solid needs. The ink bar and signal yellow never change.

export type Shade = 'standard' | 'cozy' | 'fantasy' | 'shooter' | 'openworld';

interface ShadeSet {
  /** Each Page color as [solid, tint]. */
  colors: Record<Tint, [string, string]>;
  /** Corner sizes, in place of Tailwind's rounded-xl / -2xl / -3xl. */
  radius: { xl: string; '2xl': string; '3xl': string };
}

/** The site's own colors (globals.css), for places CSS variables can't reach. */
const STANDARD: Record<Tint, [string, string]> = {
  berry: ['#c23a5c', '#fbeef2'], sun: ['#a85508', '#fbf1e4'], plum: ['#7c4bc0', '#f3eefb'],
  sky: ['#1a6bb8', '#e8f1fa'], teal: ['#0c7478', '#e4f3f3'], leaf: ['#1f7a43', '#e6f4ea'],
};

export const SHADES: Record<Exclude<Shade, 'standard'>, ShadeSet> = {
  // Farming and life sims: softer, lighter, warm cream fields, rounder corners.
  cozy: {
    colors: {
      berry: ['#bb506b', '#f6e4e0'], sun: ['#ab5f19', '#f4e6d6'], plum: ['#8660ba', '#efe6eb'],
      sky: ['#2d78be', '#e4e9eb'], teal: ['#1a8084', '#e1eae4'], leaf: ['#2c814e', '#e4eadd'],
    },
    radius: { xl: '0.9rem', '2xl': '1.25rem', '3xl': '1.75rem' },
  },
  // Deeper jewel tones on parchment fields, slightly tighter corners.
  fantasy: {
    colors: {
      berry: ['#b62d4f', '#f2dad2'], sun: ['#974800', '#eedec8'], plum: ['#6e38ba', '#e9dce0'],
      sky: ['#0f5eaa', '#dce1de'], teal: ['#046266', '#dbe1d5'], leaf: ['#156a37', '#dde2cf'],
    },
    radius: { xl: '0.6rem', '2xl': '0.75rem', '3xl': '1.15rem' },
  },
  // Duller, darker colors on cool gray fields, sharp corners.
  shooter: {
    colors: {
      berry: ['#9b4d60', '#e3dade'], sun: ['#7a4c22', '#dfdad6'], plum: ['#7556a0', '#dedbe7'],
      sky: ['#33608b', '#d5dde4'], teal: ['#1b5254', '#d1dbdd'], leaf: ['#2a5b3d', '#d3dcda'],
    },
    radius: { xl: '0.3rem', '2xl': '0.4rem', '3xl': '0.6rem' },
  },
  // Earthy and muted on misty fields.
  openworld: {
    colors: {
      berry: ['#ad455f', '#ebdedb'], sun: ['#8f5117', '#e7e0d2'], plum: ['#7850b1', '#e4e0e6'],
      sky: ['#2865a0', '#d9e2e4'], teal: ['#156265', '#d7e2dc'], leaf: ['#256940', '#d9e3d7'],
    },
    radius: { xl: '0.7rem', '2xl': '0.95rem', '3xl': '1.4rem' },
  },
};

/**
 * A game's shade as CSS variables (its Page colors and corners), to set on the element that
 * holds the game's screens, so everything inside shifts at once and nothing outside does.
 * Empty for the standard shade.
 */
export function shadeVars(shade?: Shade): Record<string, string> {
  if (!shade || shade === 'standard') return {};
  const s = SHADES[shade];
  const vars: Record<string, string> = {};
  for (const [t, [solid, tint]] of Object.entries(s.colors)) { vars[`--${t}`] = solid; vars[`--${t}-soft`] = tint; }
  vars['--radius-xl'] = s.radius.xl;
  vars['--radius-2xl'] = s.radius['2xl'];
  vars['--radius-3xl'] = s.radius['3xl'];
  return vars;
}

/** A Page color as plain hex in a game's shade, for previews and Discord's link color. */
export function shadeHex(tint: Tint, shade?: Shade): string {
  return (!shade || shade === 'standard' ? STANDARD : SHADES[shade].colors)[tint][0];
}
