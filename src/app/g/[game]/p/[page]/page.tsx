import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/data/games';
import { pagesFor } from '@/data/pages';
import { PageStrip, PageView } from '@/components/app/PageView';

export function generateStaticParams() {
  return GAMES.flatMap((g) => pagesFor(g.id).map((p) => ({ game: g.id, page: p.id })));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/p/[page]'>): Promise<Metadata> {
  const { game, page } = await params;
  const g = getGame(game);
  const p = pagesFor(game).find((x) => x.id === page);
  return { title: p && g ? `${p.title} · ${g.shortTitle}` : 'Page' };
}

// One Page of the game app. The URL is read inside <Suspense> so navigation is instant.
export default function AppPage({ params }: PageProps<'/g/[game]/p/[page]'>) {
  return (
    <Suspense fallback={<div className="mt-4 h-96 animate-pulse rounded-[2rem] bg-card" />}>
      <Loaded params={params} />
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<'/g/[game]/p/[page]'>['params'] }) {
  const { game: gameId, page: pageId } = await params;
  const game = getGame(gameId);
  const pages = pagesFor(gameId);
  const page = pages.find((p) => p.id === pageId);
  if (!game || !page) notFound();
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  return (
    <>
      <PageStrip gameId={game.id} pages={pages.map(({ id, title, icon }) => ({ id, title, icon }))} current={page.id} />
      <PageView game={{ id: game.id, shortTitle: game.shortTitle, routes, routeQuestion: game.paths?.question }} page={page} />
    </>
  );
}
