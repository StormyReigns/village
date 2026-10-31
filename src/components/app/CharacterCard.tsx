'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Clock, EyeOff, Maximize2, MapPin, Minimize2, Pencil, TriangleAlert } from 'lucide-react';
import type { Block, Entry, EntryContent, FieldDef, Route } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { RichText } from './TextLinks';
import { initials } from './entries';
import type { RouteOption } from './EntryPanel';
import { symbolFor } from './symbols';
import { besideText, listItems, shownFields, spotOf, valueOf, hasValue, type FieldValue } from '@/lib/fields';
import { rangeOf } from '@/lib/stats';

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

  return (
    <article className="relative min-w-0">
      {sample && <span className="absolute right-0 top-0 rounded-full bg-card-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Sample</span>}
      <div className="flex justify-center">
        <Piece size={size} color={portrait} image={entry.icon}>
          {entry.icon ? null : symbol ? <BlockIcon name={symbol} size={Math.round(size * 0.2)} strokeWidth={2.4} /> : initials(entry.name) || <BlockIcon name={block.icon} size={Math.round(size * 0.2)} />}
        </Piece>
      </div>

      <div className="mt-3 grid gap-1.5">
        <h2 className="flex flex-wrap items-baseline gap-x-2 font-display text-[1.7rem] leading-tight">
          {entry.name || 'Name'}
          {at('beside').map((f) => (
            <Spoiler key={f.key} f={f} on={spoilers} small>
              <span className="font-sans text-sm font-normal text-muted">{besideText(f, short(valueOf(entry, f)))}</span>
            </Spoiler>
          ))}
        </h2>
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

      {at('chart').map((f) => (
        <Spoiler key={f.key} f={f} on={spoilers}>
          <StatChart entry={entry} block={block} label={f.label} color={sample ? '#c3c7d0' : color} fix={fixHref?.('stats')} />
        </Spoiler>
      ))}

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

/**
 * The stats as a bar chart, left to right in the Block's order. Each bar is measured
 * against the highest in the Block, so a glance says who's strong where. Until a few
 * characters have numbers, bars are measured against this one's highest instead. Too many to fit
 * scroll sideways; "Bigger" shows taller bars with room for every number.
 */
function StatChart({ entry, block, label, color, fix }: { entry: EntryContent; block: CardBlock; label: string; color: string; fix?: string }) {
  const [big, setBig] = useState(false);
  const defs = (block.stats ?? []).filter((d) => typeof entry.stats?.[d.key] === 'number');
  if (!defs.length) return null;
  const among = [...(block.entries ?? []).filter((e) => e.name !== entry.name), { ...entry, id: '' } as Entry];
  const few = among.filter((e) => e.stats && Object.keys(e.stats).length).length < 3;
  const own = Math.max(1, ...defs.map((d) => entry.stats![d.key]));
  const h = big ? 120 : 64;
  return (
    <section className="mt-4 rounded-2xl bg-card-2 p-3">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-xs font-bold uppercase tracking-wide" style={{ color }}>{label}</h3>
        <button type="button" onClick={() => setBig(!big)} aria-pressed={big} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-muted hover:bg-card hover:text-ink">
          {big ? <Minimize2 size={12} aria-hidden="true" /> : <Maximize2 size={12} aria-hidden="true" />} {big ? 'Smaller' : 'Bigger'}
        </button>
        {fix && <Fix href={fix} what="the stats" />}
      </div>
      <div className={'mt-2 flex pb-1 ' + (big ? 'flex-wrap justify-start gap-1 gap-y-3' : 'chip-strip gap-0.5 overflow-x-auto')}>
        {defs.map((d) => {
          const v = entry.stats![d.key];
          const max = few ? own : Math.max(1, rangeOf(among, d.key)?.max ?? v);
          const fill = Math.max(4, Math.round((h * Math.max(0, v)) / max));
          return (
            <div key={d.key} className={'flex shrink-0 flex-col items-center gap-1 ' + (big ? 'w-14' : 'min-w-[26px] flex-1')}>
              <span className={(big ? 'text-base' : 'text-[13px]') + ' font-bold tabular-nums'}>{v}</span>
              <span className="flex w-3.5 items-end rounded-md bg-card ring-1 ring-line" style={{ height: h }}>
                <span className="w-full rounded-md" style={{ height: fill, background: color }} />
              </span>
              <span className={(big ? 'text-xs' : 'text-[10px]') + ' font-bold uppercase text-muted'}>{d.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
