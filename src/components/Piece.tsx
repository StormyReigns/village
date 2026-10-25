import type { CSSProperties, ReactNode } from 'react';
import { PIECE_PATH, PIECE_SPOT, PIECE_VIEWBOX as V } from '@/lib/piece';

// The Village piece, the one shape of the brand (rules in CLAUDE.md, "Brand rules").
// Works in server and client components: no hooks, no clip masks, no ids.

const VIEWBOX = `${V.x} ${V.y} ${V.width} ${V.height}`;
const ASPECT = V.height / V.width;

/** The split look for things not built yet (and loading). */
export const GLITCH = { pink: '#ff2bd6', violet: '#8b3dff' } as const;

/** How tall a piece of this width is. */
export const pieceHeight = (size: number) => Math.round(size * ASPECT * 10) / 10;

/**
 * One piece, `size` pixels wide. It only ever scales.
 * - Solid (the default) is something built, in `color`.
 * - `outline` is a slot nobody has filled yet: an `ink` line with pink and violet copies.
 * Children (short initials or a symbol) sit in the body below the slice, so text never
 * crosses it. Names belong under the piece, not in it.
 */
export function Piece({ size, color = 'var(--ink)', outline = false, ink = 'var(--ink)', label, className = '', style, children }: {
  size: number;
  color?: string;
  outline?: boolean;
  ink?: string;
  /** Read out instead of the picture, when the piece means something on its own. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const height = pieceHeight(size);
  const unit = V.width / size; // piece units per pixel
  const line = Math.min(4, Math.max(1.5, size / 36)); // outline thickness in pixels
  const nudge = line * 0.9 * unit;
  return (
    <span role={label ? 'img' : undefined} aria-label={label} className={`relative inline-block shrink-0 align-middle ${className}`}
      style={{ width: size, height, ...style }}>
      <svg viewBox={VIEWBOX} width={size} height={height} aria-hidden="true" className="absolute inset-0 overflow-visible">
        {outline ? (
          <g fill="none" strokeWidth={line * unit} strokeLinejoin="round">
            <path d={PIECE_PATH} stroke={GLITCH.violet} transform={`translate(${-nudge} ${nudge / 3})`} />
            <path d={PIECE_PATH} stroke={GLITCH.pink} transform={`translate(${nudge} ${-nudge / 3})`} />
            <path d={PIECE_PATH} stroke={ink} />
          </g>
        ) : (
          <path d={PIECE_PATH} fill={color} />
        )}
      </svg>
      {children != null && (
        <span aria-hidden={label ? true : undefined}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center font-extrabold leading-none"
          style={{ left: `${PIECE_SPOT.x * 100}%`, top: `${PIECE_SPOT.y * 100}%`, fontSize: Math.round(size * 0.15), color: outline ? ink : '#fff' }}>
          {children}
        </span>
      )}
    </span>
  );
}
