import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, blocksFor, getGame } from '@/data/games';
import { Workshop } from './Workshop';

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/workshop'>): Promise<Metadata> {
  const game = getGame((await params).game);
  return { title: game ? `${game.shortTitle} Workshop` : 'Workshop' };
}

// The URL is read inside <Suspense> so navigation can show the shell instantly.
export default function WorkshopPage({ params }: PageProps<'/g/[game]/workshop'>) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 sm:px-6"><div className="h-12 w-64 animate-pulse rounded-full bg-card" /></main>}>
      <LoadedWorkshop params={params} />
    </Suspense>
  );
}

async function LoadedWorkshop({ params }: { params: PageProps<'/g/[game]/workshop'>['params'] }) {
  const game = getGame((await params).game);
  if (!game) notFound();
  return <Workshop game={{ id: game.id, shortTitle: game.shortTitle, title: game.title }} blocks={blocksFor(game)} />;
}
