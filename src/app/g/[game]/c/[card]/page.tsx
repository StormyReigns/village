import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Hammer, TriangleAlert, CircleHelp } from 'lucide-react';
import { GAMES, blocksFor, getGame } from '@/data/games';
import { cardFor, cardsFor } from '@/data/content';
import { CardPreview } from '@/components/CardPreview';
import { CardChips } from '@/components/CardChips';

export function generateStaticParams() {
  return GAMES.flatMap((g) => cardsFor(g.id).map((c) => ({ game: g.id, card: c.slug })));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/c/[card]'>): Promise<Metadata> {
  const { game, card } = await params;
  const c = cardFor(game, card);
  return { title: c ? `${c.title} · ${getGame(game)?.shortTitle ?? ''}` : 'Card' };
}

export default function CardPage({ params }: PageProps<'/g/[game]/c/[card]'>) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl px-4 pt-6"><div className="surface h-64 animate-pulse rounded-[2rem]" /></main>}>
      <LoadedCard params={params} />
    </Suspense>
  );
}

async function LoadedCard({ params }: { params: PageProps<'/g/[game]/c/[card]'>['params'] }) {
  const { game: gameId, card: slug } = await params;
  const game = getGame(gameId);
  const card = game && cardFor(game.id, slug);
  if (!game || !card) notFound();
  const block = blocksFor(game).find((b) => b.key === card.block)!;
  const routeLabels = Object.fromEntries((game.paths?.options ?? []).map((o) => [o.key, o.label]));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/g/${game.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> {game.shortTitle}
        </Link>
        <Link href={`/g/${game.id}/b/${block.key}`} className="text-sm font-bold text-leaf">All {block.label.toLowerCase()}</Link>
      </div>

      <div className="mt-4"><CardPreview block={block} content={card.content} label={block.label} /></div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CardChips card={card} showRoutes routeLabels={routeLabels} />
        {card.spoiler && <span className="rounded-full bg-card-2 px-2 py-0.5 text-xs font-bold text-muted">Contains spoilers</span>}
      </div>

      {card.flag && (
        <p className="surface mt-4 flex gap-3 rounded-2xl p-4 text-sm">
          {card.flag === 'disputed'
            ? <><TriangleAlert size={18} className="mt-0.5 shrink-0 text-sun" aria-hidden="true" /><span>Guides disagree about part of this. If you&apos;ve seen it in your game, you can settle it in the Workshop.</span></>
            : <><CircleHelp size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /><span>Nobody has documented this fully yet. Know the answer? Add it in the Workshop.</span></>}
        </p>
      )}

      <div className="surface mt-4 rounded-2xl p-4 text-sm text-muted">
        <p><span className="font-bold text-ink">Source:</span> {card.source}</p>
        <p className="mt-1">Not checked by the community yet.</p>
      </div>

      <Link href={`/g/${game.id}/workshop?block=${block.key}`} className="gloss btn-primary mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-bold">
        <Hammer size={18} aria-hidden="true" /> Suggest a fix
      </Link>
    </main>
  );
}
