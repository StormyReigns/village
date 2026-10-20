import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Hammer } from 'lucide-react';
import { GAMES, blocksFor, getGame } from '@/data/games';
import { BlockIcon } from '@/components/Icon';
import { Countdown } from '@/components/Countdown';

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]'>): Promise<Metadata> {
  const game = getGame((await params).game);
  return { title: game?.shortTitle ?? 'Game' };
}

// The game app: what players use mid-game. Built from the game's blocks.
export default async function GameApp({ params }: PageProps<'/g/[game]'>) {
  const game = getGame((await params).game);
  if (!game) notFound();
  const blocks = blocksFor(game);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Village square
      </Link>

      <section className="mt-4 rounded-[2rem] bg-card p-6 shadow-soft ring-1 ring-line sm:p-8">
        <p className="text-sm text-muted">{game.platform}</p>
        <h1 className="font-display text-3xl sm:text-4xl">{game.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-sun-soft px-4 py-2 font-bold text-sun ring-1 ring-line">
            Where are you? <span className="font-normal">Progress tracking arrives with the first {blocks[0].label.toLowerCase()}</span>
          </span>
          {game.status === 'prelaunch' && (
            <span className="text-sm text-muted"><Countdown date={game.releaseDate} before="Comes out" after="Out now" /></span>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b) => (
          <article key={b.key} className="flex flex-col rounded-3xl bg-card p-5 shadow-soft ring-1 ring-line">
            <span className="grid size-11 place-items-center rounded-2xl bg-leaf-soft text-leaf">
              <BlockIcon name={b.icon} size={20} />
            </span>
            <h2 className="mt-3 font-display text-xl">{b.label}</h2>
            <p className="mt-1 text-sm text-muted">{b.blurb}</p>
            <p className="mt-4 rounded-2xl bg-card-2 px-3 py-2 text-sm">
              Nothing here yet.{' '}
              <Link href={`/g/${game.id}/workshop?block=${b.key}`} className="font-bold text-leaf underline decoration-2 underline-offset-2">
                Be the first to add one
              </Link>
            </p>
          </article>
        ))}
      </section>

      <Link href={`/g/${game.id}/workshop`} className="mt-8 flex items-center gap-4 rounded-3xl bg-leaf-soft p-5 ring-1 ring-line hover:ring-leaf">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-leaf text-paper"><Hammer aria-hidden="true" /></span>
        <span>
          <span className="font-display text-xl">Help build this app</span>
          <span className="block text-muted">Everything here comes from players. Join the Workshop to add, fix or vote.</span>
        </span>
      </Link>
    </main>
  );
}
