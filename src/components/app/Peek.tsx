'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Entry, Page, Route } from '@/data/pages';
import { sharePath } from '@/data/pages/links';
import { KinProvider } from '@/components/classes/kin';
import { EntryPanel, type RouteOption } from './EntryPanel';
import { LinksProvider } from './EntryLinks';
import { clearKey } from '@/components/world/PictureMap';
import { onRoute, rememberEntry } from './entries';
import { peekEntry, type Peeked } from './peek-action';

// Pop-ups never switch Pages (Matt, 2026-11-17). A link to an entry, inside a card or a pop-up,
// opens that entry in a pop-up on top, even when it lives on another Page. Closing it (X, Esc,
// the backdrop or Back) shows what was there before, e.g. the unit whose class you tapped.
// It's kept in the address as ?peek=<page>/<item>, so Back closes it like the first pop-up.

interface PeekApi {
  open: (href: string) => boolean;
  prefetch: (href: string) => void;
}

const PeekContext = createContext<PeekApi | null>(null);

/** Where an entry link points, if it's an entry of this game: its Page and item. */
function parse(href: string, gameId: string): { page: string; item: string } | null {
  const m = href.match(/^\/g\/([^/?#]+)\/([^/?#]+)(?:\/([^/?#]+))?(?:\?e=([^&#]+))?$/);
  if (!m || m[1] !== gameId) return null;
  const item = m[3] ?? m[4];
  return item ? { page: m[2], item: decodeURIComponent(item) } : null;
}

const cache = new Map<string, Promise<Peeked | null>>();
function load(gameId: string, page: string, item: string) {
  const key = `${gameId}/${page}/${item}`;
  let p = cache.get(key);
  if (!p) {
    p = peekEntry(gameId, page, item).catch(() => null);
    cache.set(key, p);
  }
  return p;
}

export function PeekProvider({ gameId, page, route, routes, spoilers, children }: {
  gameId: string; page: Page; route: Route | 'all'; routes: RouteOption[]; spoilers: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const param = useSearchParams().get('peek');
  const [at, item] = useMemo(() => {
    if (!param) return [null, null];
    const i = param.indexOf('/');
    return i > 0 ? [param.slice(0, i), param.slice(i + 1)] : [null, null];
  }, [param]);

  const set = useCallback((value: string | null, how: 'push' | 'replace') => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('peek', value);
    else url.searchParams.delete('peek');
    if (how === 'push') window.history.pushState({ villagePeek: true }, '', url);
    else window.history.replaceState({ villagePeek: Boolean(window.history.state?.villagePeek) }, '', url);
  }, []);

  const api = useMemo<PeekApi>(() => ({
    open: (href) => {
      const to = parse(href, gameId);
      if (!to) return false;
      set(`${to.page}/${to.item}`, 'push');
      return true;
    },
    prefetch: (href) => {
      const to = parse(href, gameId);
      if (to && to.page !== page.id) void load(gameId, to.page, to.item);
    },
  }), [gameId, page.id, set]);

  const close = useCallback(() => {
    if (window.history.state?.villagePeek) window.history.back();
    else set(null, 'replace');
  }, [set]);

  // An entry on this Page needs no trip to the server.
  const local = useMemo<Peeked | null>(() => {
    if (at !== page.id || !item) return null;
    const [b, e] = item.includes('.') ? item.split('.') : [null, item];
    const block = b ? page.blocks.find((x) => x.id === b) : page.blocks.find((x) => x.entries.some((y) => y.id === e));
    const entry = block?.entries.find((y) => y.id === e);
    return block && entry ? { page: { id: page.id, title: page.title, tint: page.tint }, block, entry, sharePath: sharePath(gameId, page, block, entry), links: { targets: {}, incoming: {} }, kin: [] } : null;
  }, [at, item, page, gameId]);

  const [remote, setRemote] = useState<{ key: string; data: Peeked | null } | null>(null);
  const key = at && item && at !== page.id ? `${at}/${item}` : null;
  useEffect(() => {
    if (!key || !at || !item) return;
    let live = true;
    load(gameId, at, item).then((data) => {
      if (!live) return;
      // Not an entry after all (moved, removed): go there the usual way.
      if (!data) { router.push(`/g/${gameId}/${at}/${encodeURIComponent(item)}`); return; }
      setRemote({ key, data });
    });
    return () => { live = false; };
  }, [key, at, item, gameId, router]);

  const shown = local ?? (key && remote?.key === key ? remote.data : null);
  const loading = Boolean(key) && !shown;

  return (
    <PeekContext.Provider value={api}>
      {children}
      {shown && <PeekPanel peeked={shown} gameId={gameId} route={route} routes={routes} spoilers={spoilers} local={Boolean(local)}
        onGo={(e) => set(`${shown.page.id}/${shown.block.id}.${e.id}`, 'replace')} onClose={close} />}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={close}>
          <div role="status" aria-label="Opening" className="h-72 w-full max-w-lg animate-pulse rounded-t-[2rem] bg-card sm:rounded-[2rem]" />
        </div>
      )}
    </PeekContext.Provider>
  );
}

function PeekPanel({ peeked, gameId, route, routes, spoilers, local, onGo, onClose }: {
  peeked: Peeked; gameId: string; route: Route | 'all'; routes: RouteOption[]; spoilers: boolean; local: boolean;
  onGo: (e: Entry) => void; onClose: () => void;
}) {
  const { block, entry } = peeked;
  // A card opened in a pop-up counts as looked at, for the home's Recent chips (docs/app-design.md).
  useEffect(() => {
    rememberEntry(gameId, { href: `/g/${gameId}/${peeked.page.id}?e=${block.id}.${entry.id}`, name: entry.name, where: peeked.page.title === block.title ? block.title : `${peeked.page.title} · ${block.title}` });
  }, [gameId, peeked.page.id, peeked.page.title, block.id, block.title, entry.id, entry.name]);
  // The arrows step through the entries the player would see on that Page.
  const list = block.entries.filter((e) => e.id === entry.id || ((!block.byRoute || onRoute(e, route)) && (spoilers || !e.spoiler)));
  const panel = (
    <EntryPanel entry={entry} block={block} list={list} route={route} routes={routes} gameId={gameId} sharePath={peeked.sharePath}
      color={`var(--${peeked.page.tint})`}
      place={block.look === 'map' ? { clearKey: clearKey(block, entry), here: peeked.here ?? [] } : undefined}
      onGo={onGo} onClose={onClose} />
  );
  // An entry of this Page already has its links and classes from the Page around it.
  if (local) return panel;
  return <KinProvider kin={peeked.kin}><LinksProvider links={peeked.links}>{panel}</LinksProvider></KinProvider>;
}

/**
 * A link to an entry. Inside a game's Pages it opens the entry in a pop-up on top; with a
 * modifier key (new tab) or outside a Page (Workshop previews), it's a plain link.
 */
export function EntryLink({ href, className, title, children }: { href: string; className?: string; title?: string; children: React.ReactNode }) {
  const peek = useContext(PeekContext);
  return (
    <Link href={href} className={className} title={title} prefetch={peek ? false : undefined}
      onPointerEnter={() => peek?.prefetch(href)} onTouchStart={() => peek?.prefetch(href)}
      onClick={(e) => {
        if (!peek || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (peek.open(href)) e.preventDefault();
      }}>
      {children}
    </Link>
  );
}
