import { ImageResponse } from 'next/og';
import type { Tint } from '@/data/pages';
import { clip } from '@/data/pages/links';
import { shadeHex, type Shade } from './shades';
import { CACHE, OG_SIZE, OgPiece, fontFile, initials, logoFile } from './og-card';

// The share picture for a party (docs/blocks/planner.md, slice 3): the Party Page's color, the maker's
// name, and the party as white pieces with their names under them, like the list itself. Discord shows
// it about a third of this size, so at most two rows, and a long party ends in "+3".

export interface PartyCardContent {
  tint: Tint;
  shade?: Shade;
  kicker: string;
  title: string;
  names: string[];
}

export async function partyCard({ tint, shade: genre, kicker, title, names }: PartyCardContent) {
  const color = shadeHex(tint, genre);
  const perRow = names.length <= 6 ? 6 : 8;
  const piece = perRow === 6 ? 128 : 100;
  const room = perRow * 2;
  const shown = names.slice(0, names.length > room ? room - 1 : room);
  const rows = [shown.slice(0, perRow), shown.slice(perRow)].filter((r) => r.length);
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
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
          {rows.length === 0 && <div style={{ display: 'flex', fontSize: 34, opacity: 0.85 }}>Nobody picked yet.</div>}
          {rows.map((row, r) => (
            <div key={r} style={{ display: 'flex', marginBottom: 14 }}>
              {row.map((n, k) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: piece + 8, marginRight: 14 }}>
                  <OgPiece width={piece} fill="white" label={initials(n)} labelColor={color} fontSize={Math.round(piece * 0.24)} />
                  <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, marginTop: 6 }}>{clip(n, 11)}</div>
                </div>
              ))}
              {r === rows.length - 1 && names.length > shown.length && <div style={{ display: 'flex', alignSelf: 'center', fontSize: 34, fontWeight: 800 }}>+{names.length - shown.length}</div>}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined, headers: { 'Cache-Control': CACHE } },
  );
}
