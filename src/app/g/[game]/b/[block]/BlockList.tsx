'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { GameBlock } from '@/data/games';
import type { PlacedCard } from '@/data/content/types';
import { MiniCard } from '@/components/MiniCard';
import { PlayerBar, forRoute, matchesQuery, type ViewGame } from '@/components/GameAppView';
import { usePlayerPrefs } from '@/components/usePlayerPrefs';

export function BlockList({ game, block, cards }: { game: ViewGame; block: GameBlock; cards: PlacedCard[] }) {
  const [prefs, setPrefs] = usePlayerPrefs(game.id);
  const [q, setQ] = useState('');
  const routeLabels = useMemo(() => Object.fromEntries((game.paths?.options ?? []).map((o) => [o.key, o.label])), [game.paths]);
  const list = useMemo(
    () => cards.filter((c) => forRoute(c, prefs.route) && (!q.trim() || matchesQuery(c, q))),
    [cards, prefs.route, q],
  );

  return (
    <>
      <section className="surface mt-6 rounded-[2rem] p-5">
        <PlayerBar game={game} route={prefs.route} spoilers={prefs.spoilers} onRoute={(route) => setPrefs({ route })} onSpoilers={(spoilers) => setPrefs({ spoilers })} />
        <label className="mt-4 flex items-center gap-2 rounded-full bg-card-2 px-4 py-3 focus-within:ring-2 focus-within:ring-sky">
          <Search size={18} className="text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${block.label.toLowerCase()}`} aria-label={`Search ${block.label}`}
            className="w-full bg-transparent outline-none placeholder:text-muted" />
          {q && <button onClick={() => setQ('')} aria-label="Clear search" className="text-muted"><X size={16} aria-hidden="true" /></button>}
        </label>
      </section>
      <p className="mt-6 text-sm text-muted" aria-live="polite">{list.length} {list.length === 1 ? 'card' : 'cards'}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <MiniCard key={c.slug} card={c} block={block} gameId={game.id} showSpoilers={prefs.spoilers} showRoutes={prefs.route === 'all'} routeLabels={routeLabels} routeLabel={prefs.route === 'all' ? undefined : routeLabels[prefs.route]} />
        ))}
      </div>
    </>
  );
}
