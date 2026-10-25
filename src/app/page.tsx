import Link from 'next/link';
import Image from 'next/image';
import { Landmark, Store } from 'lucide-react';
import { GAMES } from '@/data/games';
import { VillageScene } from '@/components/VillageScene';
import { MarketDayButton } from '@/components/HowItWorks';
import { GameBrowser } from '@/components/GameBrowser';
import { AccountButton } from '@/components/AccountButton';
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
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display text-2xl">
          <span className="gloss btn-primary grid size-9 place-items-center rounded-2xl">V</span>
          Village
        </div>
        <div className="flex items-center gap-2">
          <MarketDayButton className="surface hidden text-sun sm:inline-flex" />
          <AccountButton />
        </div>
      </header>

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

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/town-hall" className="surface lift flex gap-4 rounded-2xl p-5">
          <span className="gloss grid size-12 shrink-0 place-items-center rounded-2xl bg-sky text-white"><Landmark aria-hidden="true" /></span>
          <span>
            <span className="flex items-center gap-2 font-display text-xl">Town Hall <span className="rounded-full bg-sun-soft px-2 py-0.5 font-sans text-xs font-bold text-sun">Coming soon</span></span>
            <span className="block text-muted">A village-wide square for anything, and requests for the next game. For now, each game&apos;s Workshop has its own chat.</span>
          </span>
        </Link>
        <div className="surface flex gap-4 rounded-2xl p-5">
          <span className="gloss grid size-12 shrink-0 place-items-center rounded-2xl bg-berry text-white"><Store aria-hidden="true" /></span>
          <span>
            <span className="font-display text-xl">Your games</span>
            <span className="block text-muted">Games you visit and help build will gather here, with your badge for each.</span>
          </span>
        </div>
      </section>

      <footer className="mt-12 text-center text-sm text-muted">
        Unofficial fan project. Not affiliated with Nintendo, Intelligent Systems, or any game publisher.
      </footer>
    </main>
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
