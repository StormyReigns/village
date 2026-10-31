import type { Block, EntryContent, Route } from '@/data/pages';
import type { RouteOption } from '@/components/app/EntryPanel';
import { allStatDefs } from '@/lib/fields';

// What a Draft changes compared with the entry on Stable, field by field, in words.

export interface Change { label: string; before?: string; after?: string }

export function changesBetween(before: EntryContent | undefined, after: EntryContent, block: Pick<Block, 'statName' | 'stats'> & Partial<Pick<Block, 'fields' | 'type'>>, routes: RouteOption[]): Change[] {
  const out: Change[] = [];
  const add = (label: string, a?: string, b?: string) => {
    const x = (a ?? '').trim(), y = (b ?? '').trim();
    if (x !== y) out.push({ label, before: x || undefined, after: y || undefined });
  };
  const routeNames = (rs?: Route[]) => (rs?.length ? rs.map((r) => routes.find((o) => o.key === r)?.label ?? r).join(', ') : 'Every route');

  add('Name', before?.name, after.name);
  add(block.statName ?? 'Key fact', before?.stat, after.stat);
  // Characters can have several charts (Base stats, Growths), each with its own stats.
  for (const d of block.type === 'characters' ? allStatDefs(block) : block.stats ?? []) add(d.label, before?.stats?.[d.key]?.toString(), after.stats?.[d.key]?.toString());
  add('Order', before?.order?.toString(), after.order?.toString());
  add('Description', before?.description, after.description);
  for (const k of new Set([...Object.keys(before?.categories ?? {}), ...Object.keys(after.categories)])) {
    add(k, before?.categories?.[k], after.categories[k]);
  }
  for (const label of new Set([...(before?.sections ?? []).map((s) => s.label), ...after.sections.map((s) => s.label)])) {
    add(block.fields?.find((f) => f.key === label)?.label ?? label, before?.sections.find((s) => s.label === label)?.text, after.sections.find((s) => s.label === label)?.text);
  }
  if (routeNames(before?.routes) !== routeNames(after.routes)) out.push({ label: 'Appears on', before: before ? routeNames(before.routes) : undefined, after: routeNames(after.routes) });
  for (const r of routes) {
    const a = before?.perRoute?.[r.key] ?? [], b = after.perRoute?.[r.key] ?? [];
    for (const label of new Set([...a.map((s) => s.label), ...b.map((s) => s.label)])) {
      add(`${label} as ${r.label}`, a.find((s) => s.label === label)?.text, b.find((s) => s.label === label)?.text);
    }
  }
  if (Boolean(before?.spoiler) !== Boolean(after.spoiler)) out.push({ label: 'Spoiler', before: before ? (before.spoiler ? 'Yes' : 'No') : undefined, after: after.spoiler ? 'Yes' : 'No' });
  if ((before?.flag ?? '') !== (after.flag ?? '')) out.push({ label: 'Confirmed', before: before ? (before.flag ? 'Not yet' : 'Yes') : undefined, after: after.flag ? 'Not yet' : 'Yes' });
  return out;
}
