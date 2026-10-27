'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Hammer, Hourglass, Pencil, TriangleAlert, X } from 'lucide-react';
import type { Block, Entry, EntryContent, Route } from '@/data/pages';
import { BlockIcon, hasIcon } from '@/components/Icon';
import { ShareButton } from '@/components/ShareButton';
import { RichText } from './TextLinks';
import { Tip } from '@/components/Tip';
import { colorFor, initials, tintFor, useTicks } from './entries';
import { Piece } from '@/components/Piece';
import { browserClient } from '@/lib/supabase/browser';
import type { Mention } from '@/data/pages/links';
import { heatFill, placeText, statFacts } from '@/lib/stats';

interface OpenFix { id: string; theory: boolean; text: string; who: string }
type Profile = { display_name?: string; username?: string } | null;
const nameOf = (p: unknown) => { const a = (Array.isArray(p) ? p[0] : p) as Profile; return a?.display_name || a?.username || 'a villager'; };

/** Open Drafts that change this entry (so nobody writes the same fix twice, and theories show). */
function useOpenFixes(cardId?: string) {
  const [fixes, setFixes] = useState<OpenFix[]>([]);
  useEffect(() => {
    const db = browserClient();
    if (!db || !cardId) return;
    let live = true;
    db.from('drafts').select('id, theory, content, author:profiles!drafts_author_id_fkey(display_name, username)')
      .eq('card_id', cardId).in('status', ['open', 'checking']).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => {
        if (!live) return;
        setFixes((data ?? []).map((d) => ({
          id: d.id, theory: Boolean(d.theory), who: nameOf(d.author),
          text: ((d.content as { description?: string })?.description ?? '').split('\n')[0],
        })));
      });
    return () => { live = false; };
  }, [cardId]);
  return cardId ? fixes : [];
}

/** Who wrote the change that's in the app now, if it came from a Draft. */
function useImprovedBy(revision?: number) {
  const [who, setWho] = useState<string | null>(null);
  useEffect(() => {
    const db = browserClient();
    if (!db || !revision) return;
    let live = true;
    db.from('card_revisions').select('draft_id').eq('id', revision).maybeSingle().then(({ data }) => {
      const draft = data?.draft_id as string | undefined;
      if (!draft || !live) return;
      db.from('drafts').select('author:profiles!drafts_author_id_fkey(display_name, username)').eq('id', draft).maybeSingle()
        .then(({ data: d }) => { if (live && d) setWho(nameOf(d.author)); });
    });
    return () => { live = false; };
  }, [revision]);
  return revision ? who : null;
}

/** Parts most entries in this Block have, which this one is missing: invitations to add them. */
function missingParts(entry: Entry, block: Block) {
  const n = block.entries.length;
  const counts = new Map<string, number>();
  for (const e of block.entries) for (const s of e.sections) counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
  const common = [...counts].filter(([, c]) => c >= Math.max(2, n * 0.4)).map(([l]) => l);
  return common.filter((l) => !entry.sections.some((s) => s.label === l));
}

/** A small pencil beside one part of an entry: fix just that part. */
function FixPencil({ href, what }: { href: string; what: string }) {
  return (
    <Link href={href} aria-label={`Fix ${what}`} className="grid size-7 shrink-0 place-items-center rounded-full text-muted/70 hover:bg-card-2 hover:text-leaf">
      <Pencil size={13} aria-hidden="true" />
    </Link>
  );
}

export interface RouteOption { key: Route; label: string }

/** Text with several lines reads as a list; one line reads as a sentence. */
/** Entry text: one paragraph, or a bullet list when it has several lines. Names and game
 *  words inside it link up (see TextLinks). `skip` is the entry's own name. */
export function Lines({ text, skip }: { text: string; skip?: string }) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return <p><RichText text={text} skip={skip} /></p>;
  return <ul className="grid gap-1">{lines.map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted/60" /><span><RichText text={l} skip={skip} /></span></li>)}</ul>;
}

/**
 * An entry as a piece: its picture, or its initials below the slice. In a Page it takes
 * the Page's `color`; elsewhere (Workshop, search) a steady color from its type.
 */
/** The symbol for an entry's group (its first filter value), when its Block sets one. */
export function symbolFor(entry: EntryContent, block: Partial<Pick<Block, 'symbols' | 'filters'>>) {
  const value = block.filters?.[0] ? entry.categories[block.filters[0]] : undefined;
  const name = value ? block.symbols?.[value] : undefined;
  return hasIcon(name) ? name : undefined;
}

