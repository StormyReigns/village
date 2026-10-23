import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { PageView } from '@/components/app/PageView';
import { TINT_HEX, clip, itemParam, resolveItem, shareAnswer } from '@/data/pages/links';

// A shared Block or entry: /g/fortunes-weave/items/paradise-fish. It shows the Page with
// that entry open (or that Block in view), and gives Discord and other apps a proper
// preview: a title, a short summary, the Page's color, and a picture (opengraph-image).

export async function generateStaticParams() {
  const all = await Promise.all(GAMES.map(async (g) => (await getApp(g.id)).flatMap((p) =>
    p.blocks.flatMap((b) => [b.id, ...b.entries.map((e) => itemParam(p, b, e))]).map((item) => ({ game: g.id, page: p.id, item })),
  )));
  return all.flat();
}

async function find(params: PageProps<'/g/[game]/[page]/[item]'>['params']) {
  const { game: gameId, page: pageId, item } = await params;
  const game = getGame(gameId);
  const page = (await getApp(gameId)).find((p) => p.id === pageId);
  const hit = page ? resolveItem(page, item) : null;
  return { game, page, hit };
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/[page]/[item]'>): Promise<Metadata> {
  const { game, page, hit } = await find(params);
  if (!game || !page || !hit) return { title: 'Not found' };
  const routes = Object.fromEntries((game.paths?.options ?? []).map((o) => [o.key, o.label]));
  const name = hit.entry ? hit.entry.name : hit.block.title;
  // The answer itself, so people in Discord don't need to click (a guide's steps, an
  // item's where-and-what). A whole Block lists what's inside.
  const names = hit.block.entries.filter((e) => !e.spoiler).map((e, i) => (hit.block.type === 'guide' ? `${i + 1}. ${e.name}` : e.name));
  const description = hit.entry
    ? shareAnswer(hit.block, hit.entry, routes).text
    : clip([hit.block.intro, `${hit.block.type === 'guide' ? '' : `${hit.block.entries.length} entries: `}${names.join(hit.block.type === 'guide' ? '  ' : ', ')}`].filter(Boolean).join(' '), 300);
  const title = `${name} · ${game.shortTitle}`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: 'Village', type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
    // Discord colors the edge of the preview with this. It lives here, not in the viewport,
    // so the page can still be prerendered.
    other: { 'theme-color': TINT_HEX[page.tint] },
  };
}


export default function SharedItem({ params }: PageProps<'/g/[game]/[page]/[item]'>) {
  return (
    <Suspense fallback={<div className="mt-3 h-96 animate-pulse rounded-[2rem] bg-card" />}>
      <Loaded params={params} />
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<'/g/[game]/[page]/[item]'>['params'] }) {
  const { game, page, hit } = await find(params);
  if (!game || !page || !hit) notFound();
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  // Guides and timelines show every entry in place; the others open it in a panel.
  const panel = hit.block.type === 'collection' || hit.block.type === 'checklist';
  return (
    <PageView game={{ id: game.id, shortTitle: game.shortTitle, title: game.title, routes, routeQuestion: game.paths?.question }} page={page}
      openOnLoad={hit.entry && panel ? `${hit.block.id}.${hit.entry.id}` : undefined}
      scrollTo={!hit.entry ? hit.block.id : panel ? undefined : `${hit.block.id}-${hit.entry.id}`} />
  );
}
