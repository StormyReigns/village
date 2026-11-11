'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { EntryContent, StatDef } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { useStored } from '@/components/useStored';
import { usePlayerPrefs } from '@/components/usePlayerPrefs';
import { initials } from '@/components/app/entries';
import { classesFor, inClass, whoSuits, type Kin, type KinRow } from '@/lib/class-fit';
import { useKin } from './kin';

// Units and classes, linked both ways (docs/blocks/classes.md, slice 2): on a unit's card, the
// classes that suit them; on a class's card, the units it suits and any unit's numbers in it. Shown
// only where a game's characters and classes share a chart's stats (src/lib/class-fit.ts).

type Stats = Record<string, number | undefined> | undefined;

export function ClassFit({ entry, blockId, cast, color }: {
  entry: EntryContent; blockId?: string;
  /** The card's own Page color, for its headings. */
  color: string;
  /** Everyone in the card's own Block, for "better than most of the cast". */
  cast: Stats[];
}) {
  const kin = useKin(blockId);
  const [prefs] = usePlayerPrefs(kin?.game ?? '');
  if (!kin || entry.header || !entry.stats) return null;
  // Only what this player can see: on the route they picked in the switcher (a Theodora player isn't
  // told about a unit only Cai can recruit), and no spoilers, by name or picture, until they show them.
  const onRoute = (r: KinRow) => prefs.route === 'all' || !r.routes?.length || r.routes.includes(prefs.route);
  const routed = kin.rows.filter(onRoute);
  const rows = routed.filter((r) => prefs.spoilers || !r.spoiler);
  const hidden = routed.length - rows.length;

  return kin.side === 'classes'
    ? <ClassesFor kin={kin} rows={rows} routed={routed} hidden={hidden} entry={entry} cast={cast} color={color} />
    : <UnitsFor kin={kin} rows={rows} entry={entry} color={color} />;
}

const href = (kin: Kin, r: KinRow) => `/g/${kin.game}/${kin.page}?e=${kin.block}.${r.id}`;
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '±0');
/** A unit's number in a class, readable without knowing the game: "Spd 45 here (30 + 15)". */
const hereText = (d: StatDef, unit: Stats, mods: Stats) => {
  const own = unit?.[d.key], mod = mods?.[d.key] ?? 0;
  return typeof own === 'number' ? `${d.label} ${own + mod} here (${own} ${mod < 0 ? '−' : '+'} ${Math.abs(mod)})` : d.label;
};
/** "Spd and Dex", "Spd, Dex and Lck". */
const and = (ds: StatDef[]) => ds.map((d) => d.label).join(', ').replace(/, ([^,]*)$/, ' and $1');

function Heading({ children, color }: { children: React.ReactNode; color: string }) {
  return <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{children}</h3>;
}

/** The other side's entry as a small piece, in its own Page's color (a class is indigo on a unit's card). */
function Mini({ r, kin }: { r: KinRow; kin: Kin }) {
  return <Piece size={36} color={`var(--${kin.tint})`} image={r.icon}>{r.icon ? null : initials(r.name)}</Piece>;
}

