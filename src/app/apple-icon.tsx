import { ImageResponse } from 'next/og';
import { PIECE_PATH, PIECE_VIEWBOX as V } from '@/lib/piece';

// The phone home-screen icon: the ink piece on signal yellow. Phones round the corners.

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const w = 136, h = Math.round(w * V.height / V.width);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffc53d' }}>
        <svg width={w} height={h} viewBox={`${V.x} ${V.y} ${V.width} ${V.height}`}>
          <path d={PIECE_PATH} fill="#15171c" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
