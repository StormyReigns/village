import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import type { Game } from '@/data/games';

const TINT: Record<Game['hue'], string> = {
  berry: 'from-berry to-sun',
  sky: 'from-sky to-leaf',
  leaf: 'from-leaf to-sky',
  sun: 'from-sun to-berry',
};

/** A game's cover picture, or a colored placeholder until we have our own art. */
export function GameCover({ game, className = '', compact = false }: { game: Game; className?: string; compact?: boolean }) {
  return (
    <div className={'relative aspect-[16/9] overflow-hidden rounded-2xl ' + className}>
      {game.cover ? (
        <Image src={game.cover} alt="" fill sizes="(min-width: 640px) 340px, 85vw" className="object-cover" />
      ) : (
        <div className={'absolute inset-0 grid place-items-center bg-gradient-to-br text-white ' + TINT[game.hue]}>
          <div className="grid justify-items-center gap-1 px-2 text-center">
            {!compact && <Sparkles size={22} aria-hidden="true" className="opacity-80" />}
            <span className={'font-display leading-tight drop-shadow-sm ' + (compact ? 'text-sm' : 'text-2xl')}>{game.shortTitle}</span>
          </div>
        </div>
      )}
    </div>
  );
}
