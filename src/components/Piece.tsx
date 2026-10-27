import type { CSSProperties, ReactNode } from 'react';
import { PIECE_MASK, PIECE_PATH, PIECE_SMALL_PATH, PIECE_SPOT, PIECE_VIEWBOX as V, SMALL_BELOW, SNAP_PATHS } from '@/lib/piece';

// The Village piece, the one shape of the brand (rules in CLAUDE.md, "Brand rules").
// Works in server and client components: no hooks, no clip masks, no ids.

const VIEWBOX = `${V.x} ${V.y} ${V.width} ${V.height}`;
const ASPECT = V.height / V.width;

/** The split look for things not built yet (and loading). */
export const GLITCH = { pink: '#ff2bd6', violet: '#8b3dff' } as const;

/** How tall a piece of this width is. */
export const pieceHeight = (size: number) => Math.round(size * ASPECT * 10) / 10;

/**
 * One piece. It only ever scales: `size` is its width in pixels, or 'fill' to take the
 * width of its box (in a grid cell, say).
 * - Solid (the default) is something built, in `color`.
 * - `outline` is a slot nobody has filled yet: an `ink` line with pink and violet copies.
 * - `image` fills the piece with a picture, cut to its shape.
 * Children (short initials or a symbol) sit in the body below the slice, so text never
 * crosses it. Names belong under the piece, not in it.
 * Under 48px the piece uses its small joint (shorter, chunkier tabs) so it stays crisp.
 */
export function Piece({ size, color = 'var(--ink)', outline = false, glitch = false, snap = false, ink = 'var(--ink)', image, label, className = '', style, children }: {
  size: number | 'fill';
  color?: string;
  outline?: boolean;
  /** A solid piece with yellow and violet copies peeking out: the loud, hype version (the banner logo). */
  glitch?: boolean;
  /** Play the snap as it appears: the slice slides into place (a tick, something shipping). */
  snap?: boolean;
  ink?: string;
  image?: string;
  /** Read out instead of the picture, when the piece means something on its own. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const fill = size === 'fill';
  const small = !fill && size < SMALL_BELOW;
  const d = small ? PIECE_SMALL_PATH : PIECE_PATH;
  const snapPaths = SNAP_PATHS[small ? 'small' : 'full'];
  const snapStyle = snap
    ? { '--slice-from': `path('${snapPaths.from}')`, '--slice-over': `path('${snapPaths.over}')`, '--slice-to': `path('${d}')` } as CSSProperties
    : undefined;
  const unit = fill ? 3 : V.width / size; // piece units per pixel ('fill' assumes about 80px)
  const line = fill ? 2 : Math.min(4, Math.max(1.5, size / 36)); // outline thickness in pixels
  const nudge = line * 0.9 * unit;
  const box: CSSProperties = fill
    ? { width: '100%', aspectRatio: `${V.width} / ${V.height}`, containerType: 'inline-size' }
    : { width: size, height: pieceHeight(size) };
  return (
    <span role={label ? 'img' : undefined} aria-label={label} className={`relative inline-block shrink-0 align-middle ${className}`}
      style={{ ...box, ...style }}>
      <svg viewBox={VIEWBOX} width="100%" height="100%" aria-hidden="true" className="absolute inset-0 overflow-visible">
        {outline ? (
          <g fill="none" strokeWidth={line * unit} strokeLinejoin="round">
            <path d={d} stroke={GLITCH.violet} transform={`translate(${-nudge} ${nudge / 3})`} />
            <path d={d} stroke={GLITCH.pink} transform={`translate(${nudge} ${-nudge / 3})`} />
            <path d={d} stroke={ink} />
          </g>
        ) : (
          <>
            {glitch && (
              <>
                <path d={d} fill={GLITCH.violet} transform={`translate(${-nudge * 1.4} ${nudge / 2})`} />
                <path d={d} fill="var(--signal)" transform={`translate(${nudge * 1.4} ${-nudge / 2})`} />
              </>
            )}
            <path d={d} fill={color} className={snap ? 'slice-snap' : undefined} style={snapStyle} />
          </>
        )}
      </svg>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- community pictures, sized small
        <img src={image} alt="" className="absolute inset-0 size-full object-cover"
          style={{ maskImage: PIECE_MASK, WebkitMaskImage: PIECE_MASK, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />
      )}
      {children != null && (
        <span aria-hidden={label ? true : undefined}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center whitespace-nowrap font-extrabold leading-none"
          style={{ left: `${PIECE_SPOT.x * 100}%`, top: `${PIECE_SPOT.y * 100}%`, fontSize: fill ? '15cqw' : Math.round(size * 0.15), color: outline ? ink : '#fff' }}>
          {children}
        </span>
      )}
    </span>
  );
}
