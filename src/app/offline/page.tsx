import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';
import { TopBar } from '@/components/Logo';
import { Piece } from '@/components/Piece';
import { SavedPages } from './SavedPages';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

// Shown by the phone app's service worker (public/sw.js) when a page you haven't opened before
// can't load without a connection. It lists the pages that do still work.
export default function Offline() {
  return (
    <>
      <TopBar />
      <main className="mx-auto grid w-full max-w-md flex-1 content-start gap-4 px-4 py-12">
        <div className="surface grid justify-items-center gap-3 rounded-2xl p-8 text-center">
          <Piece size={88} outline><WifiOff size={22} strokeWidth={2.4} aria-hidden="true" /></Piece>
          <h1 className="font-display text-3xl">No connection</h1>
          <p className="text-muted">This page needs the internet the first time. Pages you&apos;ve opened before still work.</p>
        </div>
        <SavedPages />
      </main>
    </>
  );
}
