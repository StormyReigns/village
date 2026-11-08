import { ImageResponse } from 'next/og';
import type { Tint } from '@/data/pages';
import { clip } from '@/data/pages/links';
import { shadeHex, type Shade } from './shades';
import { CACHE, OG_SIZE, OgPiece, fontFile, initials, logoFile } from './og-card';
import { tierColor, type Tier } from './tiers';

// The share picture for a tier list (docs/blocks/tier-lists.md): the Page's color, the maker's
// name, and each tier as a row of white pieces with initials, like the list itself. Discord shows
// it about a third of this size, so pieces stay big and long rows end in "+3".


export interface TierCardContent {
  tint: Tint;
  shade?: Shade;
  kicker: string;
  title: string;
  tiers: Tier[];
  /** Names in each tier, in order, by tier key. */
  rows: Record<string, string[]>;
}

export async function tierCard({ tint, shade: genre, kicker, title, tiers, rows }: TierCardContent) {
  const color = shadeHex(tint, genre);
  // Only tiers with pieces in them, at most five, so each row has room.
  const used = tiers.filter((t) => rows[t.key]?.length).slice(0, 5);
  const rowH = used.length <= 3 ? 120 : used.length === 4 ? 100 : 82;
  const piece = Math.round(rowH * 0.78 * 1772 / 1610);
  // As many pieces as fit beside the letter (the picture is 1088px wide inside its padding), with room for "+3".
  const perRow = Math.floor((1088 - 24 - rowH * 0.9 - 18 - 50) / (piece + 12));
  const [body, bold, logo] = await Promise.all([fontFile('Rubik-Bold.ttf'), fontFile('Rubik-ExtraBold.ttf'), logoFile()]);
  const fonts = [
    body && { name: 'Rubik', data: body, weight: 700 as const },
    bold && { name: 'Rubik', data: bold, weight: 800 as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Rubik', background: color, padding: '40px 56px', color: 'white' }}>
        <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', fontSize: 30, fontWeight: 800 }}>
          <div style={{ display: 'flex', flexGrow: 1, opacity: 0.85 }}>{clip(kicker, 52)}</div>
          <div style={{ display: 'flex', width: 56, height: 56, borderRadius: 14, background: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            {/* next/og draws plain <img> only. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} width={47} height={43} alt="" />}
          </div>
          <div style={{ display: 'flex', fontSize: 28 }}>Village</div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, fontSize: 58, fontWeight: 800, letterSpacing: -1, marginTop: 6, lineHeight: 1.05 }}>{clip(title, 34)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
          {used.map((t) => {
            const i = tiers.indexOf(t);
            const names = rows[t.key];
            const shown = names.slice(0, names.length > perRow ? perRow - 1 : perRow);
            return (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', height: rowH, marginBottom: 10, background: 'rgba(255,255,255,0.14)', borderRadius: 24, padding: '0 12px' }}>
                <div style={{ display: 'flex', flexShrink: 0, width: rowH * 0.9, height: rowH * 0.78, borderRadius: 18, background: 'white', color: tierColor(i), alignItems: 'center', justifyContent: 'center', fontSize: t.label.length <= 2 ? rowH * 0.48 : 22, fontWeight: 800, marginRight: 18 }}>
                  {clip(t.label, 10)}
                </div>
                {shown.map((n, k) => (
                  <div key={k} style={{ display: 'flex', marginRight: 12 }}>
                    <OgPiece width={piece} fill="white" label={initials(n)} labelColor={color} fontSize={Math.round(piece * 0.24)} />
                  </div>
                ))}
                {names.length > shown.length && <div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>+{names.length - shown.length}</div>}
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined, headers: { 'Cache-Control': CACHE } },
  );
}
