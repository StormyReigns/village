import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { Workshop } from './Workshop';

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/workshop'>): Promise<Metadata> {
  const game = getGame((await params).game);
  if (!game) return { title: 'Workshop' };
  const title = `${game.shortTitle} Workshop`;
  const description = `Help build the ${game.shortTitle} companion app: suggest fixes, add what's missing, and vote.`;
  return { title, description, openGraph: { title, description, siteName: 'Village' } };
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
  const pages = await getApp(game.id);
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  return <Workshop game={{ id: game.id, shortTitle: game.shortTitle, title: game.title }} pages={pages} routes={routes} />;
}
