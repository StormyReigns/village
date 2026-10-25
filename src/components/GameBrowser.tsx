'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Hammer, Search, X } from 'lucide-react';
import type { Game } from '@/data/games';
import { GameCover } from './GameCover';
import { Countdown } from './Countdown';
import { GameActivity } from './GameActivity';
import { Tip } from './Tip';
import { initials } from './app/entries';
import { rank } from '@/lib/search';

type Order = 'az' | 'genre';

/** Something inside a game's app that the home search can find ("goliath" → Fortune's Weave › Goliath). */
export interface EntryHit { key: string; game: string; name: string; where: string; href: string; text: string }

const gameText = (g: Game) => ({ name: `${g.title} ${g.shortTitle}`, text: `${g.genre} ${g.platform}` });

export function GameBrowser({ games, entries = [] }: { games: Game[]; entries?: EntryHit[] }) {
  const [q, setQ] = useState('');
  const [going, setGoing] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>('az');
  const popular = useMemo(() => [...games].sort((a, b) => a.popularity - b.popularity), [games]);
  const found = useMemo(() => (q.trim() ? rank(games, q, gameText) : []), [games, q]);
  const inside = useMemo(() => (q.trim().length >= 2 ? rank(entries, q, (h) => h).slice(0, 8) : []), [entries, q]);
  const groups = useMemo(() => {
    const sorted = [...games].sort((a, b) => a.shortTitle.localeCompare(b.shortTitle));
    const key = (g: Game) => (order === 'az' ? g.shortTitle[0].toUpperCase() : g.genre);
    const map = new Map<string, Game[]>();
    for (const g of sorted) map.set(key(g), [...(map.get(key(g)) ?? []), g]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [games, order]);

  return (
    <>
      <label className="surface mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-full px-4 py-3 focus-within:ring-2 focus-within:ring-sky">
        <Search size={18} className="text-muted" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-transparent outline-none placeholder:text-muted"
          placeholder="Search games by name or genre"
          aria-label="Search games"
        />
        {q && (
          <button onClick={() => setQ('')} className="grid size-7 place-items-center rounded-full text-muted hover:bg-card-2" aria-label="Clear search">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </label>

      {/* Results sit above the usual page, which stays put underneath. */}
      {q.trim() && (
        <section className="mt-8" aria-live="polite">
          <h2 className="font-display text-2xl">Results</h2>
          {found.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {found.map((g) => <GameTile key={g.id} game={g} />)}
            </div>
          )}
          {inside.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Inside the games</h3>
              <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {inside.map((h) => (
                  <li key={h.key}>
                    {/* Lights up the moment it's tapped, so a slow phone still shows something happened. */}
                    <Link href={h.href} onClick={() => setGoing(h.key)}
                      className={'surface lift flex items-center gap-3 rounded-2xl p-3 ' + (going === h.key ? 'animate-pulse bg-card-2' : '')}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card-2 font-display text-sm text-ink ring-1 ring-line">{initials(h.name)}</span>
                      <span className="min-w-0">
                        <span className="block font-bold leading-tight">{h.name}</span>
                        <span className="block truncate text-sm text-muted">{h.game} › {h.where}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!found.length && !inside.length && (
            <p className="surface mt-4 rounded-2xl p-6 text-center text-muted">
              Nothing matches “{q.trim()}”. Try a game&apos;s name, or something from inside a game, like <span className="font-bold text-ink">Goliath</span>.
            </p>
          )}
        </section>
      )}
      {(
        <>
          <section className="mt-8">
            <h2 className="font-display text-2xl">Popular right now</h2>
            <div className="swipe -mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
              {popular.map((g) => (
                <div key={g.id} className="w-[85%] shrink-0 sm:w-[340px]">
                  <GameTile game={g} />
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl">All games</h2>
              <div role="group" aria-label="Sort games" className="surface flex rounded-full p-1 text-sm font-bold">
                {(['az', 'genre'] as Order[]).map((o) => (
                  <button key={o} onClick={() => setOrder(o)} aria-pressed={order === o}
                    className={'rounded-full px-3 py-1.5 ' + (order === o ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
                    {o === "az" ? "A–Z" : "Genre"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-5">
              {groups.map(([label, list]) => (
                <div key={label}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{label}</h3>
                  <ul className="mt-2 grid gap-2">
                    {list.map((g) => (
                      <li key={g.id}>
                        <Link href={`/g/${g.id}`} className="surface lift flex items-center gap-4 rounded-2xl p-3">
                          <GameCover game={g} compact className="w-28 shrink-0 !rounded-xl" />
                          <span className="min-w-0">
                            <span className="block font-display text-lg leading-tight">{g.title}</span>
                            <span className="block text-sm text-muted">{g.genre} · {g.platform}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

const PILL: Record<Game['hue'], string> = {
  berry: 'bg-berry-soft text-berry',
  sky: 'bg-sky-soft text-sky',
  leaf: 'bg-leaf-soft text-leaf',
  sun: 'bg-sun-soft text-sun',
};

function GameTile({ game }: { game: Game }) {
  return (
    <article className="surface lift flex h-full flex-col rounded-2xl p-3">
      <Link href={`/g/${game.id}`} aria-label={`Open ${game.shortTitle}`}><GameCover game={game} /></Link>
      <div className="flex flex-1 flex-col px-2 pb-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-xl leading-tight">{game.shortTitle}</h3>
            <p className="text-sm text-muted">{game.genre} · {game.platform}</p>
          </div>
          <span className={'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ' + PILL[game.hue]}>
            {game.status === 'prelaunch' ? <Countdown date={game.releaseDate} before="Out" after="Out now" /> : 'Live'}
          </span>
        </div>
        {game.next && <p className="mt-2 text-sm">{game.next}</p>}
        <GameActivity gameId={game.id} />
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Link href={`/g/${game.id}`} className="gloss btn-primary rounded-full px-4 py-2 text-sm font-bold">Open the app</Link>
          <Tip text="The Workshop is where villagers build and fix this app together. No skills needed, just know the game" tint="leaf">
            <Link href={`/g/${game.id}/workshop`} className="btn-quiet inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold">
              <Hammer size={15} className="text-leaf" aria-hidden="true" /> Help build it
            </Link>
          </Tip>
        </div>
      </div>
    </article>
  );
}
