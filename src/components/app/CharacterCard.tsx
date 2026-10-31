'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, EyeOff, MapPin, Pencil, TriangleAlert, X } from 'lucide-react';
import type { Block, Entry, EntryContent, FieldDef, Route, StatDef } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { RichText } from './TextLinks';
import { initials } from './entries';
import type { RouteOption } from './EntryPanel';
import { symbolFor } from './symbols';
import { STATS, besideText, chartDefs, listItems, shownFields, spotOf, valueOf, hasValue, type FieldValue } from '@/lib/fields';
import { byStat, heatFill, placeText, rangeOf, statFacts } from '@/lib/stats';
import { StatTable, statSort } from './StatTable';

type CardBlock = Pick<Block, 'title' | 'icon'> & Partial<Pick<Block, 'fields' | 'stats' | 'symbols' | 'filters' | 'entries'>>;

/**
 * A character's profile, laid out by its Block's fields: the portrait, the name with
 * anything set beside it, tags, where and when they turn up, the stats chart, then the
 * rest in the builders' order. Empty fields don't show. Used by the Characters Block,
 * its details panel, the Workshop's previews and the builders' "John Doe" sample.
 */
export function CharacterCard({ entry, block, route, routes, color = 'var(--ink)', spoilers = false, sample = false, size = 152, onGo, fixHref }: {
  entry: EntryContent; block: CardBlock; route: Route | 'all'; routes: RouteOption[];
  color?: string;
  /** Show spoiler fields without a tap (the player turned spoilers on). */
  spoilers?: boolean;
  /** The builders' made-up sample: gray portrait, marked as a sample. */
  sample?: boolean;
  /** The portrait's width in pixels. */
  size?: number;
  /** Open another character named in Relationships. */
  onGo?: (e: Entry) => void;
  /** In the app, each part gets a pencil that opens a fix for just that part. */
  fixHref?: (field: string) => string;
}) {
  const fields = shownFields(block).filter((f) => hasValue(entry, f));
  const at = (spot: ReturnType<typeof spotOf>) => fields.filter((f) => spotOf(f) === spot);
  const routeName = (r: Route) => routes.find((o) => o.key === r)?.label ?? r;
  // The player's route first, if this field differs by route.
  const short = (v: FieldValue) => (route !== 'all' ? v.byRoute.find(([r]) => r === route)?.[1] : undefined) ?? v.text ?? v.byRoute[0]?.[1] ?? '';
  const symbol = symbolFor(entry, block);
  const portrait = sample ? '#b8bcc8' : color;
  // Charts: the first with a web shows it beside the portrait; the numbers sit lower down.
  const withNumbers = (c: FieldDef) => chartDefs(block, c).filter((d) => typeof entry.stats?.[d.key] === 'number');
  const web = at('chart').find((c) => !c.noWeb && withNumbers(c).length >= 3);
  const [heat, setHeat] = useState<{ chart: FieldDef; sort: string } | null>(null);
  const among = [...(block.entries ?? []).filter((e) => e.name !== entry.name), { ...entry, id: '' } as Entry];
  const chartColor = sample ? '#9aa0ad' : color;
  const webSize = Math.round(Math.max(size * 0.92, 96));

  return (
    <article className="relative min-w-0">
      {sample && <span className="absolute right-0 top-0 rounded-full bg-card-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Sample</span>}
      <div className="flex">
        <Piece size={size} color={portrait} image={entry.icon}>
          {entry.icon ? null : symbol ? <BlockIcon name={symbol} size={Math.round(size * 0.2)} strokeWidth={2.4} /> : initials(entry.name) || <BlockIcon name={block.icon} size={Math.round(size * 0.2)} />}
        </Piece>
      </div>

      <div className="mt-3 grid gap-1.5">
        {/* The web sits on the right, its foot level with the name, reaching up beside the
            portrait, so the name stays right under the portrait whether there's a web or not. */}
        <div className="relative" style={web ? { paddingRight: Math.round(webSize * 0.85) } : undefined}>
          <h2 className="flex flex-wrap items-baseline gap-x-2 font-display text-[1.7rem] leading-tight">
            {entry.name || 'Name'}
            {at('beside').map((f) => (
              <Spoiler key={f.key} f={f} on={spoilers} small>
                <span className="font-sans text-sm font-normal text-muted">{besideText(f, short(valueOf(entry, f)))}</span>
              </Spoiler>
            ))}
          </h2>
          {web && (
            <div className="absolute -bottom-1 right-0">
              <Spoiler f={web} on={spoilers}>
                <Web defs={withNumbers(web)} entry={entry} among={among} color={chartColor} size={webSize} />
              </Spoiler>
            </div>
          )}
        </div>
        {(at('tags').length > 0 || entry.routes?.length) ? (
          <div className="flex flex-wrap gap-1.5">
            {at('tags').map((f, i) => {
              const v = short(valueOf(entry, f));
              if (f.kind === 'yesno' && !/^(y|yes|true)$/i.test(v)) return null;
              return (
                <Spoiler key={f.key} f={f} on={spoilers} small>
                  {/* A yes shows with a tick, so it reads as "yes, this one is" rather than a tag. */}
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={i === 0 ? { background: `color-mix(in srgb, ${color} 14%, white)`, color } : { background: 'var(--card-2)' }}>
                    {f.kind === 'yesno' ? <><Check size={12} strokeWidth={3} aria-hidden="true" />{f.label}</> : v}
                  </span>
                </Spoiler>
              );
            })}
            {entry.routes?.length ? <span className="rounded-full bg-card-2 px-2.5 py-0.5 text-xs font-bold text-muted">{entry.routes.map(routeName).join(', ')} only</span> : null}
          </div>
        ) : null}
        {at('meta').length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {at('meta').map((f) => {
              const Icon = f.kind === 'when' ? Clock : MapPin;
              return (
                <Spoiler key={f.key} f={f} on={spoilers} small>
                  <span className="inline-flex items-center gap-1" title={f.label}>
                    <Icon size={14} style={{ color }} aria-label={f.label} /> <RichText text={short(valueOf(entry, f))} skip={entry.name} />
                  </span>
                </Spoiler>
              );
            })}
          </p>
        )}
      </div>

      {entry.flag && (
        <p className="mt-3 flex gap-2 rounded-2xl bg-sun-soft px-3 py-2 text-sm">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-sun" aria-hidden="true" />
          {entry.flag === 'disputed' ? 'Guides disagree on this one. Check it in your game.' : 'Not confirmed yet.'}
        </p>
      )}

      {at('chart').map((f) => {
        const defs = withNumbers(f);
        // A chart with its numbers switched off still shows its web here, if it isn't the one up top.
        const ownWeb = !f.noWeb && f !== web && defs.length >= 3;
        if (f.noNumbers && !ownWeb) return null;
        return (
          <section key={f.key} className="mt-4">
            <div className="flex items-center">
              <h3 className="flex-1 text-xs font-bold uppercase tracking-wide" style={{ color }}>{f.label}</h3>
              {fixHref && <Fix href={fixHref(f.key === STATS ? 'stats' : `chart:${f.key}`)} what={f.label} />}
            </div>
            <Spoiler f={f} on={spoilers}>
              {ownWeb && <div className="flex justify-center"><Web defs={defs} entry={entry} among={among} color={chartColor} size={150} /></div>}
              {!f.noNumbers && <StatBoxes defs={defs} entry={entry} among={among} color={chartColor} onOpen={(d) => setHeat({ chart: f, sort: statSort(d.key) })} />}
            </Spoiler>
          </section>
        );
      })}
      {heat && (
        <HeatMap label={heat.chart.label} defs={chartDefs(block, heat.chart)} entry={entry} among={among} block={block} color={color} sort={heat.sort}
          onSort={(sort) => setHeat({ ...heat, sort })} onClose={() => setHeat(null)} onGo={onGo} />
      )}

      {fields.filter((f) => ['body', 'section'].includes(spotOf(f))).map((f) => (
        <section key={f.key} className="mt-4">
          {spotOf(f) === 'section' && (
            <div className="flex items-center">
              <h3 className="flex-1 text-xs font-bold uppercase tracking-wide" style={{ color }}>{f.label}</h3>
              {fixHref && <Fix href={fixHref(`section:${f.key}`)} what={f.label} />}
            </div>
          )}
          <Spoiler f={f} on={spoilers}>
            <FieldBody f={f} v={valueOf(entry, f)} route={route} routeName={routeName} name={entry.name} block={block} onGo={onGo} color={color} />
          </Spoiler>
        </section>
      ))}
    </article>
  );
}

