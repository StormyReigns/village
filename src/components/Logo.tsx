import Link from 'next/link';
import type { ReactNode } from 'react';
import { Piece } from './Piece';

// The Village logo: the yellow piece and the "village" wordmark, both with the slice
// (brand rules in CLAUDE.md). Works in server and client components.

/**
 * The word "village" in Rubik at its heaviest, with the same slice as the piece: one band
 * through the middle of the letters slides right. Drawn as three clipped copies of the
 * word, so it stays real text in the site's font. Set the size and color with className.
 */
export function Wordmark({ className = '', glitch = false }: { className?: string; glitch?: boolean }) {
  // The band sits across the middle of the lowercase letters (Rubik, line height 1).
  const copy = 'absolute inset-0';
  // The loud version: yellow and violet copies just off the letters, like the glitch piece.
  const split = glitch ? { textShadow: '0.045em -0.02em 0 var(--signal), -0.045em 0.02em 0 #8b3dff' } : undefined;
  return (
    <span role="img" aria-label="Village" style={split} className={`relative inline-block font-extrabold leading-none tracking-[-0.03em] ${className}`}>
      <span aria-hidden="true" className="invisible">village</span>
      <span aria-hidden="true" className={copy} style={{ clipPath: 'inset(-0.3em -0.3em 48% -0.3em)' }}>village</span>
      <span aria-hidden="true" className={copy} style={{ clipPath: 'inset(52% -0.3em 36% -0.3em)', transform: 'translateX(0.09em)' }}>village</span>
      <span aria-hidden="true" className={copy} style={{ clipPath: 'inset(64% -0.3em -0.3em -0.3em)' }}>village</span>
    </span>
  );
}

/**
 * The ink bar across the top of every screen: the logo (back to the village square) on
 * the left, then whatever the screen adds, and its actions on the right. `compact` hides
 * the wordmark on phones, where the screen's own name needs the room.
 */
export function TopBar({ children, actions, compact = false }: { children?: ReactNode; actions?: ReactNode; compact?: boolean }) {
  return (
    <header className="sticky top-0 z-30 bg-ink text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" aria-label="Village square" className="flex shrink-0 items-center gap-2 rounded-lg">
          <Piece size={36} color="var(--signal)" />
          <span className={compact ? 'hidden sm:flex' : 'flex'}><Wordmark className="text-[23px]" /></span>
        </Link>
        {children}
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
