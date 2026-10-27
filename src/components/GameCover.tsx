import Image from 'next/image';
import type { Game } from '@/data/games';
import { Piece } from './Piece';

const SOFT: Record<Game['hue'], string> = {
  berry: 'bg-berry-soft',
  sky: 'bg-sky-soft',
  leaf: 'bg-leaf-soft',
  sun: 'bg-sun-soft',
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/**
 * A game's cover picture, or until we have our own art, the game's piece on its color:
 * the same three levels as inside an app (a tint behind, a solid piece on top).
 */
export function GameCover({ game, className = '', compact = false }: { game: Game; className?: string; compact?: boolean }) {
  return (
    <div className={'relative aspect-[16/9] overflow-hidden rounded-2xl ' + className}>
      {game.cover ? (
        <Image src={game.cover} alt="" fill sizes="(min-width: 640px) 340px, 85vw" className="object-cover" />
      ) : (
        <div className={'absolute inset-0 grid place-items-center ' + SOFT[game.hue]}>
          <Piece size={compact ? 44 : 96} color={`var(--${game.hue})`}>{initials(game.shortTitle)}</Piece>
        </div>
      )}
    </div>
  );
}
