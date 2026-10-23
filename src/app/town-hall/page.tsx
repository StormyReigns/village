import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Hammer, Landmark } from 'lucide-react';
import { GAMES } from '@/data/games';

export const metadata: Metadata = { title: 'Town Hall' };

// Platform-wide square. Not built yet: until it is, this page says so plainly and points
// to where conversations happen today, each game's Workshop chat.
export default function TownHall() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Village square
      </Link>
      <section className="mt-4 rounded-[2rem] bg-card p-8 text-center shadow-soft ring-1 ring-line">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sky-soft text-sky"><Landmark aria-hidden="true" /></span>
        <h1 className="mt-4 flex items-center justify-center gap-2 font-display text-3xl">
          Town Hall <span className="rounded-full bg-sun-soft px-2.5 py-0.5 font-sans text-sm font-bold text-sun">Coming soon</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          A village-wide square for questions, show-and-tell, and requests for the next game. It isn&apos;t built yet.
          Until it is, each game&apos;s Workshop has its own chat, open to everyone signed in.
        </p>
        <ul className="mx-auto mt-6 grid max-w-sm gap-2">
          {GAMES.map((g) => (
            <li key={g.id}>
              <Link href={`/g/${g.id}/workshop`} className="btn-quiet flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-bold">
                <Hammer size={16} className="text-leaf" aria-hidden="true" /> {g.shortTitle} Workshop
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
