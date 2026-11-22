'use client';

import { Clock, MapPin } from 'lucide-react';
import type { Block, EntryContent, FieldDef, Route } from '@/data/pages';
import { valueOf } from '@/lib/fields';
import { RichText } from './TextLinks';
import { tintFor } from './entries';

// The fields a Builder adds to a Checklist or Timeline in Set up (docs/blocks/checklist.md, timeline.md), as
// players see them: small chips on a Checklist row, short lines on a Timeline card. Used by the app and by
// Set up's preview, so the preview is exactly the app.

/** A field's value for the player's route: their route's own, else the shared one. */
export function fieldText(entry: EntryContent, f: FieldDef, route: Route | 'all' = 'all') {
  const v = valueOf(entry, f);
  return (route !== 'all' ? v.byRoute.find(([r]) => r === route)?.[1] : undefined) ?? v.text ?? '';
}

/** Lines joined into one, for a chip or a short line ("Lantern · Mine key"). */
const oneLine = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean).join(' · ');

/** A Checklist row's chips: a place with a pin, a time with a clock, a tag as a pill, anything else "Name: value". */
export function FieldChips({ entry, fields, route, tint }: { entry: EntryContent; fields: FieldDef[]; route?: Route | 'all'; tint: string }) {
  const shown = fields.map((f) => ({ f, text: oneLine(fieldText(entry, f, route)) })).filter((x) => x.text);
  if (!shown.length) return null;
  return (
    <>
      {shown.map(({ f, text }) => f.kind === 'tag' ? (
        <span key={f.key} className={'mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ' + tintFor(text)}>{text}</span>
      ) : (
        <span key={f.key} className="mt-1 inline-flex max-w-full items-start gap-1 rounded-lg bg-card px-2 py-0.5 text-sm ring-1 ring-line">
          {f.kind === 'place' ? <MapPin size={13} className="mt-1 shrink-0" style={{ color: tint }} aria-label={f.label} />
            : f.kind === 'when' ? <Clock size={13} className="mt-1 shrink-0" style={{ color: tint }} aria-label={f.label} />
            : <span className="shrink-0 font-bold">{f.label}:</span>}
          <span className="min-w-0"><RichText text={text} /></span>
        </span>
      ))}
    </>
  );
}

/** A Timeline card's lines: each field's name and value, between the title and the description. */
export function FieldLines({ entry, fields, route }: { entry: EntryContent; fields: FieldDef[]; route?: Route | 'all' }) {
  const shown = fields.map((f) => ({ f, text: oneLine(fieldText(entry, f, route)) })).filter((x) => x.text);
  if (!shown.length) return null;
  return (
    <dl className="mt-2 grid gap-1 text-sm">
      {shown.map(({ f, text }) => (
        <div key={f.key} className="flex gap-3">
          <dt className="w-24 shrink-0 font-bold text-muted">{f.label}</dt>
          <dd className="min-w-0">{f.spoiler ? <Hidden text={text} /> : <RichText text={text} />}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A spoiler field: covered until tapped. */
function Hidden({ text }: { text: string }) {
  return (
    <details className="group inline">
      <summary className="cursor-pointer list-none rounded bg-ink/80 px-2 text-xs font-bold text-paper group-open:hidden">Spoiler: tap to show</summary>
      <RichText text={text} />
    </details>
  );
}

/** A Checklist's groups when nothing in it has a deadline: by its group field, in the field's own order. */
export function groupsBy<E extends EntryContent>(entries: E[], f: FieldDef): { name: string; items: E[] }[] {
  const map = new Map<string, E[]>();
  for (const e of entries) {
    const name = oneLine(fieldText(e, f)) || 'Somewhere else';
    map.set(name, [...(map.get(name) ?? []), e]);
  }
  const order = (f.choices ?? []).map((c) => c.name);
  const rank = (n: string) => (order.includes(n) ? order.indexOf(n) : n === 'Somewhere else' ? Infinity : order.length);
  return [...map.entries()].map(([name, items]) => ({ name, items }))
    .sort((a, b) => rank(a.name) - rank(b.name) || (rank(a.name) === order.length ? a.name.localeCompare(b.name, undefined, { numeric: true }) : 0));
}

/** Whether any entry in a Checklist has a deadline (then it's in deadline order, not grouped). */
export const hasDeadlines = (block: Pick<Block, 'entries'>, key: string) =>
  block.entries.some((e) => e.sections.some((s) => s.label === key && s.text.trim()) || Object.values(e.perRoute ?? {}).some((ss) => ss?.some((s) => s.label === key && s.text.trim())));
