'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Hammer, TriangleAlert, X } from 'lucide-react';
import type { Block, Entry, Route } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { initials, tintFor } from './entries';

export interface RouteOption { key: Route; label: string }

/** Text with several lines reads as a list; one line reads as a sentence. */
export function Lines({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return <p>{text}</p>;
  return <ul className="grid gap-1">{lines.map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted/60" />{l}</li>)}</ul>;
}

export function EntryIcon({ entry, block, size = 'md' }: { entry: Entry; block: Block; size?: 'sm' | 'md' | 'lg' }) {
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
export function EntryPanel({ entry, block, list, route, routes, gameId, onGo, onClose }: {
  entry: Entry; block: Block; list: Entry[]; route: Route | 'all'; routes: RouteOption[]; gameId: string;
  onGo: (e: Entry) => void; onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const at = list.findIndex((e) => e.id === entry.id);
  const prev = at > 0 ? list[at - 1] : undefined;
  const next = at >= 0 && at < list.length - 1 ? list[at + 1] : undefined;

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

  const name = (r: Route) => routes.find((o) => o.key === r)?.label ?? r;
  const mine = route !== 'all' ? entry.perRoute?.[route] : undefined;
  const allRoutes = route === 'all' && entry.perRoute ? Object.entries(entry.perRoute) as [Route, Entry['sections']][] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30 backdrop-blur-[2px] lg:items-stretch lg:justify-end" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={entry.name} onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[88vh] w-full flex-col rounded-t-[2rem] bg-card shadow-soft outline-none lg:max-h-none lg:w-[28rem] lg:rounded-none lg:rounded-l-[2rem]">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line lg:hidden" aria-hidden="true" />
        <div className="flex items-center gap-1 px-4 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{block.title}{at >= 0 && ` · ${at + 1} of ${list.length}`}</p>
          <span className="ml-auto" />
          <button onClick={() => prev && onGo(prev)} disabled={!prev} aria-label="Previous" className="grid size-9 place-items-center rounded-full hover:bg-card-2 disabled:opacity-30"><ChevronLeft size={18} aria-hidden="true" /></button>
          <button onClick={() => next && onGo(next)} disabled={!next} aria-label="Next" className="grid size-9 place-items-center rounded-full hover:bg-card-2 disabled:opacity-30"><ChevronRight size={18} aria-hidden="true" /></button>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-card-2 ring-1 ring-line"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 pt-3">
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

          {entry.description && <div className="mt-4 leading-relaxed"><Lines text={entry.description} /></div>}

          {allRoutes.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{allRoutes[0][1][0]?.label} by Flame Lord</p>
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
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{s.label}</h3>
              <div className="mt-1"><Lines text={s.text} /></div>
            </section>
          ))}

          {entry.source && <p className="mt-6 text-xs text-muted">Source: {entry.source}</p>}
          <Link href={`/g/${gameId}/workshop`} className="btn-quiet mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
            <Hammer size={15} className="text-leaf" aria-hidden="true" /> Suggest a fix
          </Link>
        </div>
      </div>
    </div>
  );
}