/** On a unit's card: "Classes for Fabio", a band at a time, by their strengths or by one stat. */
function ClassesFor({ kin, rows, routed, hidden, entry, cast, color }: { kin: Kin; rows: KinRow[]; routed: KinRow[]; hidden: number; entry: EntryContent; cast: Stats[]; color: string }) {
  const bands = kin.bands.filter((b) => routed.some((r) => r.band === b));
  const [stored, setBand] = useStored<string>(`village:${kin.game}:classfit:band`, bands[0] ?? '');
  const band = bands.includes(stored) ? stored : bands[0] ?? '';
  const [by, setBy] = useStored<string>(`village:${kin.game}:classfit:by`, 'strengths');
  const [all, setAll] = useState(false);
  const inBand = useMemo(() => rows.filter((r) => !band || r.band === band), [rows, band]);
  const fits = useMemo(() => classesFor(entry.stats, cast, inBand, kin.defs, by), [entry.stats, cast, inBand, kin.defs, by]);
  const shown = all ? fits : fits.slice(0, 3);
  const name = entry.name || 'them';
  const stat = by.startsWith('stat:') ? kin.defs.find((d) => `stat:${d.key}` === by) : undefined;
  // Classes in this band the player can't see yet: spoilers on their route.
  const bandHidden = routed.filter((r) => r.band === band).length - inBand.length;

  return (
    <section className="mt-4" aria-label={`${kin.title} for ${name}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Heading color={color}>{kin.title} for {name}</Heading>
        <label className="ml-auto">
          <span className="sr-only">Rank by</span>
          <select value={stat ? by : 'strengths'} onChange={(e) => { setBy(e.target.value); setAll(false); }}
            className="rounded-full bg-card-2 px-2.5 py-1 text-xs font-bold ring-1 ring-line">
            <option value="strengths">Their strengths</option>
            {kin.defs.map((d) => <option key={d.key} value={`stat:${d.key}`}>Best {d.label}</option>)}
          </select>
        </label>
      </div>
      {bands.length > 1 && (
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Band">
          {bands.map((b) => (
            <button key={b} type="button" onClick={() => { setBand(b); setAll(false); }} aria-pressed={b === band}
              className={'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ' + (b === band ? 'bg-signal text-ink ring-signal' : 'bg-card ring-line hover:ring-ink')}>{b}</button>
          ))}
        </div>
      )}
      {fits.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {bandHidden > 0 && !inBand.length ? `The ${band} ${kin.title.toLowerCase()} are hidden as spoilers.`
            : `${name}'s numbers are close to everyone's, so no ${kin.title.toLowerCase()} stand out. Try ranking by one stat.`}
        </p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {shown.map((f) => (
            <li key={f.row.id}>
              <Link href={href(kin, f.row)} className="flex items-center gap-3 rounded-xl hover:bg-card-2" title={f.reason.map((d) => `${name}: ${hereText(d, entry.stats, f.row.stats)}`).join(', ')}>
                <Mini r={f.row} kin={kin} />
                <span className="grid min-w-0 leading-tight">
                  <span className="truncate text-sm font-bold">{f.row.name}</span>
                  <span className="text-xs text-muted">
                    {/* Short: what the class adds to their strong stats ("Mag +20 · Res +15"), or, by one stat,
                        their number in it here ("Spd 45 here (30 + 15)"). */}
                    {stat ? hereText(stat, entry.stats, f.row.stats) : f.reason.map((d) => `${d.label} ${signed(f.row.stats[d.key] ?? 0)}`).join(' · ')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {fits.length > 3 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs font-bold text-muted underline underline-offset-2 hover:text-ink">
          {all ? 'Show the top 3' : `Show all ${fits.length} in ${band || kin.title}`}
        </button>
      )}
      {hidden > 0 && bandHidden === 0 && <p className="mt-1 text-xs text-muted">{hidden} more are hidden as spoilers.</p>}
    </section>
  );
}

/** On a class's card: the units it suits most, and any unit's numbers in it. */
function UnitsFor({ kin, rows, entry, color }: { kin: Kin; rows: KinRow[]; entry: EntryContent; color: string }) {
  const suits = useMemo(() => whoSuits(entry.stats, rows, kin.defs), [entry.stats, rows, kin.defs]);
  const sorted = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const [pickedId, setPicked] = useStored<string>(`village:${kin.game}:classfit:unit`, '');
  const picked = sorted.find((r) => r.id === pickedId);
  const one = kin.title.replace(/s$/, '').toLowerCase();

  return (
    <>
      {suits.length > 0 && (
        <section className="mt-4">
          <Heading color={color}>Who suits it</Heading>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
            {suits.map((f) => (
              <li key={f.row.id}>
                <Link href={href(kin, f.row)} className="flex items-center gap-2 rounded-xl hover:bg-card-2" title={`Boosts their ${and(f.reason)}`}>
                  <Mini r={f.row} kin={kin} />
                  <span className="grid text-left leading-tight"><span className="text-sm font-bold">{f.row.name}</span><span className="text-xs text-muted">{and(f.reason)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Heading color={color}>{picked ? `${picked.name} as ${entry.name}` : `Pick a ${one}`}</Heading>
          <label className="ml-auto">
            <span className="sr-only">Pick a {one}</span>
            <select value={picked?.id ?? ''} onChange={(e) => setPicked(e.target.value)} className="max-w-48 rounded-full bg-card-2 px-2.5 py-1 text-xs font-bold ring-1 ring-line">
              <option value="">{picked ? 'Nobody' : `Choose a ${one}…`}</option>
              {sorted.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        </div>
        {picked ? (
          <>
            <div className="mt-1.5 grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(2.6rem,1fr))]">
              {kin.defs.map((d) => {
                const mod = entry.stats?.[d.key] ?? 0;
                return (
                  <span key={d.key} className="grid gap-0.5 text-center" title={hereText(d, picked.stats, entry.stats)}>
                    <span className="text-[10px] font-bold uppercase text-muted">{d.label.slice(0, 4)}</span>
                    <span className="rounded-lg py-1 text-sm font-bold tabular-nums ring-1 ring-line"
                      style={{ background: mod > 0 ? `color-mix(in srgb, ${color} ${Math.min(45, 10 + mod)}%, white)` : 'var(--card-2)' }}>
                      {inClass(picked.stats, entry.stats, d.key) ?? '–'}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted">{picked.stats[d.key] ?? '–'} {mod < 0 ? '−' : '+'} {Math.abs(mod)}</span>
                  </span>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted">{picked.name}&apos;s numbers plus this class&apos;s. <Link href={href(kin, picked)} className="font-bold underline underline-offset-2 hover:text-ink">Open {picked.name}</Link></p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">See any {one}&apos;s numbers in this class. This device remembers who you picked.</p>
        )}
      </section>
    </>
  );
}
