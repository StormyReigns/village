'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Hammer, Hourglass, Pencil, TriangleAlert, X } from 'lucide-react';
import type { Block, Entry, EntryContent, Route } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { ShareButton } from '@/components/ShareButton';
import { RichText } from './TextLinks';
import { Tip } from '@/components/Tip';
import { initials, tintFor } from './entries';
import { browserClient } from '@/lib/supabase/browser';

/** An open Draft that fixes this entry, if there is one (so nobody writes the same fix twice). */
function useWaitingFix(cardId?: string) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const db = browserClient();
    if (!db || !cardId) return;
    let live = true;
    db.from('drafts').select('id').eq('card_id', cardId).in('status', ['open', 'checking']).limit(1)
      .then(({ data }) => { if (live) setId(data?.[0]?.id ?? null); });
    return () => { live = false; };
  }, [cardId]);
  return cardId ? id : null;
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

export function EntryIcon({ entry, block, size = 'md' }: { entry: EntryContent; block: Pick<Block, 'title' | 'icon'>; size?: 'sm' | 'md' | 'lg' }) {
  const tint = tintFor(Object.values(entry.categories)[0] ?? block.title);
  const box = size === 'lg' ? 'size-20 rounded-3xl text-2xl' : size === 'sm' ? 'size-10 rounded-xl text-sm' : 'size-14 rounded-2xl text-lg';
  if (entry.icon) {
    // eslint-disable-next-line @next/next/no-img-element -- community pictures, sized small
    return <img src={entry.icon} alt="" className={`${box} object-cover`} />;
  }
  return (
    <span className={`gloss grid shrink-0 place-items-center font-display ${box} ${tint}`} aria-hidden="true">
      {initials(entry.name) || <BlockIcon name={block.icon} size={20} />}
    </span>
  );
}

/**
 * An entry's details: a side panel on wide screens, a sheet from the bottom on phones.
 * Arrows (or ← →) step through the entries the player is looking at.
 */
export function EntryPanel({ entry, block, list, route, routes, gameId, sharePath, onGo, onClose }: {
  entry: Entry; block: Block; list: Entry[]; route: Route | 'all'; routes: RouteOption[]; gameId: string; sharePath: string;
  onGo: (e: Entry) => void; onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const at = list.findIndex((e) => e.id === entry.id);
  const prev = at > 0 ? list[at - 1] : undefined;
  const next = at >= 0 && at < list.length - 1 ? list[at + 1] : undefined;
  const waiting = useWaitingFix(entry.ref?.card);
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
          {waiting && (
            <Link href={`/g/${gameId}/workshop?draft=${waiting}`} className="mb-4 flex items-center gap-2 rounded-2xl bg-sun-soft px-3 py-2 text-sm hover:ring-1 hover:ring-sun">
              <Hourglass size={15} className="shrink-0 text-sun" aria-hidden="true" />
              <span className="flex-1"><span className="font-bold">A fix is waiting for votes.</span> See it before writing another</span>
            </Link>
          )}
          <EntryDetails entry={entry} block={block} route={route} routes={routes} fixHref={fixHref} />
          {entry.source && <p className="mt-6 text-xs text-muted">Source: {entry.source}</p>}
          <Tip text="Opens a Draft with this entry filled in. Change what's wrong; villagers check it" tint="leaf" className="mt-4">
            <Link href={`/g/${gameId}/workshop?fix=${block.id}.${entry.id}`} className="btn-quiet inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
              <Hammer size={15} className="text-leaf" aria-hidden="true" /> Suggest a fix
            </Link>
          </Tip>
        </div>
      </div>
    </div>
  );
}

/** What an entry says: used in the app's panel and in Workshop previews. */
export function EntryDetails({ entry, block, route, routes, fixHref }: {
  entry: EntryContent; block: Pick<Block, 'title' | 'icon'>; route: Route | 'all'; routes: RouteOption[];
  /** In the app, each part gets a pencil that opens a fix for just that part. */
  fixHref?: (field: string) => string;
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
        <EntryIcon entry={entry} block={block} size="lg" />
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
          {mine.map((s) => <p key={s.label} className="mt-1"><span className="font-bold">{s.label}:</span> {s.text}</p>)}
        </div>
      )}

      {entry.description && (
        <div className="mt-4 flex items-start gap-1 leading-relaxed">
          <div className="min-w-0 flex-1"><Lines text={entry.description} skip={entry.name} /></div>
          {fixHref && <FixPencil href={fixHref('description')} what="the description" />}
        </div>
      )}

      {allRoutes.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center">
            <p className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{allRoutes[0][1][0]?.label} by Flame Lord</p>
            {fixHref && <FixPencil href={fixHref('routes')} what="the route details" />}
          </div>
          <dl className="mt-1.5 grid gap-1">
            {allRoutes.map(([r, ss]) => (
              <div key={r} className="flex gap-3 rounded-xl bg-card-2 px-3 py-1.5 text-sm">
                <dt className="w-20 shrink-0 font-bold">{name(r)}</dt><dd>{ss.map((s) => s.text).join(' · ')}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {entry.sections.map((s) => (
        <section key={s.label} className="mt-4">
          <div className="flex items-center">
            <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{s.label}</h3>
            {fixHref && <FixPencil href={fixHref(`section:${s.label}`)} what={s.label} />}
          </div>
          <div className="mt-1"><Lines text={s.text} skip={entry.name} /></div>
        </section>
      ))}

    </>
  );
}
