'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Search } from 'lucide-react';
import type { Page } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { usePlayerPrefs } from '@/components/usePlayerPrefs';
import { BlockView, type BlockContext } from './Blocks';
import { EntryIcon, type RouteOption } from './EntryPanel';
import { matches } from './entries';

export interface AppGame {
  id: string;
  shortTitle: string;
  routes: RouteOption[];
  /** "Which Flame Lord are you playing?" */
  routeQuestion?: string;
}

export type PageLink = Pick<Page, 'id' | 'title' | 'icon'>;

/** The strip of Pages across the top of the game app. Stays put while scrolling. */
export function PageStrip({ gameId, pages, current }: { gameId: string; pages: PageLink[]; current?: string }) {
  const active = useRef<HTMLAnchorElement>(null);
  useEffect(() => { active.current?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [current]);
  return (
    <nav aria-label="Pages" className="sticky top-0 z-30 -mx-4 bg-paper/85 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="chip-strip flex gap-2 overflow-x-auto pb-1">
        {pages.map((p) => {
          const on = p.id === current;
          return (
            <Link key={p.id} ref={on ? active : undefined} href={`/g/${gameId}/p/${p.id}`} aria-current={on ? 'page' : undefined}
              className={'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 transition ' +
                (on ? 'gloss bg-leaf text-paper ring-leaf' : 'bg-card ring-line hover:ring-leaf')}>
              <BlockIcon name={p.icon} size={15} /> {p.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PageView({ game, page }: { game: AppGame; page: Page }) {
  const [prefs, setPrefs] = usePlayerPrefs(game.id);
  const byRoute = game.routes.length > 0 && page.blocks.some((b) => b.byRoute);
  const hasSpoilers = page.blocks.some((b) => b.entries.some((e) => e.spoiler));
  const ctx: BlockContext = {
    gameId: game.id,
    route: byRoute ? prefs.route : 'all',
    routes: game.routes,
    spoilers: prefs.spoilers,
    onShowSpoilers: () => setPrefs({ spoilers: true }),
  };

  return (
    <div className="mt-4">
      <h1 className="font-display text-3xl">{page.title}</h1>
      <p className="mt-1 text-muted">{page.blurb}</p>

      {(byRoute || hasSpoilers) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {byRoute && (
            <div role="radiogroup" aria-label={game.routeQuestion ?? 'Route'} className="flex flex-wrap items-center gap-1 rounded-full bg-card p-1 ring-1 ring-line">
              <span className="hidden px-2 text-xs font-bold uppercase tracking-wide text-muted sm:inline">Flame Lord</span>
              {[{ key: 'all', label: 'All' } as const, ...game.routes].map((r) => (
                <button key={r.key} role="radio" aria-checked={prefs.route === r.key} onClick={() => setPrefs({ route: r.key })}
                  className={'rounded-full px-3 py-1.5 text-sm font-bold ' + (prefs.route === r.key ? 'gloss bg-berry text-paper' : 'hover:bg-card-2')}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
          {hasSpoilers && (
            <button onClick={() => setPrefs({ spoilers: !prefs.spoilers })} aria-pressed={prefs.spoilers}
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">
              {prefs.spoilers ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
              {prefs.spoilers ? 'Spoilers shown' : 'Spoilers hidden'}
            </button>
          )}
        </div>
      )}

      {page.blocks.length > 1 && (
        <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <span className="text-muted">On this page:</span>
          {page.blocks.map((b) => <a key={b.id} href={`#${b.id}`} className="font-bold text-leaf underline-offset-2 hover:underline">{b.title}</a>)}
        </p>
      )}

      <div className="mt-4 grid gap-4">
        {page.blocks.map((b) => <BlockView key={b.id} block={b} ctx={ctx} />)}
      </div>
    </div>
  );
}

/** Search across every Page from the app's front door. */
export function AppSearch({ gameId, pages }: { gameId: string; pages: Page[] }) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => pages.flatMap((p) => p.blocks.flatMap((b) => b.entries.map((e) => ({ p, b, e })))), [pages]);
  const hits = query.trim().length < 2 ? [] : all.filter(({ e }) => !e.spoiler && matches(e, query)).slice(0, 12);
  return (
    <div>
      <label className="surface flex items-center gap-3 rounded-full px-4 py-3 focus-within:ring-2 focus-within:ring-sky">
        <Search size={18} className="text-muted" aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search units, items, places…" aria-label="Search the app"
          className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted" />
      </label>
      {query.trim().length >= 2 && (
        <ul className="surface mt-2 grid gap-1 rounded-3xl p-2">
          {hits.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nothing found for “{query}”. Spoilers are left out here.</li>}
          {hits.map(({ p, b, e }) => (
            <li key={`${b.id}.${e.id}`}>
              <Link href={b.type === 'guide' || b.type === 'timeline' ? `/g/${gameId}/p/${p.id}#${b.id}` : `/g/${gameId}/p/${p.id}?e=${b.id}.${e.id}`}
                className="flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-card-2">
                <EntryIcon entry={e} block={b} />
                <span className="min-w-0">
                  <span className="block font-bold leading-tight">{e.name}</span>
                  <span className="block text-sm text-muted">{p.title} · {b.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