/** A spoiler field stays covered until tapped (or until the player turns spoilers on). */
function Spoiler({ f, on, small = false, children }: { f: FieldDef; on: boolean; small?: boolean; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  if (!f.spoiler || on || shown) return <>{children}</>;
  return (
    <button type="button" onClick={() => setShown(true)} aria-label={`Show ${f.label} (spoiler)`}
      className={'spoiler-cover inline-flex items-center gap-1.5 rounded-full font-bold text-muted ring-1 ring-line hover:text-ink '
        + (small ? 'px-2 py-0.5 text-xs' : 'mt-1 w-full justify-center rounded-xl py-2 text-sm')}>
      <EyeOff size={small ? 12 : 14} aria-hidden="true" /> {small ? f.label : `${f.label} is a spoiler. Tap to show`}
    </button>
  );
}

function Fix({ href, what }: { href: string; what: string }) {
  return (
    <Link href={href} aria-label={`Fix ${what}`} className="grid size-7 shrink-0 place-items-center rounded-full text-muted/70 hover:bg-card-2 hover:text-leaf">
      <Pencil size={13} aria-hidden="true" />
    </Link>
  );
}

/** A field's value under its label, shaped by its kind. Route-specific values come first. */
function FieldBody({ f, v, route, routeName, name, block, onGo, color }: {
  f: FieldDef; v: FieldValue; route: Route | 'all'; routeName: (r: Route) => string; name: string; block: CardBlock; onGo?: (e: Entry) => void; color: string;
}) {
  const mine = route !== 'all' ? v.byRoute.find(([r]) => r === route)?.[1] : undefined;
  const others = route === 'all' ? v.byRoute : [];
  const body = (text: string) => {
    if (f.kind === 'list') {
      const items = listItems(text);
      // Names alone (likes, gifts) read as chips; "Name: what it does" as rows.
      if (items.every((i) => !i.note)) return <ul className="mt-1 flex flex-wrap gap-1.5">{items.map((i) => <li key={i.name} className="rounded-full bg-card-2 px-2.5 py-1 text-sm"><RichText text={i.name} skip={name} /></li>)}</ul>;
      return <ul className="mt-1 grid gap-1">{items.map((i) => <li key={i.name} className="text-sm leading-snug"><span className="font-bold">{i.name}</span>{i.note && <span className="text-muted"> {i.note}</span>}</li>)}</ul>;
    }
    if (f.kind === 'links') {
      return (
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
          {listItems(text).map((i) => {
            const who = block.entries?.find((e) => e.name.toLowerCase() === i.name.toLowerCase());
            const inner = (
              <>
                <Piece size={34} color={color} image={who?.icon}>{who?.icon ? null : initials(i.name)}</Piece>
                <span className="grid text-left leading-tight"><span className="text-sm font-bold">{i.name}</span>{i.note && <span className="text-xs text-muted">{i.note}</span>}</span>
              </>
            );
            return (
              <li key={i.name}>
                {who && onGo ? <button type="button" onClick={() => onGo(who)} className="flex items-center gap-2 rounded-xl hover:bg-card-2">{inner}</button>
                  : <span className="flex items-center gap-2">{inner}</span>}
              </li>
            );
          })}
        </ul>
      );
    }
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length > 1) return <ul className="mt-1 grid gap-1">{lines.map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted/60" /><span><RichText text={l} skip={name} /></span></li>)}</ul>;
    return <p className={f.kind === 'longtext' ? 'mt-1 leading-relaxed' : 'mt-0.5'}><RichText text={text} skip={name} /></p>;
  };
  return (
    <>
      {mine && <div className="mt-1 rounded-xl bg-leaf-soft px-3 py-1.5 text-sm"><span className="font-bold text-leaf">As {routeName(route as Route)}:</span> <RichText text={mine} skip={name} /></div>}
      {others.length > 0 && (
        <dl className="mt-1.5 grid gap-1">
          {others.map(([r, t]) => (
            <div key={r} className="flex gap-3 rounded-xl bg-card-2 px-3 py-1.5 text-sm"><dt className="w-20 shrink-0 font-bold">{routeName(r)}</dt><dd><RichText text={t} skip={name} /></dd></div>
          ))}
        </dl>
      )}
      {v.text && body(v.text)}
    </>
  );
}

/** How each stat compares, as 0 to 1 against the highest in the Block (or this
 *  character's own highest until a few characters have numbers). */
function scale(defs: StatDef[], entry: EntryContent, among: Entry[]) {
  const few = among.filter((e) => defs.some((d) => typeof e.stats?.[d.key] === 'number')).length < 3;
  const own = Math.max(1, ...defs.map((d) => entry.stats?.[d.key] ?? 0));
  return (d: StatDef) => {
    const v = entry.stats?.[d.key] ?? 0;
    const max = few ? own : Math.max(1, rangeOf(among, d.key)?.max ?? v);
    return Math.max(0, Math.min(1, v / max));
  };
}

/**
 * A web (radar) chart of one chart's stats: one spoke per stat, clockwise from the top in
 * the Block's order, the shape filled in the Page's color, a short label at each spoke.
 */
function Web({ defs, entry, among, color, size, style }: { defs: StatDef[]; entry: EntryContent; among: Entry[]; color: string; size: number; style?: React.CSSProperties }) {
  const at = scale(defs, entry, among);
  const n = defs.length, c = 50, r = 37;
  const point = (i: number, k: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r * k, c + Math.sin(a) * r * k] as const;
  };
  const ring = (k: number) => defs.map((_, i) => point(i, k).join(',')).join(' ');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={defs.map((d) => `${d.label} ${entry.stats?.[d.key]}`).join(', ')}
      className="shrink-0 overflow-visible" style={style}>
      {[1, 0.66, 0.33].map((k) => <polygon key={k} points={ring(k)} fill={k === 1 ? 'var(--card-2)' : 'none'} stroke="var(--line)" strokeWidth={0.6} />)}
      {defs.map((d, i) => { const [x, y] = point(i, 1); return <line key={d.key} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" strokeWidth={0.6} />; })}
      <polygon points={defs.map((d, i) => point(i, Math.max(0.04, at(d))).join(',')).join(' ')} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      {defs.map((d, i) => {
        const [x, y] = point(i, 1.2);
        return <text key={d.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={700} fill="var(--muted)">{d.label.slice(0, 4).toUpperCase()}</text>;
      })}
    </svg>
  );
}

/**
 * The numbers as small boxes, "STR" over each, colored from gray to the Page's color by how
 * they compare with every other character. Tapping one opens the full heatmap, sorted by it.
 */
function StatBoxes({ defs, entry, among, color, onOpen }: { defs: StatDef[]; entry: EntryContent; among: Entry[]; color: string; onOpen: (d: StatDef) => void }) {
  if (!defs.length) return null;
  const few = among.filter((e) => defs.some((d) => typeof e.stats?.[d.key] === 'number')).length < 3;
  const me = { ...entry, id: '' } as Entry;
  return (
    <div className="mt-1.5 grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(2.2rem,1fr))]">
      {defs.map((d) => {
        const f = statFacts(d, me, among);
        return (
          <button key={d.key} type="button" onClick={() => onOpen(d)} title={f && !few ? `${d.label} ${f.value}: ${placeText(f)}. Tap to compare` : `${d.label}. Tap to compare`}
            className="grid gap-0.5 text-center hover:opacity-80">
            <span className="text-[10px] font-bold uppercase text-muted">{d.label.slice(0, 4)}</span>
            <span className="rounded-lg py-1 text-sm font-bold tabular-nums ring-1 ring-line"
              style={{ background: f && !few ? heatFill(f.goodness, color) : 'var(--card-2)' }}>{entry.stats?.[d.key]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Every character's numbers for one chart, as a heatmap over the page. Tap a row to open them. */
function HeatMap({ label, defs, entry, among, block, color, sort, onSort, onClose, onGo }: {
  label: string; defs: StatDef[]; entry: EntryContent; among: Entry[]; block: CardBlock; color: string; sort: string;
  onSort: (s: string) => void; onClose: () => void; onGo?: (e: Entry) => void;
}) {
  useEffect(() => {
    // Escape closes just the heatmap, not a panel or form underneath.
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);
  // Ticked characters stay at the top, in the sort's order, to compare them side by side.
  // The one the heatmap was opened from starts ticked.
  const [pinned, setPinned] = useState(() => new Set([entry.name]));
  const pin = (name: string) => { const next = new Set(pinned); if (next.has(name)) next.delete(name); else next.add(name); setPinned(next); };
  const def = defs.find((d) => sort.startsWith(statSort(d.key)));
  const rows = among.filter((e) => defs.some((d) => typeof e.stats?.[d.key] === 'number'));
  if (def) rows.sort(byStat(def, sort.endsWith(':worst')));
  else rows.sort((a, b) => a.name.localeCompare(b.name));
  rows.sort((a, b) => Number(pinned.has(b.name)) - Number(pinned.has(a.name)));
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${label}: everyone`} onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[85vh] w-full max-w-3xl flex-col gap-3 rounded-t-[2rem] bg-card p-4 shadow-soft sm:rounded-[2rem] sm:p-5">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 truncate font-display text-xl">{label}: everyone</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2 ring-1 ring-line"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto">
          <StatTable block={{ ...(block as Block), stats: defs }} entries={rows} among={among} sort={sort} onSort={onSort} color={color} mark={entry.name} pinned={pinned} onPin={pin}
            onOpen={(e) => { onClose(); if (e.name !== entry.name) onGo?.(e); }} />
        </div>
      </div>
    </div>
  );
}
