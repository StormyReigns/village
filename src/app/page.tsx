import { GAMES } from '@/data/games';
import { MarketDayButton } from '@/components/HowItWorks';
import { GameBrowser } from '@/components/GameBrowser';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
import { Piece } from '@/components/Piece';
import { withCovers } from '@/lib/pictures';
import { Suspense } from 'react';
import type { EntryHit } from '@/components/GameBrowser';
import { getApp } from '@/lib/app-data';
import { sharePath } from '@/data/pages/links';

export default function VillageSquare() {
  return (
    <>
    <TopBar actions={
      <>
        <MarketDayButton className="hidden bg-white/10 text-signal sm:inline-flex" />
        <AccountButton quiet dark />
      </>
    } />
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      {/* The village square's banner: ink, no illustration. Pieces players have built, and
          one empty slot (the split outline) for whatever comes next. */}
      <section className="relative overflow-hidden rounded-2xl bg-ink text-white">
        <div aria-hidden="true" className="absolute right-8 top-1/2 hidden h-[226px] w-[316px] -translate-y-1/2 md:block">
          {(['berry', 'sun', 'plum'] as const).map((tint, i) => (
            <span key={tint} className="absolute" style={{ left: (i % 2) * 170, top: Math.floor(i / 2) * 124 }}>
              <Piece size={146} color={`var(--${tint})`} />
            </span>
          ))}
          <span className="absolute" style={{ left: 170, top: 124 }}><Piece size={146} outline ink="#fff" /></span>
        </div>
        <div className="relative px-6 py-10 sm:px-10 sm:py-14 md:pr-[24rem]">
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">Companion apps, built by the people who play</h1>
          <p className="mt-3 max-w-xl text-white/80">
            Every game gets its own app, shaped by its community. Share what you&apos;ve figured out, vote on
            what others found, and see it land in the app on Market Day.
          </p>
        </div>
      </section>

      <Suspense fallback={<GameBrowser games={withCovers(GAMES)} />}>
        <SearchableBrowser />
      </Suspense>

      {/* Town Hall and "Your games" come back here once they have something to show. */}

      <footer className="mt-12 text-center text-sm text-muted">
        Unofficial fan project. Not affiliated with Nintendo, Intelligent Systems, or any game publisher.
      </footer>
    </main>
    </>
  );
}

// The home search also looks inside every game's app. Spoilers stay out.
async function SearchableBrowser() {
  const lists = await Promise.all(GAMES.map(async (g) => (await getApp(g.id)).flatMap((p) =>
    p.blocks.flatMap((b) => b.entries.filter((e) => !e.spoiler).map((e): EntryHit => ({
      key: `${g.id}.${b.id}.${e.id}`, game: g.shortTitle, name: e.name,
      where: p.title === b.title ? p.title : `${p.title} · ${b.title}`,
      href: sharePath(g.id, p, b, e),
      text: [e.description, ...e.sections.map((x) => x.text), ...Object.values(e.categories)].join(' '),
    }))),
  )));
  return <GameBrowser games={withCovers(GAMES)} entries={lists.flat()} />;
}
