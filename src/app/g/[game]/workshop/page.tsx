import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
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
    <Suspense fallback={<><TopBar /><main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 sm:px-6"><div className="h-12 w-64 animate-pulse rounded-full bg-card" /></main></>}>
      <LoadedWorkshop params={params} />
    </Suspense>
  );
}

async function LoadedWorkshop({ params }: { params: PageProps<'/g/[game]/workshop'>['params'] }) {
  const game = getGame((await params).game);
  if (!game) notFound();
  const pages = await getApp(game.id);
  const routes = game.paths?.options.map((o) => ({ key: o.key, label: o.label })) ?? [];
  return (
    <>
      <TopBar compact actions={
        <>
          <Link href={`/g/${game.id}`} aria-label="Open the app"
            className="inline-flex items-center gap-2 rounded-full p-2.5 text-sm font-bold ring-1 ring-white/30 hover:ring-white sm:px-4 sm:py-2">
            <span className="hidden sm:inline">Open the app</span> <ExternalLink size={16} aria-hidden="true" />
          </Link>
          <AccountButton quiet dark />
        </>
      }>
        <span className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />
        <span className="min-w-0 truncate font-bold">Workshop</span>
      </TopBar>
      <Workshop game={{ id: game.id, shortTitle: game.shortTitle, title: game.title }} pages={pages} routes={routes} />
    </>
  );
}
