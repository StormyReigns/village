// A Block as a spreadsheet (docs/blocks/spreadsheets.md): one row per entry, one column per
// field in the Block's own order and names, then the stats as numbers, route values, Source, Link
// and the entry's id (last, so a sheet can be pasted back in and find the right entry). The same
// sheet becomes an .xlsx (src/lib/xlsx.ts), a CSV, or rows copied for pasting into Excel or Sheets.

import type { Block, Entry, EntryContent, Route, Section } from '@/data/pages/types';
import { DESCRIPTION, byFields, chartDefs, isCategory, shownFields, STATS, toggleOptions } from './fields.ts';

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

/** One column of a Block's sheet: how Download reads it from an entry, and how pasting writes a
 *  cell back. Both live together so a downloaded sheet always pastes back as it came out. */
export interface Column {
  header: string;
  numeric?: boolean;
  /** Other names a pasted header may use for it: the field's key, a stat's key. */
  aliases?: string[];
  /** Special columns, matched but not written as values. */
  role?: 'name' | 'id' | 'link';
  get: (e: Entry) => Cell;
  /** Writes a pasted cell (already trimmed; blank means clear) into the entry. Returns a problem in
   *  plain words, or nothing. Writes only when the value really changes, so an unchanged row stays
   *  exactly as it was. */
  put?: (c: EntryContent, cell: string) => string | void;
}

export interface SheetOptions {
  /** Include spoiler entries and spoiler fields. Off: both are left out entirely. */
  spoilers: boolean;
  /** The game's routes with their names, for Blocks that differ by route. */
  routes: { key: Route; label: string }[];
  /** The entry's full address in the app. */
  link: (e: Entry) => string;
  /** Pasting: offer the columns that only show up when some entry needs them (Confirmed, Spoiler). */
  all?: boolean;
}

const blank = (s?: string) => (s?.trim() ? s.trim() : null);
/** A plain number stays a number ("1200", "-3", "2.5"); anything else ("1,200 G") is text. */
const asNumber = (s?: string): Cell => {
  const t = s?.trim();
  if (!t) return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
};
const sectionText = (e: Pick<Entry, 'sections'>, label: string) => blank(e.sections.find((s) => s.label === label)?.text);
/** Line ends as the app keeps them. */
const lines = (s: string) => s.replace(/\r\n?/g, '\n');

// Writing a pasted value, only when it changes.
function putSection(list: Section[], label: string, v: string): Section[] {
  const old = list.find((s) => s.label === label)?.text.trim() ?? '';
  if (old === v) return list;
  if (!v) return list.filter((s) => s.label !== label);
  return list.some((s) => s.label === label) ? list.map((s) => (s.label === label ? { ...s, text: v } : s)) : [...list, { label, text: v }];
}
const setSection = (c: EntryContent, label: string, v: string) => { const next = putSection(c.sections, label, lines(v)); if (next !== c.sections) c.sections = next; };
function setCategory(c: EntryContent, key: string, v: string) {
  if ((c.categories[key]?.trim() ?? '') === v) return;
  const next = { ...c.categories };
  if (v) next[key] = v; else delete next[key];
  c.categories = next;
}
/** Stats: a number ("1,200" reads 1200), or blank to clear. */
function setStat(c: EntryContent, key: string, label: string, v: string): string | void {
  if (!v) {
    if (c.stats?.[key] == null) return;
    const next = { ...c.stats };
    delete next[key];
    c.stats = Object.keys(next).length ? next : undefined;
    return;
  }
  const n = Number(v.replace(/,/g, ''));
  if (!Number.isFinite(n)) return `${label} isn't a number: "${v}"`;
  if (c.stats?.[key] === n) return;
  c.stats = { ...c.stats, [key]: n };
}
const setDescription = (c: EntryContent, v: string) => { if ((c.description?.trim() ?? '') !== v) c.description = v ? lines(v) : undefined; };
const YES = /^(yes|y|true)$/i, NO = /^(no|n|false)$/i;

