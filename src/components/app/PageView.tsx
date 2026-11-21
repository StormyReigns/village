'use client';

import type { Roster } from '@/lib/planner';
import { PartyHome } from '@/components/planner/PartyHome';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Clock, Eye, EyeOff, Hourglass, Info, Search, Signpost } from 'lucide-react';
import type { Block, Entry, Page, Route } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { GLITCH, Piece } from '@/components/Piece';
import { Tip } from '@/components/Tip';
import { usePlayerPrefs } from '@/components/usePlayerPrefs';
import { BlockView, type BlockContext } from './Blocks';
import { TextLinksProvider, type TextLinkData } from './TextLinks';
import { KinProvider } from '@/components/classes/kin';
import type { Kin } from '@/lib/class-fit';
import type { BlockLinks } from '@/lib/entry-links';
import { LinksProvider } from './EntryLinks';
import { PeekProvider } from './Peek';
import { byDeadline, deadlineText } from '@/lib/deadline';
import { HelpSolve, NewInVillage, Welcome } from './HomeHooks';
import { GLOSSARY, IN_GAME_DATES } from '@/data/glossary';
import type { Mention } from '@/data/pages/links';
import { EntryIcon, type RouteOption } from './EntryPanel';
import { colorFor, entryText, onRoute, useRecent, useTicks } from './entries';
import { closest, rank } from '@/lib/search';
import { entriesOf } from '@/lib/fields';
import { completeness } from '@/lib/completeness';
import { TINT } from './tint';
import { AllQuestions, AskFromSearch, QuestionBar, type QPage } from '@/components/questions/Questions';
import { CommunitiesCard } from '@/components/communities/Communities';

/**
 * A game counts as still being built (its front page says so, with what needs help) until it has this
 * many entries and this share of them filled in. Fortune's Weave, at 559 and 44% (2026-11-21), is built.
 */
const BUILT_COUNT = 100;
const BUILT_SHARE = 0.3;

export interface AppGame {
  id: string;
  shortTitle: string;
  title: string;
  routes: RouteOption[];
  /** "Which Flame Lord are you playing?" */
  routeQuestion?: string;
}

/**
 * What a game calls its routes, from its question: "Which Flame Lord are you playing?" is "Flame Lord".
 * Plain "Route" when the question doesn't say.
 */
export function routeNoun(question?: string) {
  return question?.match(/^Which (.{1,24}?) (?:are|is|do|did|will)\b/i)?.[1] ?? 'Route';
}

/**
 * Pick your route on a Page: one small chip that opens the phone's own picker. Yellow once a
 * route is picked (yellow is "your choice"). Remembered on this device.
 */
