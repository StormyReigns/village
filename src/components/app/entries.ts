'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Entry, Route } from '@/data/pages';
import type { Searchable } from '@/lib/search';
import { useVillager } from '@/components/useVillager';
import { browserClient } from '@/lib/supabase/browser';

// Small helpers shared by the game app's Blocks.

const TINTS = ['bg-leaf-soft text-leaf', 'bg-sky-soft text-sky', 'bg-berry-soft text-berry', 'bg-sun-soft text-sun', 'bg-plum-soft text-plum', 'bg-teal-soft text-teal'];

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

/** An entry as search sees it: its name, and all its other words (see src/lib/search.ts). */
export function entryText(e: Entry): Searchable {
  const text = [
    e.description, ...e.sections.map((s) => `${s.label} ${s.text}`), ...Object.values(e.categories),
    ...Object.values(e.perRoute ?? {}).flat().map((s) => s.text),
  ].join(' ');
  return { name: e.name, text };
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
    // A fresh state object, never Next's own: Next ignores updates that carry its internal
    // state, so the page wouldn't notice the change.
    else window.history.replaceState({ villageEntry: Boolean(window.history.state?.villageEntry) }, '', url);
  }, []);
  const close = useCallback(() => {
    // Opened from this page: step back, so Back and Close agree. Opened from a link: just drop it.
    if (window.history.state?.villageEntry) window.history.back();
    else set(null, 'replace');
  }, [set]);
  return { open, set, close };
}

export interface Recent { href: string; name: string; where: string }

/** Remembers the last few entries opened on this device, for "Pick up where you left off". */
export function rememberEntry(gameId: string, item: Recent) {
  try {
    const key = `village:${gameId}:recent`;
    const list: Recent[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    localStorage.setItem(key, JSON.stringify([item, ...list.filter((r) => r.href !== item.href)].slice(0, 8)));
  } catch { /* storage unavailable */ }
}

export function useRecent(gameId: string) {
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
      setRecent(JSON.parse(localStorage.getItem(`village:${gameId}:recent`) ?? '[]'));
    } catch { /* storage unavailable */ }
  }, [gameId]);
  return recent;
}

// Your marks in a game: checklist ticks ("block.entry") and recruited units
// ("recruited:block.entry"). One shared store per game, so every Block and panel agrees.
// Kept on this device; when you're signed in, also in your account (public.player_marks),
// so they follow you to every device.
interface TickStore { ticks: Set<string>; listeners: Set<() => void>; loaded: boolean; account?: string }
const tickStores = new Map<string, TickStore>();
const NO_TICKS = new Set<string>();

function tickStore(gameId: string) {
  let s = tickStores.get(gameId);
  if (!s) { s = { ticks: NO_TICKS, listeners: new Set(), loaded: false }; tickStores.set(gameId, s); }
  return s;
}

function setTicks(gameId: string, next: Set<string>) {
  const s = tickStore(gameId);
  s.ticks = next;
  try { localStorage.setItem(`village:${gameId}:ticks`, JSON.stringify([...next])); } catch { /* storage unavailable */ }
  s.listeners.forEach((l) => l());
}

/** Reads this device's ticks, once per game. */
function loadTicks(gameId: string) {
  const s = tickStore(gameId);
  if (s.loaded) return;
  s.loaded = true;
  try { setTicks(gameId, new Set(JSON.parse(localStorage.getItem(`village:${gameId}:ticks`) ?? '[]'))); } catch { /* start empty */ }
}

/** Signed in: merge with your account once, and send up anything ticked on this device. */
function linkTicks(gameId: string, profileId: string) {
  const s = tickStore(gameId);
  const db = browserClient();
  if (!db || s.account === profileId) return;
  s.account = profileId;
  db.from('player_marks').select('mark').eq('game_id', gameId).then(({ data, error }) => {
    if (error) { s.account = undefined; return; } // no table yet: stay on this device
    const saved = new Set((data ?? []).map((r) => r.mark as string));
    const fresh = [...s.ticks].filter((t) => !saved.has(t));
    if (fresh.length) db.from('player_marks').insert(fresh.map((mark) => ({ profile_id: profileId, game_id: gameId, mark }))).then(() => {});
    setTicks(gameId, new Set([...s.ticks, ...saved]));
  });
}

function flipTick(gameId: string, id: string) {
  const s = tickStore(gameId);
  const next = new Set(s.ticks);
  const on = !next.has(id);
  if (on) next.add(id); else next.delete(id);
  setTicks(gameId, next);
  const db = browserClient();
  if (!db || !s.account) return;
  if (on) db.from('player_marks').insert({ profile_id: s.account, game_id: gameId, mark: id }).then(() => {});
  else db.from('player_marks').delete().eq('profile_id', s.account).eq('game_id', gameId).eq('mark', id).then(() => {});
}

export function useTicks(gameId: string) {
  const me = useVillager();
  const ticks = useSyncExternalStore(
    (cb) => { const s = tickStore(gameId); s.listeners.add(cb); return () => { s.listeners.delete(cb); }; },
    () => tickStore(gameId).ticks,
    () => NO_TICKS,
  );
  useEffect(() => loadTicks(gameId), [gameId]);
  useEffect(() => { if (me?.id) linkTicks(gameId, me.id); }, [gameId, me?.id]);
  const toggle = useCallback((id: string) => flipTick(gameId, id), [gameId]);
  return [ticks, toggle] as const;
}
