import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { Tint } from '@/data/pages';
import { clip } from '@/data/pages/links';
import { shadeHex, type Shade } from './shades';
import { PIECE_PATH, PIECE_SPOT, PIECE_VIEWBOX as V } from './piece';

// The picture Discord (and Messages, Slack...) shows under a shared link: a bold poster in
// the Page's color with a big faint piece behind it and the Village mark. Discord shows it about a
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
  /** The game's genre shade (src/lib/shades.ts), so the picture matches its app. */
  shade?: Shade;
}

const VIEWBOX = `${V.x} ${V.y} ${V.width} ${V.height}`;

/** The brand's piece for pictures: next/og draws plain SVG paths, so the slice comes along. */
function OgPiece({ width, fill, label, labelColor, fontSize = 24 }: { width: number; fill: string; label?: string; labelColor?: string; fontSize?: number }) {
  const height = Math.round(width * V.height / V.width);
  return (
    <div style={{ display: 'flex', position: 'relative', flexShrink: 0, width, height }}>
      <svg width={width} height={height} viewBox={VIEWBOX}><path d={PIECE_PATH} fill={fill} /></svg>
      {/* Initials sit below the slice, never across it. */}
      {label && (
        <div style={{ display: 'flex', position: 'absolute', left: PIECE_SPOT.x * width - width * 0.3, top: PIECE_SPOT.y * height - fontSize * 0.6, width: width * 0.6, height: fontSize * 1.2, alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: 800, color: labelColor }}>{label}</div>
      )}
    </div>
  );
}

const titleSize = (t: string, icon: boolean) => {
  const n = t.length + (icon ? 4 : 0);
  return n <= 12 ? 120 : n <= 18 ? 96 : n <= 26 ? 76 : 62;
};

export async function villageCard({ tint, shade: genre, kicker, title, icon = false, line, facts = [], steps = [], tip, rows = [], more = 0 }: CardContent) {
  const color = shadeHex(tint, genre);
  const dark = shade(color, -0.3);
  const shown = rows.slice(0, 4);
  const stepsShown = steps.length === 4 ? steps : steps.slice(0, 3);
  const extra = more + rows.length - shown.length;
  const [body, bold] = await Promise.all([fontFile('Rubik-Bold.ttf'), fontFile('Rubik-ExtraBold.ttf')]);
  const fonts = [
    body && { name: 'Rubik', data: body, weight: 700 as const },
    bold && { name: 'Rubik', data: bold, weight: 800 as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Rubik', background: color, padding: '50px 64px', position: 'relative', color: 'white' }}>
        {/* The brand: one big faint piece behind everything, cropped by the corner. */}
        <div style={{ position: 'absolute', right: -130, bottom: -110, display: 'flex', opacity: 0.14 }}>
          <svg width={640} height={Math.round(640 * V.height / V.width)} viewBox={VIEWBOX}><path d={PIECE_PATH} fill="white" /></svg>
        </div>

        {/* The top line, with the Village mark on the right so a shared card says where it's from. */}
        <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', fontSize: 34, fontWeight: 800 }}>
          <div style={{ display: 'flex', flexGrow: 1, opacity: 0.85 }}>{clip(kicker, 48)}</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 52, height: 52, borderRadius: 12, background: INK, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <svg width={42} height={30} viewBox={VIEWBOX}><path d={PIECE_PATH} fill="#ffc53d" /></svg>
            </div>
            <div style={{ display: 'flex', fontSize: 32 }}>Village</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', marginTop: icon ? 28 : 18 }}>
          {icon && (
            <div style={{ display: 'flex', marginRight: 44 }}><OgPiece width={260} fill="white" label={initials(title)} labelColor={color} fontSize={64} /></div>
          )}
          <div style={{ display: 'flex', fontWeight: 800, fontSize: titleSize(title, icon), lineHeight: 1.02, letterSpacing: -1 }}>{clip(title, 44)}</div>
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
                <div style={{ display: 'flex', flexShrink: 0, width: 50, height: 50, borderRadius: 999, background: 'white', color: dark, alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28 }}>{i + 1}</div>
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
                <OgPiece width={90} fill="white" label={initials(r.name)} labelColor={shadeHex(r.tint, genre)} fontSize={22} />
                <div style={{ display: 'flex', fontSize: 35, fontWeight: 800, marginLeft: 20, whiteSpace: 'nowrap' }}>{wclip(r.name, 19)}</div>
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