function RouteMenu({ game, route, onPick }: { game: AppGame; route: Route | 'all'; onPick: (r: Route | 'all') => void }) {
  const picked = route !== 'all' ? game.routes.find((r) => r.key === route) : undefined;
  return (
    <label className={'relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-bold ring-1 focus-within:ring-2 focus-within:ring-sky '
      + (picked ? 'bg-signal text-ink ring-signal' : 'bg-card ring-line hover:ring-ink')}>
      <Signpost size={14} aria-hidden="true" />
      <span className="hidden opacity-70 sm:inline">{routeNoun(game.routeQuestion)}</span>
      {picked?.label ?? 'All'}
      <ChevronDown size={14} aria-hidden="true" />
      <select value={route} onChange={(e) => onPick(e.target.value as Route | 'all')} aria-label={game.routeQuestion ?? 'Route'}
        className="absolute inset-0 cursor-pointer opacity-0">
        <option value="all">All</option>
        {game.routes.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
    </label>
  );
}

/** Pick your route: All, or one of the game's routes. Remembered on this device. */
function RoutePicker({ game, route, onPick, solid }: { game: AppGame; route: Route | 'all'; onPick: (r: Route | 'all') => void; solid: string }) {
  return (
    <div role="radiogroup" aria-label={game.routeQuestion ?? 'Route'} className="chip-strip flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-card p-1 text-ink ring-1 ring-line">
      <span className="hidden px-2 text-xs font-bold uppercase tracking-wide text-muted sm:inline">{routeNoun(game.routeQuestion)}</span>
      {[{ key: 'all', label: 'All' } as const, ...game.routes].map((r) => (
        <button key={r.key} role="radio" aria-checked={route === r.key} onClick={() => onPick(r.key)}
          className={'shrink-0 rounded-full px-2.5 py-1.5 text-sm font-bold sm:px-3 ' + (route === r.key ? solid : 'hover:bg-card-2')}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function PageView({ game, page, openOnLoad, scrollTo, links = [], mentions, pages = [], questionsPage, kin, blockLinks, rosters }: {
  game: AppGame; page: Page; openOnLoad?: string; scrollTo?: string; links?: TextLinkData['names'];
  mentions?: Record<string, Mention[]>;
  /** Units and classes: what this Page's cards know about the kin Block (src/lib/class-fit.ts). */
  kin?: Kin[];
  /** Links across Blocks: what this Page's links point at, and other sides from elsewhere (src/lib/entry-links.ts). */
  blockLinks?: BlockLinks;
  /** Every Page, for the Ask sheet's "Which Page is it about?" (src/components/questions). */
  pages?: QPage[];
  /** The Page that lists every open question (questionsPage in src/lib/questions.ts). */
  questionsPage?: string;
  /** Planner Blocks: the roster each picks from (plannerRosters in src/lib/planner.ts). */
  rosters?: Record<string, Roster>;
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
  const [prefs, setPrefs, ready] = usePlayerPrefs(game.id);
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
    rosters,
    onPickRoute: byRoute ? (r) => setPrefs({ route: r }) : undefined,
    pages: pages.length ? pages : undefined,
  };

  return (
    // A Page is a field of its color; its Blocks sit on it as white panels (brand rules in CLAUDE.md).
    <div className={`-mx-4 -mt-4 px-4 pb-6 pt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl sm:p-5 ${t.soft}`}>
      {(openOnLoad || scrollTo) && <Welcome game={game} />}
      {/* Kept small so a player reaches the entries fast: the title row (with the questions bar
          beside it on wider screens), then one row of Block tabs, route and spoilers. */}
      <header className="relative px-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:flex-nowrap">
          <div className="flex min-w-0 items-center gap-2.5">
            <Piece size={44} color={`var(--${page.tint})`}><BlockIcon name={page.icon} size={15} strokeWidth={2.4} /></Piece>
            <h1 className="truncate font-display text-2xl leading-tight">{page.title}</h1>
            <p className="sr-only">{page.blurb}</p>
          </div>
          {/* What players have asked about this Page, one at a time, and Ask (docs/blocks/questions.md). */}
          <div className="w-full min-w-0 sm:flex-1">
            <QuestionBar gameId={game.id} page={page} pages={pages.length ? pages : [{ id: page.id, title: page.title, short: page.short, tint: page.tint }]} links={links} />
          </div>
        </div>
        {(page.blocks.length > 1 || byRoute || hasSpoilers) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {page.blocks.length > 1 && page.blocks.map((b) => (
              <a key={b.id} href={`#${b.id}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-card/80 px-2.5 text-sm font-bold ring-1 ring-line hover:ring-ink">
                {/* Icons only on wider screens, so a phone fits tabs, route and spoilers on one row. */}
                <span className="hidden sm:inline-flex"><BlockIcon name={b.icon} size={14} /></span>{b.title} {(ready || !b.byRoute) && <span className="text-muted">{entriesOf(b).filter((e) => onRoute(e, ctx.route) && (prefs.spoilers || !e.spoiler)).length}</span>}
              </a>
            ))}
            <span className="ml-auto flex items-center gap-1.5">
              {byRoute && (
                <Tip text={`Pick your ${routeNoun(game.routeQuestion).replace(/^Route$/, 'route')} to see only what fits your playthrough`} tint={page.tint}>
                  {/* Until this device's route is read, a quiet placeholder rather than a flash of "All". */}
                  {ready ? <RouteMenu game={game} route={prefs.route} onPick={(r) => setPrefs({ route: r })} />
                    : <span className="inline-block h-8 w-24 animate-pulse rounded-full bg-card ring-1 ring-line" aria-hidden="true" />}
                </Tip>
              )}
              {hasSpoilers && (
                <Tip text={prefs.spoilers ? 'Spoilers are showing. Tap to hide them again' : 'Spoilers are hidden. Tap to show story secrets'} tint={page.tint}>
                  <button onClick={() => setPrefs({ spoilers: !prefs.spoilers })} aria-pressed={prefs.spoilers}
                    aria-label={prefs.spoilers ? 'Spoilers shown' : 'Spoilers hidden'}
                    className={'grid size-8 shrink-0 place-items-center rounded-full ring-1 ' + (prefs.spoilers ? 'bg-signal text-ink ring-signal' : 'bg-card text-muted ring-line hover:text-ink hover:ring-ink')}>
                    {prefs.spoilers ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                  </button>
                </Tip>
              )}
            </span>
          </div>
        )}
      </header>

      <TextLinksProvider value={textLinks}><KinProvider kin={kin}><LinksProvider links={blockLinks}>
      <PeekProvider gameId={game.id} page={page} route={ctx.route} routes={game.routes} spoilers={prefs.spoilers}>
        <div className="mt-3 grid gap-3 sm:gap-4">
          {/* A Block that differs by route waits for the saved route, so it never shows All's view first. */}
          {page.blocks.map((b) => byRoute && b.byRoute && !ready
            ? <div key={b.id} role="status" aria-label="Loading" className="h-72 animate-pulse rounded-2xl bg-card ring-1 ring-line" />
            : <BlockView key={b.id} block={b} ctx={ctx} />)}
          {questionsPage === page.id && <AllQuestions gameId={game.id} pages={pages} allPages={[page]} />}
        </div>
      </PeekProvider>
      </LinksProvider></KinProvider></TextLinksProvider>
    </div>
  );
}

/** Search across every Page. */
function AppSearch({ gameId, pages }: { gameId: string; pages: Page[] }) {
  const qpages = useMemo(() => pages.map((p) => ({ id: p.id, title: p.title, short: p.short, tint: p.tint })), [pages]);
  const [query, setQuery] = useState('');
  const [going, setGoing] = useState<string | null>(null);
  const all = useMemo(() => pages.flatMap((p) => p.blocks.flatMap((b) => b.entries.map((e) => ({ p, b, e })))), [pages]);
  const view = (h: { e: Entry }) => entryText(h.e);
  // This game's own Pages as the hint ("Search units, items, world…"), never another game's words.
  const shorts = pages.filter((p) => p.blocks.some((b) => b.entries.length)).map((p) => (p.short || p.title).toLowerCase());
  const placeholder = shorts.length ? `Search ${shorts.slice(0, 3).join(', ')}…` : 'Search the app…';
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
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label="Search the app"
          className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted" />
      </label>
      {searching && (
        <ul className="surface pop absolute inset-x-0 z-20 mt-2 grid max-h-[60vh] gap-1 overflow-y-auto rounded-2xl p-2">
          {hits.length === 0 && (
            <li className="grid gap-1 px-3 py-2 text-sm text-muted">
              <span>Nothing found for “{query.trim()}”.{example && <> Try just a name, like <span className="font-bold text-ink">{example}</span>.</>}</span>
              {/* Not in the app: ask the people who know, with what they typed already filled in. */}
              <AskFromSearch gameId={gameId} pages={qpages} query={query} links={open.map((h) => ({ name: h.e.name, href: href(h) }))} />
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
  const [prefs, setPrefs, ready] = usePlayerPrefs(game.id);
  const recent = useRecent(game.id);
  const [ticks] = useTicks(game.id);

  // The first thing on a checklist you haven't ticked, on your route.
  const next = (() => {
    for (const p of pages) for (const b of p.blocks) {
      if (b.type !== 'checklist') continue;
      const e = byDeadline(b.entries, prefs.route).find((x) => onRoute(x, prefs.route) && !ticks.has(`${b.id}.${x.id}`) && (prefs.spoilers || !x.spoiler));
      if (e) {
        const when = prefs.route !== 'all' ? deadlineText(e, prefs.route) : e.sections.find((s) => s.label === 'Before')?.text;
        return { p, b, e, when };
      }
    }
    return null;
  })();

  // How filled in each Page is: the Workshop's "78 of 148 filled in" (src/lib/completeness.ts).
  const progress = useMemo(() => new Map(pages.map((p) => {
    let done = 0, total = 0;
    for (const b of p.blocks) { const c = completeness(b); done += c.done; total += c.total; }
    return [p.id, { done, total }] as const;
  })), [pages]);
  const filled = [...progress.values()].reduce((a, c) => ({ done: a.done + c.done, total: a.total + c.total }), { done: 0, total: 0 });
  // A game still being built shows it on its front page, so early Builders see where to help.
  const building = filled.total < BUILT_COUNT || filled.done / filled.total < BUILT_SHARE;

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
              {ready ? <RoutePicker game={game} route={prefs.route} onPick={(r) => setPrefs({ route: r })} solid="bg-signal text-ink" />
                : <span className="block h-11 max-w-md animate-pulse rounded-full bg-white/15" aria-hidden="true" />}
            </div>
          )}
        </div>
      </section>

      <AppSearch gameId={game.id} pages={pages} />

      {/* Reasons to come back: open questions, your next deadline, what other players found
          lately and where you left off. Two to a row; a card left on its own fills the row. */}
      <div className="grid gap-3 md:grid-cols-2 md:[&>*:last-child:nth-child(odd)]:col-span-2">
        {/* Your party for this run and what to do next for them (docs/blocks/planner.md). */}
        {/* Still being built: how much is filled in, and the way to the Workshop. A split outline is "not built yet". */}
        {building && (
          <Link href={`/g/${game.id}/workshop?tab=app`} className="lift flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
            <Piece size={56} outline />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: GLITCH.violet }}>Still being built</span>
              <span className="block font-bold leading-tight">{filled.total ? `${filled.done} of ${filled.total} filled in` : 'Nothing added yet'}</span>
              <span className="block text-sm text-muted">Players are building {game.shortTitle}. Help in the Workshop; each Page below says what needs it.</span>
            </span>
            <ArrowRight size={18} className="mt-1 text-muted" aria-hidden="true" />
          </Link>
        )}
        {ready && <PartyHome gameId={game.id} pages={pages} route={prefs.route} />}
        <HelpSolve gameId={game.id} pages={pages} />
          {ready && next && (
            <Link href={`/g/${game.id}/${next.p.id}`} className="lift flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
              <Piece size={56} color={`var(--${next.p.tint})`}><Hourglass size={17} strokeWidth={2.4} aria-hidden="true" /></Piece>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-bold uppercase tracking-wide ${TINT[next.p.tint].text}`}>Your next last chance</span>
                <span className="block font-bold leading-tight">{next.e.name}</span>
                {(next.when || game.routes.length > 0) && (
                  <span className="block text-sm text-muted">{next.when ? `Before ${next.when.split('\n')[0]}` : `Pick your ${routeNoun(game.routeQuestion).replace(/^Route$/, 'route')} to see the deadline.`}</span>
                )}
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
        <NewInVillage gameId={game.id} />
      </div>

      {/* Where players hang out: Discord servers and other communities (docs/blocks/discord.md). */}
      <CommunitiesCard gameId={game.id} gameName={game.shortTitle} />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((p) => {
          const t = TINT[p.tint];
          const pr = progress.get(p.id) ?? { done: 0, total: 0 };
          const needy = pr.total - pr.done;
          // A Party (Planner) or Tier list Page holds players' own plans and rankings, not entries to add.
          const holdsEntries = p.blocks.some((b) => b.type !== 'planner' && b.type !== 'tierlist');
          const help = `/g/${game.id}/workshop?page=${p.id}&tab=app`;
          // A Page card is a small version of the Page: its color field and its symbol in a piece. The
          // whole card opens the Page; while the game is being built, "needs help" opens it in the Workshop.
          return (
            <li key={p.id} className={`lift relative flex h-full flex-col rounded-2xl p-4 ${t.soft}`}
              style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--${p.tint}) 22%, var(--line))` }}>
              <Piece size={64} color={`var(--${p.tint})`}><BlockIcon name={p.icon} size={19} strokeWidth={2.4} /></Piece>
              <Link href={`/g/${game.id}/${p.id}`} className="mt-3 block font-display text-2xl leading-tight after:absolute after:inset-0 after:rounded-2xl">{p.title}</Link>
              <span className="mt-1 block text-sm text-muted">{p.blurb}</span>
              {!building ? (
                <span className="mt-auto pt-3 text-xs font-bold text-muted">{p.blocks.reduce((n, b) => n + entriesOf(b).length, 0)} entries</span>
              ) : (
                <span className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-3 text-xs">
                  {pr.total > 0 && (
                    <>
                      <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-card ring-1 ring-line">
                        <span className="block h-full rounded-full" style={{ width: `${Math.round((pr.done / pr.total) * 100)}%`, background: `var(--${p.tint})` }} />
                      </span>
                      <span className="font-bold">{pr.done} of {pr.total} filled in</span>
                    </>
                  )}
                  {(needy > 0 || (pr.total === 0 && holdsEntries)) && (
                    <Link href={help} className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-0.5 font-bold ring-1"
                      style={{ color: GLITCH.violet, ['--tw-ring-color' as string]: `color-mix(in srgb, ${GLITCH.violet} 45%, transparent)` }}>
                      <Piece size={14} outline />
                      {pr.total === 0 ? 'Nothing yet: add the first' : `${needy} need${needy === 1 ? 's' : ''} help`}
                    </Link>
                  )}
                </span>
              )}
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
