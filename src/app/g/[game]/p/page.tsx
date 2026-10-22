import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES, getGame } from '@/data/games';
import { pagesFor } from '@/data/pages';
import { GameCover } from '@/components/GameCover';
import { BlockIcon } from '@/components/Icon';
import { AppSearch, PageStrip } from '@/components/app/PageView';
import { withCovers } from '@/lib/pictures';

export function generateStaticParams() {
  return GAMES.filter((g) => pagesFor(g.id).length).map((g) => ({ game: g.id }));
}

export async function generateMetadata({ params }: PageProps<'/g/[game]/p'>): Promise<Metadata> {
  return { title: getGame((await params).game)?.shortTitle ?? 'Game' };
}

// The game app's front door: search everything, or pick a Page.
export default function AppHome({ params }: PageProps<'/g/[game]/p'>) {
  return (
    <Suspense fallback={<div className="surface mt-4 aspect-[3/1] animate-pulse rounded-[2rem]" />}>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: { params: PageProps<'/g/[game]/p'>['params'] }) {
  const found = getGame((await params).game);
  const pages = found ? pagesFor(found.id) : [];
  if (!found || !pages.length) notFound();
  const [game] = withCovers([found]);
  const count = (p: (typeof pages)[number]) => p.blocks.reduce((n, b) => n + b.entries.length, 0);

  return (
    <>
      <PageStrip gameId={game.id} pages={pages} />
      <section className="surface mt-2 overflow-hidden rounded-[2rem]">
        <GameCover game={game} className="!aspect-[3/1] !rounded-none" />
        <div className="p-5 sm:p-6">
          <h1 className="font-display text-3xl">{game.title}</h1>
          <div className="mt-4"><AppSearch gameId={game.id} pages={pages} /></div>
        </div>
      </section>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => (
          <li key={p.id}>
            <Link href={`/g/${game.id}/p/${p.id}`} className="surface lift flex h-full gap-4 rounded-[1.75rem] p-4 hover:ring-2 hover:ring-leaf">
              <span className="gloss grid size-12 shrink-0 place-items-center rounded-2xl bg-leaf-soft text-leaf"><BlockIcon name={p.icon} size={22} /></span>
              <span>
                <span className="block font-display text-xl leading-tight">{p.title}</span>
                <span className="mt-1 block text-sm text-muted">{p.blurb}</span>
                <span className="mt-2 block text-xs font-bold text-muted">{p.blocks.map((b) => b.title).join(' · ')} · {count(p)} entries</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
