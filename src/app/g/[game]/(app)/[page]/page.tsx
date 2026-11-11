import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { classKin } from '@/lib/class-fit';
import { PageView } from '@/components/app/PageView';
import { entryLinks, mapMentions, movedPagePath } from '@/data/pages/links';
import { shadeHex } from '@/lib/shades';
import { questionsPage } from '@/lib/questions';

export async function generateStaticParams() {
  const all = await Promise.all(GAMES.map(async (g) => (await getApp(g.id)).map((p) => ({ game: g.id, page: p.id }))));
  return all.flat();
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/[page]'>): Promise<Metadata> {
  const { game, page } = await params;
  const g = getGame(game);
  const p = (await getApp(game)).find((x) => x.id === page);
  if (!p || !g) return { title: 'Page' };
  const title = `${p.title} · ${g.shortTitle}`;
  return {
    title,
    description: p.blurb,
    openGraph: { title, description: p.blurb, siteName: 'Village' },
    twitter: { card: 'summary_large_image', title, description: p.blurb },
    // Discord colors the edge of the preview with this. It lives here, not in the viewport,
    // so the page can still be prerendered.
    other: { 'theme-color': shadeHex(p.tint, g.shade) },
  };
}


// One Page of the game app. The URL is read inside <Suspense> so navigation is instant.
export default function AppPage({ params, searchParams }: PageProps<'/g/[game]/[page]'>) {
  return (
    <Suspense fallback={<div className="mt-3 h-96 animate-pulse rounded-2xl bg-card" />}>
      <Loaded params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loaded({ params, searchParams }: { params: PageProps<'/g/[game]/[page]'>['params']; searchParams: PageProps<'/g/[game]/[page]'>['searchParams'] }) {
  const { game: gameId, page: pageId } = await params;
  const game = getGame(gameId);
  const pages = await getApp(gameId);
  const page = pages.find((p) => p.id === pageId);
  if (!game) notFound();
  if (!page) {
    // An old address (a Page that moved or was renamed): the query is only read here, so pages
    // that exist still prerender.
    const to = movedPagePath(game.id, pages, game.movedPages, pageId, await searchParams);
    if (to) redirect(to);
    notFound();
  }
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  return (
    <PageView game={{ id: game.id, shortTitle: game.shortTitle, title: game.title, routes, routeQuestion: game.paths?.question }} page={page} links={entryLinks(game.id, pages)} mentions={mapMentions(game.id, pages, page)} kin={classKin(game.id, pages, page)}
      pages={pages.map((p) => ({ id: p.id, title: p.title, short: p.short, tint: p.tint }))} questionsPage={questionsPage(pages)?.id} />
  );
}
