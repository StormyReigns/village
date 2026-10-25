import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { Tint } from '@/data/pages';
import { TINT_HEX, clip } from '@/data/pages/links';

// The picture Discord (and Messages, Slack...) shows under a shared link: a bold poster in
// the Page's color with a row of village roofs along the bottom. Discord shows it about a
// third of this size, so the type is big and there is only the name and an answer or two.
// Drawn with next/og, which only understands flexbox, so every box is display:flex.

export const OG_SIZE = { width: 1200, height: 630 };

const INK = '#15171c';
const TINTS: Tint[] = ['leaf', 'sky', 'berry', 'sun', 'plum', 'teal'];

/** The same steady color per word as the app's icon tiles (tintFor in entries.ts). */
export function tintFor(word: string): Tint {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** The app's icon-tile letters (initials in entries.ts). */
export function initials(name: string) {
  return name.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** Blend a hex color toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const to = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const ch = (v: number) => Math.round(v + (to - v) * a).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** Cut at a word, so facts never end mid-word. */
const wclip = (t: string, n: number) => (t.length <= n ? t : t.slice(0, Math.max(t.lastIndexOf(' ', n - 1), n / 2)).replace(/[,.;:]$/, '') + '…');

// The site's own fonts, kept in the project (src/lib/og-fonts, from Google Fonts, free to
// use) so drawing a picture never waits on a download. If one is missing, the picture
// still draws in the default font.
const fontFile = (name: string) => readFile(join(process.cwd(), 'src/lib/og-fonts', name)).catch(() => null);

// Vercel keeps each picture for a day and hands out the saved copy instantly. Discord
// gives up on slow pictures, and keeps its own copy anyway.
const CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

export interface Row { name: string; tint: Tint }

export interface CardContent {
  tint: Tint;
  /** Small line at the top, e.g. "Fortune's Weave · Quest item". */
  kicker: string;
  title: string;
  /** Entries get an icon tile beside the name. */
  icon?: boolean;
  line?: string;
  /** Entries: up to two answers, in white boxes. */
  facts?: { label: string; text: string }[];
  /** Guides: the numbered steps (up to four show), and a tip when there's room. */
  steps?: string[];
  tip?: string;
  /** Blocks and Pages: a peek at what's inside, two columns. */
  rows?: Row[];
  /** How many more are inside than the rows show. */
  more?: number;
}

const titleSize = (t: string, icon: boolean) => {
  const n = t.length + (icon ? 4 : 0);
  return n <= 12 ? 120 : n <= 18 ? 96 : n <= 26 ? 76 : 62;
};

export async function villageCard({ tint, kicker, title, icon = false, line, facts = [], steps = [], tip, rows = [], more = 0 }: CardContent) {
  const color = TINT_HEX[tint];
  const dark = shade(color, -0.3);
  const shown = rows.slice(0, 4);
  const stepsShown = steps.length === 4 ? steps : steps.slice(0, 3);
  const extra = more + rows.length - shown.length;
  const [heading, body, bold] = await Promise.all([fontFile('Fredoka-SemiBold.ttf'), fontFile('Nunito-SemiBold.ttf'), fontFile('Nunito-ExtraBold.ttf')]);
  const fonts = [
    heading && { name: 'Fredoka', data: heading, weight: 600 as const },
    body && { name: 'Nunito', data: body, weight: 600 as const },
    bold && { name: 'Nunito', data: bold, weight: 800 as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Nunito', background: color, padding: '50px 64px', position: 'relative', color: 'white' }}>
        {/* The village: a row of roofs along the bottom, a shade darker than the Page. */}
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: 1200, height: 130, display: 'flex', alignItems: 'flex-end' }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <svg key={i} width="150" height={90 + (i % 3) * 20} viewBox="0 0 150 130" preserveAspectRatio="none">
              <path d={i % 2 ? 'M8 130 L8 60 L75 10 L142 60 L142 130 Z' : 'M4 130 L4 70 Q75 0 146 70 L146 130 Z'} fill={dark} opacity={0.55} />
            </svg>
          ))}
        </div>

        {/* The top line, with the Village name on the right so a shared card says where it's from. */}
        <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', fontSize: 34, fontWeight: 800 }}>
          <div style={{ display: 'flex', flexGrow: 1, opacity: 0.85 }}>{clip(kicker, 48)}</div>
          <div style={{ display: 'flex', fontFamily: 'Fredoka', fontSize: 30, opacity: 0.9 }}>Village</div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', marginTop: icon ? 28 : 18 }}>
          {icon && (
            <div style={{ display: 'flex', flexShrink: 0, width: 210, height: 210, borderRadius: 52, background: 'white', color, alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka', fontSize: 96, marginRight: 44 }}>{initials(title)}</div>
          )}
          <div style={{ display: 'flex', fontFamily: 'Fredoka', fontSize: titleSize(title, icon), lineHeight: 1.02 }}>{clip(title, 44)}</div>
        </div>
        {line && <div style={{ display: 'flex', flexShrink: 0, fontSize: 36, opacity: 0.9, marginTop: 14, lineHeight: 1.25 }}>{wclip(line, 70)}</div>}

        {facts.length > 0 && (
          <div style={{ display: 'flex', marginTop: 34 }}>
            {facts.slice(0, 2).map((f, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', background: 'white', color: INK, borderRadius: 30, padding: '16px 28px', marginRight: 20, width: facts.length > 2 ? 440 : facts.length > 1 ? 500 : 1000 }}>
                <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: dark, textTransform: 'uppercase' }}>{clip(f.label, 32)}</div>
                <div style={{ display: 'flex', fontSize: 40, lineHeight: 1.15 }}>{wclip(f.text, facts.length > 2 ? 52 : facts.length > 1 ? 60 : icon ? 84 : 150)}</div>
              </div>
            ))}
            {/* More than fits (several routes, say): say so rather than leave them out silently. */}
            {facts.length > 2 && (
              <div style={{ display: 'flex', alignSelf: 'center', fontSize: 30, fontWeight: 800, background: 'rgba(255,255,255,0.22)', borderRadius: 999, padding: '10px 20px' }}>+{facts.length - 2} more</div>
            )}
          </div>
        )}

        {stepsShown.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
            {stepsShown.map((st, i) => (
              <div key={i} style={{ display: 'flex', alignItems: stepsShown.length === 4 ? 'center' : 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', flexShrink: 0, width: 50, height: 50, borderRadius: 999, background: 'white', color: dark, alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka', fontSize: 28 }}>{i + 1}</div>
                {/* Four steps get one line each; three or fewer may wrap onto a second. */}
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, marginLeft: 20, lineHeight: 1.15, marginTop: stepsShown.length === 4 ? 0 : 5, whiteSpace: stepsShown.length === 4 ? 'nowrap' : 'normal' }}>{wclip(st, stepsShown.length === 4 ? 56 : 104)}</div>
              </div>
            ))}
            {steps.length > stepsShown.length && <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, opacity: 0.85, marginLeft: 70 }}>and {steps.length - stepsShown.length} more steps</div>}
            {tip && steps.length <= 2 && (
              <div style={{ display: 'flex', background: 'white', color: INK, borderRadius: 30, padding: '14px 26px', marginTop: 10, fontSize: 34 }}>
                <span style={{ fontWeight: 800, color: dark, marginRight: 12 }}>Tip</span>{wclip(tip, 70)}
              </div>
            )}
          </div>
        )}

        {shown.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 28 }}>
            {shown.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', width: '50%', marginBottom: 16 }}>
                <div style={{ display: 'flex', flexShrink: 0, width: 66, height: 66, borderRadius: 18, background: 'white', color: TINT_HEX[r.tint], alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka', fontSize: 28 }}>{initials(r.name)}</div>
                <div style={{ display: 'flex', fontSize: 38, fontWeight: 800, marginLeft: 20, whiteSpace: 'nowrap' }}>{wclip(r.name, 21)}</div>
              </div>
            ))}
            {extra > 0 && <div style={{ display: 'flex', width: '100%', fontSize: 32, fontWeight: 800, opacity: 0.85 }}>and {extra} more</div>}
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined, headers: { 'Cache-Control': CACHE } },
  );
}
