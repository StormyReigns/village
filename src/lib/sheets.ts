// A Block as a spreadsheet (docs/blocks/spreadsheets.md): one row per entry, one column per
// field in the Block's own order and names, then the stats as numbers, route values, Source, Link
// and the entry's id (last, so a sheet can be pasted back in and find the right entry). The same
// sheet becomes an .xlsx (src/lib/xlsx.ts), a CSV, or rows copied for pasting into Excel or Sheets.

import type { Block, Entry, Route } from '@/data/pages/types';
import { DESCRIPTION, byFields, chartDefs, isCategory, shownFields, STATS } from './fields.ts';

/** A cell: text, a number, or empty. */
export type Cell = string | number | null;

export interface Sheet {
  /** The Block's title: the sheet's name in Excel. */
  name: string;
  columns: string[];
  /** Which columns hold numbers (stats, number fields), so Excel keeps them as numbers. */
  numeric: boolean[];
  rows: Cell[][];
}

interface Column { header: string; numeric?: boolean; get: (e: Entry) => Cell }

export interface SheetOptions {
  /** Include spoiler entries and spoiler fields. Off: both are left out entirely. */
  spoilers: boolean;
  /** The game's routes with their names, for Blocks that differ by route. */
  routes: { key: Route; label: string }[];
  /** The entry's full address in the app. */
  link: (e: Entry) => string;
}

const blank = (s?: string) => (s?.trim() ? s.trim() : null);
/** A plain number stays a number ("1200", "-3", "2.5"); anything else ("1,200 G") is text. */
const asNumber = (s?: string): Cell => {
  const t = s?.trim();
  if (!t) return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
};
const sectionText = (e: Entry, label: string) => blank(e.sections.find((s) => s.label === label)?.text);

/** The columns a Block's sheet has, in order. */
function columnsOf(block: Block, entries: Entry[], o: SheetOptions): Column[] {
  const cols: Column[] = [{ header: 'Name', get: (e) => blank(e.name) }];
  // Labels of route-specific values, by field key, so they can get their own columns.
  const routeLabels: string[] = [];
  const nameOf = new Map<string, string>();
  const hidden = new Set<string>();

  if (byFields(block)) {
    for (const f of shownFields(block)) {
      if (f.kind === 'tier') continue;
      if (f.spoiler && !o.spoilers) { hidden.add(f.key); continue; }
      nameOf.set(f.key, f.label);
      if (f.kind === 'chart') {
        // The first chart's stats go by their own names (Might); another chart's by both (Growths: HP).
        for (const d of chartDefs(block, f)) cols.push({ header: f.key === STATS ? d.label : `${f.label}: ${d.label}`, numeric: true, get: (e) => e.stats?.[d.key] ?? null });
      } else if (f.key === DESCRIPTION) cols.push({ header: f.label, get: (e) => blank(e.description) });
      else if (isCategory(f)) cols.push({ header: f.label, get: (e) => blank(e.categories[f.key]) });
      else if (f.kind === 'number') cols.push({ header: f.label, numeric: true, get: (e) => asNumber(sectionText(e, f.key) ?? undefined) });
      else cols.push({ header: f.label, get: (e) => sectionText(e, f.key) });
    }
  } else {
    // Collections, Checklists and Timelines: their filters (and any other tags), the key fact,
    // their stats, the description, then each "+" section by its label.
    const tags = [...new Set([...(block.filters ?? []), ...entries.flatMap((e) => Object.keys(e.categories))])];
    for (const t of tags) cols.push({ header: t, get: (e) => blank(e.categories[t]) });
    if (entries.some((e) => blank(e.stat))) cols.push({ header: block.statName ?? 'Key fact', get: (e) => asNumber(e.stat) });
    for (const d of block.stats ?? []) cols.push({ header: d.label, numeric: true, get: (e) => e.stats?.[d.key] ?? null });
    if (block.type === 'timeline' && entries.some((e) => e.order != null)) cols.push({ header: 'Order', numeric: true, get: (e) => e.order ?? null });
    if (entries.some((e) => blank(e.description))) cols.push({ header: 'Description', get: (e) => blank(e.description) });
    for (const label of [...new Set(entries.flatMap((e) => e.sections.map((s) => s.label)))]) cols.push({ header: label, get: (e) => sectionText(e, label) });
  }

  if (block.byRoute) {
    const names = new Map(o.routes.map((r) => [r.key, r.label]));
    cols.push({ header: 'Appears on', get: (e) => (e.routes?.length ? e.routes.map((r) => names.get(r) ?? r).join(', ') : 'Every route') });
    for (const r of o.routes) {
      for (const label of [...new Set(entries.flatMap((e) => (e.perRoute?.[r.key] ?? []).map((s) => s.label)))]) {
        if (hidden.has(label)) continue;
        routeLabels.push(label);
        cols.push({ header: `${nameOf.get(label) ?? label} (as ${r.label})`, get: (e) => blank(e.perRoute?.[r.key]?.find((s) => s.label === label)?.text) });
      }
    }
  }

  // Only when some entry needs them: whether it's confirmed, and (with spoilers in) which are spoilers.
  if (entries.some((e) => e.flag)) cols.push({ header: 'Confirmed', get: (e) => (e.flag === 'disputed' ? 'Disputed' : e.flag ? 'Not yet' : 'Yes') });
  if (o.spoilers && entries.some((e) => e.spoiler)) cols.push({ header: 'Spoiler', get: (e) => (e.spoiler ? 'Yes' : null) });
  cols.push({ header: 'Source', get: (e) => blank(e.source) });
  cols.push({ header: 'Link', get: (e) => o.link(e) });
  cols.push({ header: 'id', get: (e) => e.id });
  return cols;
}

