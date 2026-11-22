import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { findGame, getGames } from '@/lib/games-data';
import { getApp } from '@/lib/app-data';
import { AppHome } from '@/components/app/PageView';

export async function generateStaticParams() {
  return (await getGames()).map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]'>): Promise<Metadata> {
  const game = await findGame((await params).game);
  if (!game) return { title: 'Game' };
  const description = `The ${game.shortTitle} companion app, built and checked by players.`;
  return { title: game.shortTitle, description, openGraph: { title: game.title, description, siteName: 'Village' },
    // Not launched yet (docs/games.md): reachable by its link, kept out of search engines.
    ...(game.status === 'building' ? { robots: { index: false, follow: false } } : {}) };
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
  const found = await findGame((await params).game);
  if (!found) notFound();
  const pages = await getApp(found.id);
  const game = found;
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  return (
    <AppHome game={{ id: game.id, shortTitle: game.shortTitle, title: game.title, routes, routeQuestion: game.paths?.question, building: game.status === 'building' }}
      pages={pages} />
  );
}
