import type { Block, EntryContent, Route } from '@/data/pages';
import type { RouteOption } from '@/components/app/EntryPanel';
import { DESCRIPTION, allStatDefs, fieldsOf } from '@/lib/fields';
import { parseSteps, parseWriteup, sectionWords, stepWords } from '@/lib/guides';
import { spotChange } from '@/lib/world-map';
import { wikiFixOf } from '@/lib/wiki';

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
  if ((before?.icon ?? '') !== (after.icon ?? '')) out.push({ label: 'Picture', before: before?.icon ? 'A picture' : undefined, after: after.icon ? (before?.icon ? 'A new picture' : 'A picture') : undefined });
  add(block.statName ?? 'Key fact', before?.stat, after.stat);
  // Characters and Items can have several charts (Base stats, Growths), each with its own stats.
  for (const d of block.type === 'characters' || block.type === 'items' || block.type === 'classes' ? allStatDefs(block) : block.stats ?? []) add(d.label, before?.stats?.[d.key]?.toString(), after.stats?.[d.key]?.toString());
  add('Order', before?.order?.toString(), after.order?.toString());
  // A place's pin on the map, in words (docs/blocks/world.md).
  const pin = spotChange(before?.spot, after.spot);
  if (pin) out.push({ label: 'Pin', ...pin });
  const fields = block.type === 'characters' || block.type === 'items' || block.type === 'classes' || block.type === 'guide' ? fieldsOf(block) : block.fields ?? [];
  add(fields.find((f) => f.key === DESCRIPTION)?.label ?? 'Description', before?.description, after.description);
  // A guide's steps in words, numbered, with their spoiler and picture marks spelled out. A
  // write-up's sections in words, with a spoiler section's words and picture kept out.
  const words = (label: string, t?: string) => {
    const kind = fields.find((f) => f.key === label)?.kind;
    if (!t) return t;
    if (kind === 'steps') return parseSteps(t).map((x, i) => `${i + 1}. ${stepWords(x)}`).join('\n');
    if (kind === 'writeup') return parseWriteup(t).map((s) => (s.spoiler ? `(spoiler) ${s.heading || 'A section'}: covered here, tap it in the preview to read` : sectionWords(s))).join('\n');
    return t;
  };
  for (const k of new Set([...Object.keys(before?.categories ?? {}), ...Object.keys(after.categories)])) {
    add(k, before?.categories?.[k], after.categories[k]);
  }
  for (const label of new Set([...(before?.sections ?? []).map((s) => s.label), ...after.sections.map((s) => s.label)])) {
    const name = fields.find((f) => f.key === label)?.label ?? label;
    const was = before?.sections.find((s) => s.label === label)?.text, now = after.sections.find((s) => s.label === label)?.text;
    const [wb, wa] = [words(label, was), words(label, now)];
    // Only covered words changed: still a change (so it can be sent), without showing them.
    if ((was ?? '').trim() !== (now ?? '').trim() && (wb ?? '').trim() === (wa ?? '').trim()) out.push({ label: name, before: wb, after: `${wa} (changed)` });
    else add(name, wb, wa);
  }
  if (routeNames(before?.routes) !== routeNames(after.routes)) out.push({ label: 'Appears on', before: before ? routeNames(before.routes) : undefined, after: routeNames(after.routes) });
  for (const r of routes) {
    const a = before?.perRoute?.[r.key] ?? [], b = after.perRoute?.[r.key] ?? [];
    for (const label of new Set([...a.map((s) => s.label), ...b.map((s) => s.label)])) {
      add(`${label} as ${r.label}`, a.find((s) => s.label === label)?.text, b.find((s) => s.label === label)?.text);
    }
  }
  // Its wiki page (docs/blocks/wiki-links.md): the usual one found from the name, another page, or none.
  const wikiWords = (w: unknown) => { const f = wikiFixOf(w); return f === false ? 'No link' : f ?? 'The usual page'; };
  if (wikiWords(before?.wiki) !== wikiWords(after.wiki)) out.push({ label: 'Wiki page', before: before ? wikiWords(before.wiki) : undefined, after: wikiWords(after.wiki) });
  if (Boolean(before?.spoiler) !== Boolean(after.spoiler)) out.push({ label: 'Spoiler', before: before ? (before.spoiler ? 'Yes' : 'No') : undefined, after: after.spoiler ? 'Yes' : 'No' });
  if ((before?.flag ?? '') !== (after.flag ?? '')) out.push({ label: 'Confirmed', before: before ? (before.flag ? 'Not yet' : 'Yes') : undefined, after: after.flag ? 'Not yet' : 'Yes' });
  return out;
}
