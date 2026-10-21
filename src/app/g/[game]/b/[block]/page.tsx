import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { GAMES, blocksFor, getGame } from '@/data/games';
import { cardsFor } from '@/data/content';
import { BlockIcon } from '@/components/Icon';
import { BlockList } from './BlockList';

export function generateStaticParams() {
  return GAMES.flatMap((g) => blocksFor(g).map((b) => ({ game: g.id, block: b.key })));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/b/[block]'>): Promise<Metadata> {
  const { game, block } = await params;
  const g = getGame(game);
  const b = g && blocksFor(g).find((x) => x.key === block);
  return { title: b && g ? `${b.label} · ${g.shortTitle}` : 'Block' };
}

export default function BlockPage({ params }: PageProps<'/g/[game]/b/[block]'>) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 pt-6"><div className="surface h-40 animate-pulse rounded-[2rem]" /></main>}>
      <LoadedBlock params={params} />
    </Suspense>
  );
}

async function LoadedBlock({ params }: { params: PageProps<'/g/[game]/b/[block]'>['params'] }) {
  const { game: gameId, block: key } = await params;
  const game = getGame(gameId);
  const block = game && blocksFor(game).find((b) => b.key === key);
  if (!game || !block) notFound();
  const cards = cardsFor(game.id).filter((c) => c.block === block.key);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <Link href={`/g/${game.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> {game.shortTitle}
      </Link>
      <header className="mt-4 flex items-center gap-3">
        <span className="gloss grid size-12 place-items-center rounded-2xl bg-leaf text-white"><BlockIcon name={block.icon} size={22} /></span>
        <div>
          <h1 className="font-display text-3xl leading-tight">{block.label}</h1>
          <p className="text-muted">{block.blurb}</p>
        </div>
      </header>
      <BlockList game={{ id: game.id, shortTitle: game.shortTitle, paths: game.paths }} block={block} cards={cards} />
    </main>
  );
}
