import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
import { StartGame } from './StartGame';

export const metadata: Metadata = {
  title: 'Start a game',
  description: "Start a companion app for a game that isn't in Village yet. Its Workshop opens right away.",
};

// Starting a game (docs/games.md, slice 2). The name a search didn't find arrives as ?name=, read inside <Suspense>.
export default function StartPage() {
  return (
    <>
      <TopBar actions={<AccountButton quiet dark />} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-card ring-1 ring-line" />}>
          <StartGame />
        </Suspense>
      </main>
    </>
  );
}
