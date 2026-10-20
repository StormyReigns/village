import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Landmark } from 'lucide-react';

export const metadata: Metadata = { title: 'Town Hall' };

// Platform-wide forum. It will reuse the Workshop layout, with topics where blocks go.
export default function TownHall() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Village square
      </Link>
      <section className="mt-4 rounded-[2rem] bg-card p-8 text-center shadow-soft ring-1 ring-line">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sky-soft text-sky"><Landmark aria-hidden="true" /></span>
        <h1 className="mt-4 font-display text-3xl">Town Hall</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          The village-wide square for questions, help, show-and-tell, and requests for the next game.
          It opens once sign-in is connected.
        </p>
      </section>
    </main>
  );
}