/** The columns a Block's sheet has, in order. */
function columnsOf(block: Block, entries: Entry[], o: SheetOptions): Column[] {
  const cols: Column[] = [{
    header: 'Name', role: 'name', get: (e) => blank(e.name),
    put: (c, v) => { if (!v) return 'No name'; if (c.name.trim() !== v) c.name = v; },
  }];
  const nameOf = new Map<string, string>();
  const hidden = new Set<string>();

  if (byFields(block)) {
    for (const f of shownFields(block)) {
      if (f.kind === 'tier') continue;
      if (f.spoiler && !o.spoilers) { hidden.add(f.key); continue; }
      nameOf.set(f.key, f.label);
      const aliases = [f.key];
      if (f.kind === 'chart') {
        // The first chart's stats go by their own names (Might); another chart's by both (Growths: HP).
        for (const d of chartDefs(block, f)) {
          const header = f.key === STATS ? d.label : `${f.label}: ${d.label}`;
          cols.push({ header, numeric: true, aliases: [d.key], get: (e) => e.stats?.[d.key] ?? null, put: (c, v) => setStat(c, d.key, header, v) });
        }
      } else if (f.key === DESCRIPTION) {
        cols.push({ header: f.label, aliases: ['Description'], get: (e) => blank(e.description), put: setDescription });
      } else if (f.kind === 'playable') {
        const [yes, no] = toggleOptions(f);
        cols.push({ header: f.label, aliases, get: (e) => blank(e.categories[f.key]), put: (c, v) => {
          const pick = !v ? '' : [yes, no].find((x) => x.toLowerCase() === v.toLowerCase()) ?? (YES.test(v) ? yes : NO.test(v) ? no : null);
          if (pick == null) return `${f.label} must be ${yes} or ${no}: "${v}"`;
          setCategory(c, f.key, pick);
        } });
      } else if (isCategory(f)) {
        cols.push({ header: f.label, aliases, get: (e) => blank(e.categories[f.key]), put: (c, v) => setCategory(c, f.key, v) });
      } else if (f.kind === 'yesno') {
        cols.push({ header: f.label, aliases, get: (e) => sectionText(e, f.key), put: (c, v) => {
          const pick = !v ? '' : YES.test(v) ? 'Yes' : NO.test(v) ? 'No' : null;
          if (pick == null) return `${f.label} must be Yes or No: "${v}"`;
          setSection(c, f.key, pick);
        } });
      } else if (f.kind === 'number') {
        cols.push({ header: f.label, numeric: true, aliases, get: (e) => asNumber(sectionText(e, f.key) ?? undefined), put: (c, v) => setSection(c, f.key, v) });
      } else {
        cols.push({ header: f.label, aliases, get: (e) => sectionText(e, f.key), put: (c, v) => setSection(c, f.key, v) });
      }
    }
  } else {
    // Collections, Checklists and Timelines: their filters (and any other tags), the key fact,
    // their stats, the description, then each "+" section by its label.
    const tags = [...new Set([...(block.filters ?? []), ...entries.flatMap((e) => Object.keys(e.categories))])];
    for (const t of tags) cols.push({ header: t, get: (e) => blank(e.categories[t]), put: (c, v) => setCategory(c, t, v) });
    if (o.all || entries.some((e) => blank(e.stat))) {
      cols.push({ header: block.statName ?? 'Key fact', get: (e) => asNumber(e.stat), put: (c, v) => { if ((c.stat?.trim() ?? '') !== v) c.stat = v || undefined; } });
    }
    for (const d of block.stats ?? []) cols.push({ header: d.label, numeric: true, aliases: [d.key], get: (e) => e.stats?.[d.key] ?? null, put: (c, v) => setStat(c, d.key, d.label, v) });
    if (block.type === 'timeline' && (o.all || entries.some((e) => e.order != null))) {
      cols.push({ header: 'Order', numeric: true, get: (e) => e.order ?? null, put: (c, v) => {
        if (!v) { if (c.order != null) c.order = undefined; return; }
        const n = Number(v);
        if (!Number.isFinite(n)) return `Order isn't a number: "${v}"`;
        if (c.order !== n) c.order = n;
      } });
    }
    if (o.all || entries.some((e) => blank(e.description))) cols.push({ header: 'Description', get: (e) => blank(e.description), put: setDescription });
    for (const label of [...new Set(entries.flatMap((e) => e.sections.map((s) => s.label)))]) cols.push({ header: label, get: (e) => sectionText(e, label), put: (c, v) => setSection(c, label, v) });
  }

  if (block.byRoute) {
    const names = new Map(o.routes.map((r) => [r.key, r.label]));
    cols.push({ header: 'Appears on', get: (e) => (e.routes?.length ? e.routes.map((r) => names.get(r) ?? r).join(', ') : 'Every route'), put: (c, v) => {
      const want = !v || /^every( route)?$/i.test(v) ? [] : v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      const keys: Route[] = [];
      for (const w of want) {
        const r = o.routes.find((x) => x.label.toLowerCase() === w.toLowerCase() || x.key === w.toLowerCase());
        if (!r) return `Appears on: there's no route called "${w}"`;
        keys.push(r.key);
      }
      // Every route listed is the same as "Every route".
      const next = keys.length === o.routes.length ? [] : keys;
      const same = (c.routes ?? []).length === next.length && next.every((k) => c.routes?.includes(k));
      if (!same) c.routes = next.length ? next : undefined;
    } });
    for (const r of o.routes) {
      for (const label of [...new Set(entries.flatMap((e) => (e.perRoute?.[r.key] ?? []).map((s) => s.label)))]) {
        if (hidden.has(label)) continue;
        cols.push({ header: `${nameOf.get(label) ?? label} (as ${r.label})`, get: (e) => blank(e.perRoute?.[r.key]?.find((s) => s.label === label)?.text), put: (c, v) => {
          const list = c.perRoute?.[r.key] ?? [];
          const next = putSection(list, label, lines(v));
          if (next === list) return;
          const per = { ...c.perRoute, [r.key]: next };
          if (!next.length) delete per[r.key];
          c.perRoute = Object.keys(per).length ? per : undefined;
        } });
      }
    }
  }

  // Only when some entry needs them (or when pasting): whether it's confirmed, and which are spoilers.
  if (o.all || entries.some((e) => e.flag)) cols.push({ header: 'Confirmed', get: (e) => (e.flag === 'disputed' ? 'Disputed' : e.flag ? 'Not yet' : 'Yes'), put: (c, v) => {
    const flag = !v || YES.test(v) ? undefined : /^dispute/i.test(v) ? 'disputed' : /^(not yet|no|n|false|unconfirmed|theory)$/i.test(v) ? 'unconfirmed' : null;
    if (flag === null) return `Confirmed must be Yes, Not yet or Disputed: "${v}"`;
    if (c.flag !== flag) c.flag = flag;
  } });
  if (o.spoilers && (o.all || entries.some((e) => e.spoiler))) cols.push({ header: 'Spoiler', get: (e) => (e.spoiler ? 'Yes' : null), put: (c, v) => {
    const on = !v ? false : YES.test(v) ? true : NO.test(v) ? false : null;
    if (on === null) return `Spoiler must be Yes or No: "${v}"`;
    if (Boolean(c.spoiler) !== on) c.spoiler = on || undefined;
  } });
  cols.push({ header: 'Source', get: (e) => blank(e.source), put: (c, v) => { if ((c.source?.trim() ?? '') !== v) c.source = v || undefined; } });
  cols.push({ header: 'Link', role: 'link', get: (e) => o.link(e) });
  cols.push({ header: 'id', role: 'id', get: (e) => e.id });
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

/** A Block's columns with the names a sheet shows, for Download and for pasting back. */
export function sheetColumns(block: Block, o: SheetOptions): Column[] {
  const entries = o.spoilers ? block.entries : block.entries.filter((e) => !e.spoiler);
  const cols = columnsOf(block, entries, o);
  const names = uniqueHeaders(cols.map((c) => c.header));
  return cols.map((c, i) => ({ ...c, header: names[i] }));
}

/** The Block as a sheet. Without spoilers, spoiler entries and spoiler fields are left out. */
export function blockSheet(block: Block, o: SheetOptions): Sheet {
  const entries = o.spoilers ? block.entries : block.entries.filter((e) => !e.spoiler);
  const cols = sheetColumns(block, o);
  return {
    name: block.title,
    columns: cols.map((c) => c.header),
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
