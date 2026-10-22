'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Entry, Route } from '@/data/pages';

// Small helpers shared by the game app's Blocks.

const TINTS = ['bg-leaf-soft text-leaf', 'bg-sky-soft text-sky', 'bg-berry-soft text-berry', 'bg-sun-soft text-sun'];

/** A steady soft color for a word, so each group or type gets its own tint. */
export function tintFor(word: string) {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function initials(name: string) {
  return name.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** Does this entry show for the player's route? Entries without routes show everywhere. */
export function onRoute(e: Entry, route: Route | 'all') {
  return route === 'all' || !e.routes?.length || e.routes.includes(route);
}

/** Every search word has to appear somewhere in the entry. */
export function matches(e: Entry, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [
    e.name, e.description, ...e.sections.map((s) => `${s.label} ${s.text}`), ...Object.values(e.categories),
    ...Object.values(e.perRoute ?? {}).flat().map((s) => s.text),
  ].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * Which entry's details are open, kept in the address (?e=block.entry) so links can be
 * shared and the phone's back button closes the panel.
 */
export function useOpenEntry() {
  const open = useSearchParams().get('e');
  const set = useCallback((key: string | null, how: 'push' | 'replace' = 'push') => {
    const url = new URL(window.location.href);
    if (key) url.searchParams.set('e', key);
    else url.searchParams.delete('e');
    if (how === 'push') window.history.pushState({ villageEntry: Boolean(key) }, '', url);
    else window.history.replaceState(window.history.state, '', url);
  }, []);
  const close = useCallback(() => {
    // Opened from this page: step back, so Back and Close agree. Opened from a link: just drop it.
    if (window.history.state?.villageEntry) window.history.back();
    else set(null, 'replace');
  }, [set]);
  return { open, set, close };
}
