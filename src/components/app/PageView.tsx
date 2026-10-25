'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, Eye, EyeOff, Hourglass, Info, Search } from 'lucide-react';
import type { Block, Entry, Page, Route } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { Piece } from '@/components/Piece';
import { Tip } from '@/components/Tip';
import { usePlayerPrefs } from '@/components/usePlayerPrefs';
import { BlockView, type BlockContext } from './Blocks';
import { TextLinksProvider, type TextLinkData } from './TextLinks';
import { HelpSolve, NewInVillage, Welcome } from './HomeHooks';
import { GLOSSARY, IN_GAME_DATES } from '@/data/glossary';
import type { Mention } from '@/data/pages/links';
import { EntryIcon, type RouteOption } from './EntryPanel';
import { colorFor, entryText, onRoute, useRecent, useTicks } from './entries';
import { closest, rank } from '@/lib/search';
import { TINT } from './tint';

export interface AppGame {
  id: string;
  shortTitle: string;
  title: string;
  routes: RouteOption[];
  /** "Which Flame Lord are you playing?" */
  routeQuestion?: string;
}

/** Pick your route: All, or one Flame Lord. Remembered on this device. */
function RoutePicker({ game, route, onPick, solid }: { game: AppGame; route: Route | 'all'; onPick: (r: Route | 'all') => void; solid: string }) {
  return (
    <div role="radiogroup" aria-label={game.routeQuestion ?? 'Route'} className="chip-strip flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-card p-1 text-ink ring-1 ring-line">
      <span className="hidden px-2 text-xs font-bold uppercase tracking-wide text-muted sm:inline">Flame Lord</span>
      {[{ key: 'all', label: 'All' } as const, ...game.routes].map((r) => (
        <button key={r.key} role="radio" aria-checked={route === r.key} onClick={() => onPick(r.key)}
          className={'shrink-0 rounded-full px-2.5 py-1.5 text-sm font-bold sm:px-3 ' + (route === r.key ? solid : 'hover:bg-card-2')}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function PageView({ game, page, openOnLoad, scrollTo, links = [], mentions }: {
  game: AppGame; page: Page; openOnLoad?: string; scrollTo?: string; links?: TextLinkData['names'];
  mentions?: Record<string, Mention[]>;
}) {
  const textLinks = useMemo(() => ({ names: links, terms: GLOSSARY[game.id] ?? {}, gameDates: IN_GAME_DATES.has(game.id) }), [links, game.id]);
  // Arriving from a share link: open that entry (or bring that Block into view), then show
  // the usual Page address so the panel's arrows, close and Back work as normal.
  useEffect(() => {
    if (!openOnLoad && !scrollTo) return;
    const base = `/g/${game.id}/${page.id}`;
    if (openOnLoad) window.history.replaceState({}, '', `${base}?e=${openOnLoad}`);
    else {
      window.history.replaceState({}, '', `${base}#${scrollTo}`);
      document.getElementById(scrollTo!)?.scrollIntoView({ block: 'start' });
    }
  }, [openOnLoad, scrollTo, game.id, page.id]);
  const [prefs, setPrefs] = usePlayerPrefs(game.id);
  const byRoute = game.routes.length > 0 && page.blocks.some((b) => b.byRoute);
  const hasSpoilers = page.blocks.some((b) => b.entries.some((e) => e.spoiler));
  const t = TINT[page.tint];
  const ctx: BlockContext = {
    gameId: game.id,
    page,
    pageTitle: page.title,
    tint: page.tint,
    route: byRoute ? prefs.route : 'all',
    routes: game.routes,
    spoilers: prefs.spoilers,
    onShowSpoilers: () => setPrefs({ spoilers: true }),
    mentions,
  };

  return (
    // A Page is a field of its color; its Blocks sit on it as white panels (brand rules in CLAUDE.md).
    <div className={`-mx-4 -mt-4 px-4 pb-6 pt-5 sm:mx-0 sm:mt-0 sm:rounded-3xl sm:p-6 ${t.soft}`}>
      {(openOnLoad || scrollTo) && <Welcome game={game} />}
      <header className="relative px-1 pb-1">
        <div className="relative flex items-center gap-4">
          <Piece size={84} color={`var(--${page.tint})`}><BlockIcon name={page.icon} size={24} strokeWidth={2.4} /></Piece>
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight">{page.title}</h1>
            <p className="text-muted">{page.blurb}</p>
          </div>
        </div>
        {(byRoute || hasSpoilers) && (
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            {byRoute && (
              <Tip text="Pick your Flame Lord to see only your route's units, deadlines and story" tint={page.tint} className="max-w-full">
                <RoutePicker game={game} route={prefs.route} onPick={(r) => setPrefs({ route: r })} solid="bg-signal text-ink" />
              </Tip>
            )}
            {hasSpoilers && (
              <Tip text={prefs.spoilers ? 'Spoilers are showing. Tap to hide them again' : 'Story secrets stay hidden until you choose to see them'} tint={page.tint}>
                <button onClick={() => setPrefs({ spoilers: !prefs.spoilers })} aria-pressed={prefs.spoilers}
                  className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">
                  {prefs.spoilers ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                  {prefs.spoilers ? 'Spoilers shown' : 'Spoilers hidden'}
                </button>
              </Tip>
            )}
          </div>
        )}
        {page.blocks.length > 1 && (
          <p className="relative mt-4 flex flex-wrap gap-2 text-sm">
            {page.blocks.map((b) => (
              <a key={b.id} href={`#${b.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1 font-bold ring-1 ring-line hover:ring-ink">
                <BlockIcon name={b.icon} size={14} /> {b.title} <span className="text-muted">{b.entries.filter((e) => onRoute(e, ctx.route) && (prefs.spoilers || !e.spoiler)).length}</span>
              </a>
            ))}
          </p>
        )}
      </header>

      <TextLinksProvider value={textLinks}>
        <div className="mt-4 grid gap-4">
          {page.blocks.map((b) => <BlockView key={b.id} block={b} ctx={ctx} />)}
        </div>
      </TextLinksProvider>
    </div>
  );
}

/** Search across every Page. */
function AppSearch({ gameId, pages }: { gameId: string; pages: Page[] }) {
  const [query, setQuery] = useState('');
  const [going, setGoing] = useState<string | null>(null);
  const all = useMemo(() => pages.flatMap((p) => p.blocks.flatMap((b) => b.entries.map((e) => ({ p, b, e })))), [pages]);
  const view = (h: { e: Entry }) => entryText(h.e);
  const searching = query.trim().length >= 2;
  const open = all.filter(({ e }) => !e.spoiler);
  const hits = searching ? rank(open, query, view).slice(0, 12) : [];
  const near = searching && !hits.length ? closest(open, query, view) : [];
  const spoilerHits = searching ? rank(all.filter(({ e }) => e.spoiler), query, view).length : 0;
  const example = open.find(({ b }) => b.type === 'collection')?.e.name;
  const href = ({ p, b, e }: { p: Page; b: Block; e: Entry }) =>
    b.type === 'guide' || b.type === 'timeline' ? `/g/${gameId}/${p.id}#${b.id}-${e.id}` : `/g/${gameId}/${p.id}?e=${b.id}.${e.id}`;
  const row = (h: { p: Page; b: Block; e: Entry }) => {
    const key = `${h.b.id}.${h.e.id}`;
    return (
      <li key={key}>
        {/* Lights up the moment it's tapped, so a slow phone still shows something happened. */}
        <Link href={href(h)} onClick={() => setGoing(key)}
          className={'flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-card-2 ' + (going === key ? 'animate-pulse bg-card-2 ring-1 ring-line' : '')}>
          <EntryIcon entry={h.e} block={h.b} size="sm" />
          <span className="min-w-0">
            <span className="block font-bold leading-tight">{h.e.name}</span>
            <span className="block text-sm text-muted">{h.p.title === h.b.title ? h.p.title : `${h.p.title} · ${h.b.title}`}</span>
          </span>
        </Link>
      </li>
    );
  };
  return (
    <div className="relative">
      <label className="flex items-center gap-3 rounded-full bg-card px-4 py-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
        <Search size={18} className="text-muted" aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search units, items, places…" aria-label="Search the app"
          className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted" />
      </label>
      {searching && (
        <ul className="surface pop absolute inset-x-0 z-20 mt-2 grid max-h-[60vh] gap-1 overflow-y-auto rounded-2xl p-2">
          {hits.length === 0 && (
            <li className="grid gap-1 px-3 py-2 text-sm text-muted">
              <span>Nothing found for “{query.trim()}”.{example && <> Try just a name, like <span className="font-bold text-ink">{example}</span>.</>}</span>
              {near.length > 0 && <span className="text-xs font-bold uppercase tracking-wide">Did you mean</span>}
            </li>
          )}
          {(hits.length ? hits : near).map(row)}
          {spoilerHits > 0 && (
            <li className="px-3 py-2 text-xs text-muted">
              {spoilerHits === 1 ? 'A spoiler also matches.' : `${spoilerHits} spoilers also match.`} Turn on spoilers on its Page to see {spoilerHits === 1 ? 'it' : 'them'}.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * The app's front page, built around a player mid-game: search, your Flame Lord, where
 * you left off, your next deadline, then every Page.
 */
export function AppHome({ game, pages }: { game: AppGame; pages: Page[] }) {
  const [prefs, setPrefs] = usePlayerPrefs(game.id);
  const recent = useRecent(game.id);
  const [ticks] = useTicks(game.id);

  // The first thing on a checklist you haven't ticked, on your route.
  const next = (() => {
    for (const p of pages) for (const b of p.blocks) {
      if (b.type !== 'checklist') continue;
      const e = b.entries.find((x) => onRoute(x, prefs.route) && !ticks.has(`${b.id}.${x.id}`) && (prefs.spoilers || !x.spoiler));
      if (e) {
        const when = prefs.route !== 'all' ? e.perRoute?.[prefs.route]?.[0]?.text : e.sections.find((s) => s.label === 'Before')?.text;
        return { p, b, e, when };
      }
    }
    return null;
  })();

  return (
    <div className="mt-3 grid gap-5 lg:mt-0">
      {/* An ink banner, no game art: a few Pages' pieces and one empty slot for what players add next. */}
      <section className="relative overflow-hidden rounded-2xl bg-ink text-white">
        <div aria-hidden="true" className="absolute right-6 top-1/2 hidden h-[190px] w-[260px] -translate-y-1/2 md:block">
          {pages.slice(0, 3).map((p, i) => (
            <span key={p.id} className="absolute" style={{ left: (i % 2) * 140, top: Math.floor(i / 2) * 104 }}>
              <Piece size={120} color={`var(--${p.tint})`} />
            </span>
          ))}
          <span className="absolute" style={{ left: 140, top: 104 }}><Piece size={120} outline ink="#fff" /></span>
        </div>
        <div className="relative px-5 py-7 sm:px-7 sm:py-9 md:pr-80">
          <h1 className="font-display text-3xl sm:text-4xl">{game.title}</h1>
          {game.routes.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-bold text-white/85">{game.routeQuestion}</p>
              <RoutePicker game={game} route={prefs.route} onPick={(r) => setPrefs({ route: r })} solid="bg-signal text-ink" />
            </div>
          )}
        </div>
      </section>

      <AppSearch gameId={game.id} pages={pages} />

      {/* Reasons to come back: open questions, and what other players found lately. */}
      <div className="grid gap-3 md:grid-cols-2">
        <HelpSolve gameId={game.id} pages={pages} />
        <NewInVillage gameId={game.id} />
      </div>

      {(recent.length > 0 || next) && (
        <div className="grid gap-3 md:grid-cols-2">
          {next && (
            <Link href={`/g/${game.id}/${next.p.id}`} className="lift flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
              <Piece size={56} color={`var(--${next.p.tint})`}><Hourglass size={17} strokeWidth={2.4} aria-hidden="true" /></Piece>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-bold uppercase tracking-wide ${TINT[next.p.tint].text}`}>Your next last chance</span>
                <span className="block font-bold leading-tight">{next.e.name}</span>
                <span className="block text-sm text-muted">{next.when ? `Before ${next.when.split('\n')[0]}` : 'Pick your Flame Lord to see the deadline.'}</span>
              </span>
              <ArrowRight size={18} className="mt-1 text-muted" aria-hidden="true" />
            </Link>
          )}
          {recent.length > 0 && (
            <div className="surface rounded-2xl p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Clock size={13} aria-hidden="true" /> Pick up where you left off</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {recent.slice(0, 6).map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} title={r.where} className="inline-flex items-center gap-1.5 rounded-full bg-card-2 py-1 pl-1.5 pr-3 text-sm font-bold ring-1 ring-line hover:ring-ink">
                      <Piece size={26} color={colorFor(r.name)} />{r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((p) => {
          const t = TINT[p.tint];
          // A Page card is a small version of the Page: its color field and its symbol in a piece.
          return (
            <li key={p.id}>
              <Link href={`/g/${game.id}/${p.id}`} className={`lift flex h-full flex-col rounded-2xl p-4 ${t.soft}`}
                style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--${p.tint}) 22%, var(--line))` }}>
                <Piece size={64} color={`var(--${p.tint})`}><BlockIcon name={p.icon} size={19} strokeWidth={2.4} /></Piece>
                <span className="mt-3 block font-display text-2xl leading-tight">{p.title}</span>
                <span className="mt-1 block text-sm text-muted">{p.blurb}</span>
                <span className="mt-auto pt-3 text-xs font-bold text-muted">{p.blocks.reduce((n, b) => n + b.entries.length, 0)} entries</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="flex gap-2 text-sm text-muted">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Started from a fan codex and improved by players. Spot something? <Link href={`/g/${game.id}/workshop`} className="font-bold text-ink underline">Fix it</Link>.</span>
      </p>
    </div>
  );
}
