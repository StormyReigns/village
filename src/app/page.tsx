import Link from 'next/link';
import Image from 'next/image';
import { Landmark, Store } from 'lucide-react';
import { GAMES } from '@/data/games';
import { VillageScene } from '@/components/VillageScene';
import { MarketDay } from '@/components/Countdown';
import { GameBrowser } from '@/components/GameBrowser';
import { findPicture, withCovers } from '@/lib/pictures';

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
        <span className="surface rounded-full px-3 py-1 text-sm font-bold text-sun"><MarketDay /></span>
      </header>

      <section className="surface mt-5 overflow-hidden rounded-[2rem]">
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

      <GameBrowser games={withCovers(GAMES)} />

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/town-hall" className="surface lift flex gap-4 rounded-3xl p-5">
          <span className="gloss grid size-12 shrink-0 place-items-center rounded-2xl bg-sky text-white"><Landmark aria-hidden="true" /></span>
          <span>
            <span className="font-display text-xl">Town Hall</span>
            <span className="block text-muted">Talk about anything, ask for help, and request the next game.</span>
          </span>
        </Link>
        <div className="surface flex gap-4 rounded-3xl p-5">
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
