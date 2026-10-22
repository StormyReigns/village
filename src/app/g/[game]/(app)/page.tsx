import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { AppHome } from '@/components/app/PageView';
import { withCovers } from '@/lib/pictures';

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]'>): Promise<Metadata> {
  return { title: getGame((await params).game)?.shortTitle ?? 'Game' };
}

// The game app's front door. The URL is read inside <Suspense> so navigation is instant.
export default function AppHomePage({ params }: PageProps<'/g/[game]'>) {
  return (
    <Suspense fallback={<div className="mt-3 aspect-[3/1] animate-pulse rounded-[2rem] bg-card" />}>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: { params: PageProps<'/g/[game]'>['params'] }) {
  const found = getGame((await params).game);
  if (!found) notFound();
  const pages = await getApp(found.id);
  const [game] = withCovers([found]);
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  return (
    <AppHome game={{ id: game.id, shortTitle: game.shortTitle, title: game.title, routes, routeQuestion: game.paths?.question }}
      pages={pages} cover={game.cover} />
  );
}
