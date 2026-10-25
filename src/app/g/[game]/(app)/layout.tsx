import { Suspense } from 'react';
import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { AppNav } from '@/components/app/AppNav';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
import { GameShade } from '@/components/GameShade';
import { withCovers } from '@/lib/pictures';

// The game app: Pages made of Blocks, read from the database. The ink bar runs across the
// top; computers get a sidebar, phones a bottom tab bar.
export default function AppLayout({ children, params }: LayoutProps<'/g/[game]'>) {
  return (
    // Everything in the game's app takes its genre shade.
    <GameShade className="flex flex-1 flex-col">
      <Suspense fallback={<TopBar compact />}>
        <Bar params={params} />
      </Suspense>
      <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-8 lg:pb-16 lg:pt-6">
        <Suspense fallback={null}>
          <Nav params={params} />
        </Suspense>
        <main className="min-w-0 lg:col-start-2">{children}</main>
      </div>
    </GameShade>
  );
}

/** The ink bar: the game's name (back to the app's front page), the Workshop and your account. */
async function Bar({ params }: { params: LayoutProps<'/g/[game]'>['params'] }) {
  const { game: id } = await params;
  const game = getGame(id);
  return (
    <TopBar compact actions={
      <>
        {/* The hammer alone meant nothing to new players, so it always says what it's for. */}
        <Link href={`/g/${id}/workshop`} className="btn-primary inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold sm:px-4">
          <Hammer size={16} aria-hidden="true" />Workshop
        </Link>
        <AccountButton quiet dark />
      </>
    }>
      {game && (
        <>
          <span className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />
          <Link href={`/g/${id}`} className="min-w-0 truncate font-bold">{game.shortTitle}</Link>
        </>
      )}
    </TopBar>
  );
}

async function Nav({ params }: { params: LayoutProps<'/g/[game]'>['params'] }) {
  const { game: id } = await params;
  const found = getGame(id);
  if (!found) return null;
  const [game] = withCovers([found]);
  const pages = (await getApp(id)).map((p) => ({
    id: p.id, title: p.title, short: p.short, icon: p.icon, tint: p.tint,
    count: p.blocks.reduce((n, b) => n + b.entries.length, 0),
  }));
  return <AppNav game={{ id: game.id, shortTitle: game.shortTitle, cover: game.cover }} pages={pages} />;
}
