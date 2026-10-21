import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Hammer, Info } from 'lucide-react';
import { GAMES, blocksFor, getGame } from '@/data/games';
import { cardsFor } from '@/data/content';
import { Countdown } from '@/components/Countdown';
import { GameCover } from '@/components/GameCover';
import { GameAppView } from '@/components/GameAppView';
import { AccountButton } from '@/components/AccountButton';
import { withCovers } from '@/lib/pictures';

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]'>): Promise<Metadata> {
  const game = getGame((await params).game);
  return { title: game?.shortTitle ?? 'Game' };
}

// The game app: what players use mid-game. Built from the game's blocks.
// The URL is read inside <Suspense> so navigation can show the shell instantly.
export default function GamePage({ params }: PageProps<'/g/[game]'>) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6"><div className="surface aspect-[3/1] animate-pulse rounded-[2rem]" /></main>}>
      <GameApp params={params} />
    </Suspense>
  );
}

async function GameApp({ params }: { params: PageProps<'/g/[game]'>['params'] }) {
  const found = getGame((await params).game);
  if (!found) notFound();
  const [game] = withCovers([found]);
  const blocks = blocksFor(game);
  const cards = cardsFor(game.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Village square
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/g/${game.id}/workshop`} className="btn-quiet inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
            <Hammer size={16} className="text-leaf" aria-hidden="true" /> Workshop
          </Link>
          <AccountButton />
        </div>
      </div>

      <section className="surface mt-4 overflow-hidden rounded-[2rem]">
        <GameCover game={game} className="!aspect-[3/1] !rounded-none" />
        <div className="p-6 sm:p-8">
          <p className="text-sm text-muted">{game.genre} · {game.platform}</p>
          <h1 className="font-display text-3xl sm:text-4xl">{game.title}</h1>
          {game.status === 'prelaunch' && (
            <p className="mt-2 text-sm text-muted"><Countdown date={game.releaseDate} before="Comes out" after="Out now" /></p>
          )}
          {cards.length > 0 && (
            <p className="mt-4 flex gap-2 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
              <Info size={18} className="mt-0.5 shrink-0 text-sun" aria-hidden="true" />
              <span>
                These {cards.length} starter cards come from an early community codex, put together in the game&apos;s first days.
                Some details may be wrong. Spotted one? Fix it in the Workshop.
              </span>
            </p>
          )}
        </div>
      </section>

      <GameAppView game={{ id: game.id, shortTitle: game.shortTitle, paths: game.paths }} blocks={blocks} cards={cards} />
    </main>
  );
}