export function EntryIcon({ entry, block, size = 'md', color }: {
  entry: EntryContent; block: Pick<Block, 'title' | 'icon'> & Partial<Pick<Block, 'symbols' | 'filters'>>; size?: 'sm' | 'md' | 'lg'; color?: string;
}) {
  const px = size === 'lg' ? 136 : size === 'sm' ? 46 : 64;
  const symbol = symbolFor(entry, block);
  return (
    <Piece size={px} color={color ?? colorFor(Object.values(entry.categories)[0] ?? block.title)} image={entry.icon}>
      {entry.icon ? null : symbol ? <BlockIcon name={symbol} size={Math.round(px * 0.2)} strokeWidth={2.4} />
        : initials(entry.name) || <BlockIcon name={block.icon} size={Math.round(px * 0.2)} />}
    </Piece>
  );
}

/**
 * An entry's details: a side panel on wide screens, a sheet from the bottom on phones.
 * Arrows (or ← →) step through the entries the player is looking at.
 */
export function EntryPanel({ entry, block, list, route, routes, gameId, sharePath, place, color, onGo, onClose }: {
  entry: Entry; block: Block; list: Entry[]; route: Route | 'all'; routes: RouteOption[]; gameId: string; sharePath: string;
  /** The Page's color, for the entry's piece. */
  color?: string;
  /** A place on a map Block: its "cleared" mark, and what else in the app mentions it. */
  place?: { clearKey: string; here: Mention[] };
  onGo: (e: Entry) => void; onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const at = list.findIndex((e) => e.id === entry.id);
  const prev = at > 0 ? list[at - 1] : undefined;
  const next = at >= 0 && at < list.length - 1 ? list[at + 1] : undefined;
  const fixes = useOpenFixes(entry.ref?.card);
  const improvedBy = useImprovedBy(entry.ref?.revision);
  const [ticks, toggleTick] = useTicks(gameId);
  const people = (block.look ?? 'slots') === 'portraits';
  const recruitKey = `recruited:${block.id}.${entry.id}`;
  // A Mystery: an open question players can answer or theorize about.
  const status = entry.categories.Status;
  const mystery = Boolean(status && block.filters?.includes('Status'));
  const solved = mystery && !['Open', 'Theory'].includes(status!);
  const fixHref = (field: string) => `/g/${gameId}/workshop?fix=${block.id}.${entry.id}&field=${encodeURIComponent(field)}`;

  useEffect(() => {
    box.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && prev) onGo(prev);
      if (e.key === 'ArrowRight' && next) onGo(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, onGo, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30 backdrop-blur-[2px] lg:items-stretch lg:justify-end" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={entry.name} onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[88vh] w-full flex-col rounded-t-[2rem] bg-card shadow-soft outline-none lg:max-h-none lg:w-[28rem] lg:rounded-none lg:rounded-l-[2rem]">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line lg:hidden" aria-hidden="true" />
        <div className="flex items-center gap-1 px-4 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{block.title}{at >= 0 && ` · ${at + 1} of ${list.length}`}</p>
          <span className="ml-auto" />
          <ShareButton path={sharePath} title={entry.name} what="entry" className="mr-1" />
          <button onClick={() => prev && onGo(prev)} disabled={!prev} aria-label="Previous" className="grid size-9 place-items-center rounded-full hover:bg-card-2 disabled:opacity-30"><ChevronLeft size={18} aria-hidden="true" /></button>
          <button onClick={() => next && onGo(next)} disabled={!next} aria-label="Next" className="grid size-9 place-items-center rounded-full hover:bg-card-2 disabled:opacity-30"><ChevronRight size={18} aria-hidden="true" /></button>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-card-2 ring-1 ring-line"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 pt-3">
          {fixes.length > 0 && !mystery && (
            <Link href={`/g/${gameId}/workshop?draft=${fixes[0].id}`} className="mb-4 flex items-center gap-2 rounded-2xl bg-sun-soft px-3 py-2 text-sm hover:ring-1 hover:ring-sun">
              <Hourglass size={15} className="shrink-0 text-sun" aria-hidden="true" />
              <span className="flex-1"><span className="font-bold">A fix is waiting for votes.</span> See it before writing another</span>
            </Link>
          )}
          <EntryDetails entry={entry} block={block} route={route} routes={routes} fixHref={fixHref} color={color}
            invite={{ description: !entry.description && block.type === 'collection', sections: missingParts(entry, block) }} />

          {place && (
            <>
              <button type="button" onClick={() => toggleTick(place.clearKey)} aria-pressed={ticks.has(place.clearKey)}
                className={'mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ' + (ticks.has(place.clearKey) ? 'bg-leaf text-white ring-leaf' : 'ring-line hover:ring-leaf')}>
                <Check size={15} aria-hidden="true" /> {ticks.has(place.clearKey) ? 'Cleared' : 'Mark as cleared'}
              </button>
              {place.here.length > 0 && (
                <section className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted">What&apos;s here</h3>
                  <ul className="mt-1.5 grid gap-1">
                    {place.here.map((m) => (
                      <li key={m.href}>
                        <Link href={m.href} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-card-2">
                          <span className="font-bold">{m.name}</span><span className="truncate text-xs text-muted">{m.where}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {people && (
            <button type="button" onClick={() => toggleTick(recruitKey)} aria-pressed={ticks.has(recruitKey)}
              className={'mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ' + (ticks.has(recruitKey) ? 'bg-leaf text-white ring-leaf' : 'ring-line hover:ring-leaf')}>
              <Check size={15} aria-hidden="true" /> {ticks.has(recruitKey) ? 'Recruited' : 'Mark as recruited'}
            </button>
          )}

          {mystery && (
            <div className="mt-5 grid gap-3 rounded-2xl bg-plum-soft p-3">
              {solved && improvedBy && <p className="text-sm font-bold text-plum">Solved by {improvedBy}</p>}
              {!solved && (
                <div className="flex flex-wrap gap-2">
                  <Link href={fixHref('description')} className="rounded-full bg-plum px-4 py-2 text-sm font-bold text-white">I know the answer</Link>
                  <Link href={`${fixHref('description')}&theory=1`} className="rounded-full bg-card px-4 py-2 text-sm font-bold text-plum ring-1 ring-plum/40">Share a theory</Link>
                </div>
              )}
              {fixes.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-plum">{fixes.some((f) => !f.theory) ? 'Answers and theories so far' : 'Theories so far'}</p>
                  <ul className="mt-1.5 grid gap-1.5">
                    {fixes.map((f) => (
                      <li key={f.id}>
                        <Link href={`/g/${gameId}/workshop?draft=${f.id}`} className="block rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-line hover:ring-plum">
                          <span className="block">{f.text || 'See the Draft'}</span>
                          <span className="text-xs text-muted">{f.theory ? 'Theory' : 'Answer'} by {f.who} · tap to vote</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {entry.source && <p className="mt-6 text-xs text-muted">Source: {entry.source}</p>}
          {improvedBy && !solved && <p className="mt-1 text-xs text-muted">Last improved by {improvedBy}</p>}
          <Tip text="Opens a Draft with this entry filled in. Change what's wrong; villagers check it" tint="leaf" className="mt-4">
            <Link href={`/g/${gameId}/workshop?fix=${block.id}.${entry.id}`} className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
              <Hammer size={15} aria-hidden="true" /> Suggest a fix
            </Link>
          </Tip>
        </div>
      </div>
    </div>
  );
}

/** What an entry says: used in the app's panel and in Workshop previews. */
/** The entry's numbers, each colored and placed against the rest of its Block. */
function StatTiles({ entry, block, fix, color = 'var(--ink)' }: { entry: EntryContent; block: Partial<Pick<Block, 'stats' | 'entries'>>; fix?: string; color?: string }) {
  // A Draft's numbers are compared against everyone else as they are now.
  const me = { ...entry, id: '' } as Entry;
  const among = [...(block.entries ?? []).filter((e) => e.name !== entry.name), me];
  return (
    <section className="mt-4">
      <div className="flex items-center">
        <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">Stats</h3>
        {fix && <FixPencil href={fix} what="the stats" />}
      </div>
      <dl className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {block.stats!.map((d) => {
          const f = statFacts(d, me, among);
          return (
            <div key={d.key} className={'rounded-xl px-3 py-2 ' + (f ? '' : 'bg-card-2')} style={f ? { background: heatFill(f.goodness, color) } : undefined}>
              <dt className="text-xs font-bold">{d.label}</dt>
              <dd className="font-display text-2xl leading-tight tabular-nums">{f ? f.value : '–'}</dd>
              <dd className="text-xs">{f ? placeText(f) || ' ' : 'Not added yet'}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function EntryDetails({ entry, block, route, routes, fixHref, invite, color }: {
  /** With its stats and entries, the stats show how this entry compares. */
  entry: EntryContent; block: Pick<Block, 'title' | 'icon'> & Partial<Pick<Block, 'stats' | 'entries'>>; route: Route | 'all'; routes: RouteOption[];
  /** In the app, each part gets a pencil that opens a fix for just that part. */
  fixHref?: (field: string) => string;
  /** In the app, parts this entry is missing, shown as invitations to add them. */
  invite?: { description: boolean; sections: string[] };
  /** The Page's color, for the entry's piece. */
  color?: string;
}) {
  const name = (r: Route) => routes.find((o) => o.key === r)?.label ?? r;
  const mine = route !== 'all' ? entry.perRoute?.[route] : undefined;
  // In the game's own route order (the database keeps object keys in its own order).
  const allRoutes = route === 'all' && entry.perRoute
    ? routes.filter((r) => entry.perRoute?.[r.key]?.length).map((r) => [r.key, entry.perRoute![r.key]!] as [Route, Entry['sections']])
    : [];
  return (
    <>
      <div className="flex items-center gap-4">
        <EntryIcon entry={entry} block={block} size="lg" color={color} />
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-tight">{entry.name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(entry.categories).map(([k, v]) => (
              <span key={k} className={'rounded-full px-2 py-0.5 text-xs font-bold ' + tintFor(v)}>{v}</span>
            ))}
            {entry.routes?.length ? (
              <span className="rounded-full bg-card-2 px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-line">{entry.routes.map(name).join(', ')} only</span>
            ) : null}
          </div>
        </div>
      </div>

      {entry.flag && (
        <p className="mt-4 flex gap-2 rounded-2xl bg-sun-soft px-3 py-2 text-sm">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-sun" aria-hidden="true" />
          {entry.flag === 'disputed' ? 'Guides disagree on this one. Check it in your game.' : 'Not confirmed yet.'}
        </p>
      )}

      {mine && (
        <div className="mt-4 rounded-2xl bg-leaf-soft p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-leaf">As {name(route as Route)}</p>
          {mine.map((s) => <p key={s.label} className="mt-1"><span className="font-bold">{s.label}:</span> <RichText text={s.text} skip={entry.name} /></p>)}
        </div>
      )}

      {entry.description && (
        <div className="mt-4 flex items-start gap-1 leading-relaxed">
          <div className="min-w-0 flex-1"><Lines text={entry.description} skip={entry.name} /></div>
          {fixHref && <FixPencil href={fixHref('description')} what="the description" />}
        </div>
      )}

      {block.stats?.length && entry.stats ? <StatTiles entry={entry} block={block} fix={fixHref?.('stats')} color={color} /> : null}

      {allRoutes.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center">
            <p className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{allRoutes[0][1][0]?.label} by Flame Lord</p>
            {fixHref && <FixPencil href={fixHref('routes')} what="the route details" />}
          </div>
          <dl className="mt-1.5 grid gap-1">
            {allRoutes.map(([r, ss]) => (
              <div key={r} className="flex gap-3 rounded-xl bg-card-2 px-3 py-1.5 text-sm">
                <dt className="w-20 shrink-0 font-bold">{name(r)}</dt><dd><RichText text={ss.map((s) => s.text).join(' · ')} skip={entry.name} /></dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {fixHref && invite?.description && <Invite label="About" href={fixHref('description')} />}
      {fixHref && invite && block.stats?.length && !entry.stats ? <Invite label="Stats" href={fixHref('stats')} /> : null}

      {entry.sections.map((s) => (
        <section key={s.label} className="mt-4">
          <div className="flex items-center">
            <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{s.label}</h3>
            {fixHref && <FixPencil href={fixHref(`section:${s.label}`)} what={s.label} />}
          </div>
          <div className="mt-1"><Lines text={s.text} skip={entry.name} /></div>
        </section>
      ))}

      {fixHref && invite?.sections.map((l) => <Invite key={l} label={l} href={fixHref(`section:${l}`)} />)}
    </>
  );
}

/** A part nobody has added yet, with a way to add it. */
function Invite({ label, href }: { label: string; href: string }) {
  return (
    <section className="mt-4 rounded-2xl border border-dashed border-line px-3 py-2.5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{label}</h3>
      <p className="text-sm text-muted">Nobody&apos;s added this yet. Know it? <Link href={href} className="font-bold text-leaf underline">Add it</Link></p>
    </section>
  );
}
