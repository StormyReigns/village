import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MapSample } from './MapSample';

export const metadata: Metadata = { title: 'Map sample', robots: { index: false } };

// The World map (docs/blocks/world.md) with a made-up picture and places, so it can be tried on
// a computer and a phone before any game has a map picture. Not linked from the site.
export default function MapLab() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-2xl">Map sample</h1>
      <p className="text-sm text-muted">A made-up world. Tap a pin; zoom with two fingers, Ctrl + wheel or the buttons.</p>
      <Suspense><MapSample /></Suspense>
    </main>
  );
}
