'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, Eye, EyeOff, Hammer, Search, X } from 'lucide-react';
import type { GameBlock } from '@/data/games';
import type { PlacedCard, Route } from '@/data/content/types';
import { BlockIcon } from './Icon';
import { MiniCard } from './MiniCard';
import { usePlayerPrefs } from './usePlayerPrefs';

export interface ViewGame {
  id: string;
  shortTitle: string;
  paths?: { question: string; options: { key: Route; label: string; note: string }[] };
}

export function forRoute(card: PlacedCard, route: Route | 'all') {
  return route === 'all' || !card.routes?.length || card.routes.includes(route);
}

export function matchesQuery(card: PlacedCard, q: string) {
  const hay = (card.title + ' ' + Object.values(card.content).join(' ')).toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/** Route picker and spoiler switch, shared by the app home and block pages. */
export function PlayerBar({ game, route, spoilers, onRoute, onSpoilers }: {
  game: ViewGame; route: Route | 'all'; spoilers: boolean;
  onRoute: (r: Route | 'all') => void; onSpoilers: (on: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
      {game.paths && (
        <div className="w-full min-w-0 sm:flex-1">
          <p className="text-sm font-bold">{game.paths.question}</p>
          <div className="chip-strip -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={game.paths.question}>
            {[{ key: 'all' as const, label: 'All routes', note: 'Show everything' }, ...game.paths.options].map((o) => (
              <button key={o.key} onClick={() => onRoute(o.key)} aria-pressed={route === o.key}
                className={'shrink-0 rounded-2xl px-4 py-2 text-left ' + (route === o.key ? 'gloss btn-primary' : 'btn-quiet')}>
                <span className="block text-sm font-bold">{o.label}</span>
                <span className={'block text-xs ' + (route === o.key ? 'text-white/85' : 'text-muted')}>{o.note}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => onSpoilers(!spoilers)} aria-pressed={spoilers} className="btn-quiet inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
        {spoilers ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
        {spoilers ? 'Spoilers shown' : 'Spoilers hidden'}
      </button>
    </div>
  );
}

export function GameAppView({ game, blocks, cards }: { game: ViewGame; blocks: GameBlock[]; cards: PlacedCard[] }) {
  const [prefs, setPrefs] = usePlayerPrefs(game.id);
  const [q, setQ] = useState('');
  const routeLabels = useMemo(() => Object.fromEntries((game.paths?.options ?? []).map((o) => [o.key, o.label])), [game.paths]);
  const mine = useMemo(() => cards.filter((c) => forRoute(c, prefs.route)), [cards, prefs.route]);
  const found = useMemo(() => (q.trim() ? mine.filter((c) => matchesQuery(c, q) && (prefs.spoilers || !c.spoiler)) : []), [mine, q, prefs.spoilers]);
  const byKey = Object.fromEntries(blocks.map((b) => [b.key, b]));
  const showRoutes = prefs.route === 'all';
  const routeLabel = prefs.route === 'all' ? undefined : routeLabels[prefs.route];

  return (
    <>
      <section className="surface mt-6 rounded-[2rem] p-5 sm:p-6">
        <PlayerBar game={game} route={prefs.route} spoilers={prefs.spoilers} onRoute={(route) => setPrefs({ route })} onSpoilers={(spoilers) => setPrefs({ spoilers })} />
        <label className="mt-5 flex items-center gap-2 rounded-full bg-card-2 px-4 py-3 focus-within:ring-2 focus-within:ring-sky">
          <Search size={18} className="text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${game.shortTitle}: a unit, class, dungeon or item`}
            aria-label={`Search ${game.shortTitle}`} className="w-full bg-transparent outline-none placeholder:text-muted" />
          {q && <button onClick={() => setQ('')} aria-label="Clear search" className="text-muted"><X size={16} aria-hidden="true" /></button>}
        </label>
      </section>

      {q.trim() ? (
        <section className="mt-8" aria-live="polite">
          <h2 className="font-display text-2xl">{found.length ? `${found.length} found` : 'Nothing found'}</h2>
          {found.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {found.slice(0, 30).map((c) => (
                <MiniCard key={c.slug} card={c} block={byKey[c.block]} gameId={game.id} showSpoilers={prefs.spoilers} showRoutes={showRoutes} routeLabels={routeLabels} routeLabel={routeLabel} />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-muted">Try fewer words, or check the spoiler switch. If it&apos;s missing, add it in the Workshop.</p>
          )}
        </section>
      ) : (
        blocks.map((b) => {
          const list = mine.filter((c) => c.block === b.key);
          return (
            <section key={b.key} className="mt-9">
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="gloss grid size-10 place-items-center rounded-2xl bg-leaf text-white"><BlockIcon name={b.icon} size={18} /></span>
                  <div>
                    <h2 className="font-display text-2xl leading-tight">{b.label}</h2>
                    <p className="text-sm text-muted">{b.blurb}</p>
                  </div>
                </div>
                {list.length > 0 && (
                  <Link href={`/g/${game.id}/b/${b.key}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-leaf">
                    See all {list.length} <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </div>
              {list.length ? (
                <div className="swipe -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
                  {list.slice(0, 12).map((c) => (
                    <div key={c.slug} className="w-[78%] shrink-0 sm:w-[280px]">
                      <MiniCard card={c} block={b} gameId={game.id} showSpoilers={prefs.spoilers} showRoutes={showRoutes} routeLabels={routeLabels} routeLabel={routeLabel} />
                    </div>
                  ))}
                </div>
              ) : (
                <Link href={`/g/${game.id}/workshop?block=${b.key}`} className="btn-quiet mt-4 flex items-center gap-3 rounded-3xl p-4 text-sm">
                  <Hammer size={18} className="text-leaf" aria-hidden="true" />
                  Nothing here {prefs.route === 'all' ? 'yet' : 'for this route yet'}. Be the first to add one in the Workshop.
                </Link>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
