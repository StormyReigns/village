import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/data/games';
import { pagesFor } from '@/data/pages';
import { AppHome } from '@/components/app/PageView';
import { withCovers } from '@/lib/pictures';

export function generateStaticParams() {
  return GAMES.filter((g) => pagesFor(g.id).length).map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/p'>): Promise<Metadata> {
  return { title: getGame((await params).game)?.shortTitle ?? 'Game' };
}

// The game app's front door. The URL is read inside <Suspense> so navigation is instant.
export default function AppHomePage({ params }: PageProps<'/g/[game]/p'>) {
  return (
    <Suspense fallback={<div className="mt-3 aspect-[3/1] animate-pulse rounded-[2rem] bg-card" />}>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: { params: PageProps<'/g/[game]/p'>['params'] }) {
  const found = getGame((await params).game);
  const pages = found ? pagesFor(found.id) : [];
  if (!found || !pages.length) notFound();
  const [game] = withCovers([found]);
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  return (
    <AppHome game={{ id: game.id, shortTitle: game.shortTitle, title: game.title, routes, routeQuestion: game.paths?.question }}
      pages={pages} cover={game.cover} />
  );
}
