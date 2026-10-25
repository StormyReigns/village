import { ImageResponse } from 'next/og';
import { PIECE_PATH, PIECE_VIEWBOX as V } from '@/lib/piece';

// The browser tab icon: the yellow piece on an ink square (brand rules in CLAUDE.md).

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  const w = 28, h = Math.round(w * V.height / V.width);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#15171c', borderRadius: 7 }}>
        <svg width={w} height={h} viewBox={`${V.x} ${V.y} ${V.width} ${V.height}`}>
          <path d={PIECE_PATH} fill="#ffc53d" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
