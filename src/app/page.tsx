import Link from 'next/link';
import { Landmark, Search, Sparkles, Store } from 'lucide-react';
import { GAMES, type Game } from '@/data/games';
import { VillageScene } from '@/components/VillageScene';
import { Countdown, MarketDay } from '@/components/Countdown';

const HUE: Record<Game['hue'], string> = {
  berry: 'bg-berry-soft text-berry',
  sky: 'bg-sky-soft text-sky',
  leaf: 'bg-leaf-soft text-leaf',
  sun: 'bg-sun-soft text-sun',
};

export default function VillageSquare() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display text-2xl">
          <span className="grid size-9 place-items-center rounded-2xl bg-leaf text-paper">V</span>
          Village
        </div>
        <span className="rounded-full bg-sun-soft px-3 py-1 text-sm font-bold text-sun"><MarketDay /></span>
      </header>

      <section className="mt-6 overflow-hidden rounded-[2rem] bg-card shadow-soft ring-1 ring-line">
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <h1 className="font-display text-3xl sm:text-4xl">Companion apps, built by the people who play</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every game gets its own app, shaped by its community. Share what you&apos;ve figured out, vote on
            what others found, and see it land in the app on Market Day.
          </p>
          <label className="mt-5 flex max-w-xl items-center gap-2 rounded-full bg-card-2 px-4 py-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
            <Search size={18} className="text-muted" aria-hidden="true" />
            <input className="w-full bg-transparent outline-none placeholder:text-muted" placeholder="Find a game" aria-label="Find a game" />
          </label>
        </div>
        <VillageScene />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Games in the village</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {GAMES.map((g) => (
            <article key={g.id} className="flex flex-col rounded-3xl bg-card p-5 shadow-soft ring-1 ring-line">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{g.platform}</p>
                  <h3 className="font-display text-2xl leading-tight">{g.shortTitle}</h3>
                </div>
                <span className={'rounded-full px-3 py-1 text-xs font-bold ' + HUE[g.hue]}>
                  {g.status === 'prelaunch' ? <Countdown date={g.releaseDate} before="Out" after="Out now" /> : 'Live'}
                </span>
              </div>
              {g.next && <p className="mt-3 flex items-center gap-2 text-sm"><Sparkles size={16} className="text-sun" aria-hidden="true" />{g.next}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/g/${g.id}`} className="rounded-full bg-leaf px-4 py-2 font-bold text-paper hover:opacity-90">Open the app</Link>
                <Link href={`/g/${g.id}/workshop`} className="rounded-full bg-card-2 px-4 py-2 font-bold ring-1 ring-line hover:ring-leaf">Visit the Workshop</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/town-hall" className="group flex gap-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-line hover:ring-sky">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-soft text-sky"><Landmark aria-hidden="true" /></span>
          <span>
            <span className="font-display text-xl">Town Hall</span>
            <span className="block text-muted">Talk about anything, ask for help, and request the next game.</span>
          </span>
        </Link>
        <div className="flex gap-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-line">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-berry-soft text-berry"><Store aria-hidden="true" /></span>
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
