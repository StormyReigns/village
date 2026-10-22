import { Suspense } from 'react';
import { getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { AppNav } from '@/components/app/AppNav';
import { withCovers } from '@/lib/pictures';

// The game app: Pages made of Blocks, read from the database.
// Computers get a sidebar; phones get a top bar and a bottom tab bar.
export default function AppLayout({ children, params }: LayoutProps<'/g/[game]'>) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-0 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-4 lg:pb-16 lg:pt-5">
      <Suspense fallback={<div className="h-12" />}>
        <Nav params={params} />
      </Suspense>
      <main className="min-w-0 lg:col-start-2">{children}</main>
    </div>
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
