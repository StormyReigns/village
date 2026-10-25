import Image from 'next/image';
import { GAMES } from '@/data/games';
import { VillageScene } from '@/components/VillageScene';
import { MarketDayButton } from '@/components/HowItWorks';
import { GameBrowser } from '@/components/GameBrowser';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
import { findPicture, withCovers } from '@/lib/pictures';
import { Suspense } from 'react';
import type { EntryHit } from '@/components/GameBrowser';
import { getApp } from '@/lib/app-data';
import { sharePath } from '@/data/pages/links';

// Save a wide picture as public/village/hero.png (or .webp/.jpg) and it replaces the
// drawn village automatically.
const HERO = findPicture('/village/hero');

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
      <section className="surface mt-5 overflow-hidden rounded-2xl">
        <div className="relative">
          {HERO ? (
            <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
              <Image src={HERO} alt="A builder with a blueprint looks out over the village" fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover object-[50%_55%]" />
            </div>
          ) : (
            <div className="bg-gradient-to-b from-sky-soft to-card pt-6"><VillageScene /></div>
          )}
        </div>
        <div className="px-6 pb-7 pt-2 text-center sm:px-10">
          <h1 className="font-display text-3xl sm:text-4xl">Companion apps, built by the people who play</h1>
          <p className="mx-auto mt-2 max-w-2xl text-muted">
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
