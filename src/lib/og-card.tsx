import { ImageResponse } from 'next/og';
import type { Tint } from '@/data/pages';
import { TINT_HEX, clip } from '@/data/pages/links';

// The picture Discord (and Messages, Slack...) shows under a shared link: a village block
// in the Page's color, with a roof, the name, a few key facts and a small Village footer.
// Drawn with next/og, which only understands flexbox, so every box is display:flex.

export const OG_SIZE = { width: 1200, height: 630 };

const PAPER = '#f7f8fa';
const INK = '#1f2430';
const MUTED = '#6b7280';

/** Blend a hex color toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const to = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const ch = (v: number) => Math.round(v + (to - v) * a).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

// The site's own fonts, from Google Fonts (they serve plain TTF files to servers).
// If that fails, the picture still draws in the default font.
async function font(family: string, weight: number) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export interface CardContent {
  tint: Tint;
  kicker: string;
  title: string;
  line?: string;
  facts?: { label: string; text: string }[];
  chips?: string[];
}

export async function villageCard({ tint, kicker, title, line, facts = [], chips = [] }: CardContent) {
  const color = TINT_HEX[tint];
  const edge = shade(color, -0.25);
  const wash = shade(color, 0.88);
  const [heading, body, bold] = await Promise.all([font('Fredoka', 600), font('Nunito', 600), font('Nunito', 800)]);
  const fonts = [
    heading && { name: 'Fredoka', data: heading, weight: 600 as const },
    body && { name: 'Nunito', data: body, weight: 600 as const },
    bold && { name: 'Nunito', data: bold, weight: 800 as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: `linear-gradient(180deg, ${wash} 0%, ${PAPER} 70%)`, fontFamily: 'Nunito', color: INK, padding: '36px 80px 0' }}>
        {/* Roof, then the block's body with its thick darker bottom edge. */}
        <svg width="1040" height="96" viewBox="0 0 1040 96" style={{ marginBottom: -30 }}>
          <rect x="770" y="8" width="46" height="70" rx="8" fill={edge} />
          <path d="M30 96 L468 12 Q520 0 572 12 L1010 96 Z" fill={color} />
        </svg>
        {/* The darker shade shows under the white card, like the blocks in the app. */}
        <div style={{ width: 1040, height: 448, display: 'flex', background: edge, borderRadius: 38, paddingBottom: 16, boxShadow: '0 18px 40px rgba(31,36,48,0.10)' }}>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 36, padding: '40px 56px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexShrink: 0 }}>
            <div style={{ display: 'flex', background: wash, color: edge, fontWeight: 800, fontSize: 26, padding: '6px 22px', borderRadius: 999 }}>{kicker}</div>
          </div>
          <div style={{ display: 'flex', fontFamily: 'Fredoka', fontWeight: 600, fontSize: title.length > 26 ? 60 : 76, flexShrink: 0, lineHeight: 1.05, marginTop: 18 }}>{clip(title, 48)}</div>
          {line && <div style={{ display: 'flex', flexShrink: 0, fontSize: 28, color: MUTED, marginTop: 12, lineHeight: 1.3 }}>{clip(line, 110)}</div>}
          {facts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 26 }}>
              {facts.slice(0, 4).map((f, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', width: '50%', paddingRight: 28, marginBottom: 18 }}>
                  <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: edge, textTransform: 'uppercase', letterSpacing: 1 }}>{clip(f.label, 30)}</div>
                  <div style={{ display: 'flex', fontSize: 28, marginTop: 2 }}>{clip(f.text, 46)}</div>
                </div>
              ))}
            </div>
          )}
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 26 }}>
              {chips.slice(0, 10).map((c, i) => (
                <div key={i} style={{ display: 'flex', fontSize: 26, fontWeight: 800, background: '#f3f4f7', borderRadius: 999, padding: '8px 22px', marginRight: 12, marginBottom: 12 }}>{clip(c, 24)}</div>
              ))}
              {chips.length > 10 && <div style={{ display: 'flex', fontSize: 26, color: MUTED, padding: '8px 6px' }}>+{chips.length - 10} more</div>}
            </div>
          )}
        </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 22, fontSize: 26, color: MUTED }}>
          <svg width="34" height="30" viewBox="0 0 34 30" style={{ marginRight: 12 }}>
            <path d="M2 14 L17 2 L32 14 Z" fill={color} />
            <rect x="6" y="13" width="22" height="16" rx="3" fill={edge} />
          </svg>
          <span style={{ fontFamily: 'Fredoka', fontWeight: 600, color: INK, marginRight: 10 }}>Village</span>
          <span>· community-built companion apps</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  );
}
