import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { AppHome } from '@/components/app/PageView';

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]'>): Promise<Metadata> {
  const game = getGame((await params).game);
  if (!game) return { title: 'Game' };
  const description = `The ${game.shortTitle} companion app, built and checked by players.`;
  return { title: game.shortTitle, description, openGraph: { title: game.title, description, siteName: 'Village' } };
}

// The game app's front door. The URL is read inside <Suspense> so navigation is instant.
export default function AppHomePage({ params }: PageProps<'/g/[game]'>) {
  return (
    <Suspense fallback={<div className="mt-3 aspect-[3/1] animate-pulse rounded-2xl bg-card" />}>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: { params: PageProps<'/g/[game]'>['params'] }) {
  const found = getGame((await params).game);
  if (!found) notFound();
  const pages = await getApp(found.id);
  const game = found;
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  return (
    <AppHome game={{ id: game.id, shortTitle: game.shortTitle, title: game.title, routes, routeQuestion: game.paths?.question }}
      pages={pages} />
  );
}