/** Two columns can't share a name, or pasting back couldn't tell them apart. */
function uniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const n = (seen.get(h.toLowerCase()) ?? 0) + 1;
    seen.set(h.toLowerCase(), n);
    return n === 1 ? h : `${h} (${n})`;
  });
}

/** The Block as a sheet. Without spoilers, spoiler entries and spoiler fields are left out. */
export function blockSheet(block: Block, o: SheetOptions): Sheet {
  const entries = o.spoilers ? block.entries : block.entries.filter((e) => !e.spoiler);
  const cols = columnsOf(block, entries, o);
  return {
    name: block.title,
    columns: uniqueHeaders(cols.map((c) => c.header)),
    numeric: cols.map((c) => Boolean(c.numeric)),
    rows: entries.map((e) => cols.map((c) => c.get(e))),
  };
}

/** How many entries a Block's sheet leaves out as spoilers. */
export const spoilerCount = (block: Block) => block.entries.filter((e) => e.spoiler).length + (byFields(block) ? shownFields(block).filter((f) => f.spoiler).length : 0);

/** Text a spreadsheet would run as a formula (=, +, -, @) gets a ' in front, so a cell someone
 *  typed in the Workshop can never run in Excel. Pasting back in removes it again. */
const safeText = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const csvCell = (c: Cell) => {
  if (c == null) return '';
  if (typeof c === 'number') return String(c);
  const s = safeText(c);
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV, with the mark (BOM) Excel looks for so accents come through, and Windows line ends. */
export function toCsv(sheet: Sheet) {
  return '\uFEFF' + [sheet.columns, ...sheet.rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Tab-separated, which is what Excel and Google Sheets put on the clipboard. A cell with line
 *  breaks, tabs or quotes is quoted, the way Excel copies it. */
export function toTsv(sheet: Sheet) {
  const cell = (c: Cell) => {
    if (c == null) return '';
    if (typeof c === 'number') return String(c);
    const s = safeText(c);
    return /[\t\r\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [sheet.columns, ...sheet.rows].map((r) => r.map(cell).join('\t')).join('\r\n');
}

/** A file name for the download: game, Block, whether spoilers are in, and Village. */
export function fileName(gameId: string, block: Pick<Block, 'id'>, spoilers: boolean, ext: 'xlsx' | 'csv') {
  return `${gameId}-${block.id}${spoilers ? '' : '-no-spoilers'}-village.${ext}`;
}

/** The credit and notes for the About sheet, as label and value rows. */
export function aboutRows(o: { game: string; page: string; block: string; link: string; spoilers: boolean; date: string; rows: number }): [string, string][] {
  return [
    ['What this is', `${o.block}, from the ${o.page} Page of the ${o.game} app on Village`],
    ['Link', o.link],
    ['Made', o.date],
    ['Rows', `${o.rows} ${o.rows === 1 ? 'entry' : 'entries'}`],
    ['Spoilers', o.spoilers ? 'Included: this sheet gives things away' : 'Left out: spoiler entries and spoiler columns are not in this sheet'],
    ['Credit', `Made by the ${o.game} community on Village. Shared under CC BY-SA 4.0: you can reuse and change it if you credit Village (with the link above) and share what you make the same way.`],
    ['Licence', 'https://creativecommons.org/licenses/by-sa/4.0/'],
    ['Sources', 'Each row’s Source column says where its facts come from.'],
    ['Pasting back', 'Keep the id column and the column names, and a fixed sheet can be pasted back into the Workshop as Drafts (coming soon).'],
  ];
}
