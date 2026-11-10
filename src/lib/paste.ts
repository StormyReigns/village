// Pasting rows from a spreadsheet into a Block (docs/blocks/spreadsheets.md, level 2): read what was
// pasted or uploaded, guess which column is which field, match rows to entries, and work out each
// row's new content. The Workshop shows the result and sends it as a batch of Drafts.
//
// Columns come from sheetColumns in ./sheets.ts, the same list Download writes, so a downloaded
// sheet pastes back exactly as it came out.

import type { Block, Entry, EntryContent } from '@/data/pages/types';
import { sheetColumns, type Column, type SheetOptions } from './sheets.ts';

// ------------------------------------------------------------------ reading

/** Rows and cells from pasted text or a CSV file. Copying from Excel or Google Sheets gives tabs;
 *  CSV files use commas (or semicolons, in countries where the comma is the decimal mark). Quoted
 *  cells can hold line breaks, tabs and doubled quotes. Empty rows are dropped. */
export function readTable(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = first.includes('\t') ? '\t' : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, i = 0;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); if (row.some((c) => c.trim())) rows.push(row); row = []; };
  while (i < t.length) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"') {
        if (t[i + 1] === '"') { cell += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell === '') { quoted = true; i++; continue; }
    if (ch === sep) { endCell(); i++; continue; }
    if (ch === '\r' || ch === '\n') { endRow(); i += ch === '\r' && t[i + 1] === '\n' ? 2 : 1; continue; }
    cell += ch; i++;
  }
  if (cell || row.length) endRow();
  // Every row as wide as the widest, so columns line up.
  const width = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
}

/** A cell as pasting reads it: trimmed, with the ' Download puts before formula-like text taken off. */
export const cellText = (s: string | undefined) => {
  const t = (s ?? '').trim();
  return /^'[=+\-@]/.test(t) ? t.slice(1) : t === '-' ? '' : t;
};

// ------------------------------------------------------------------ guessing columns

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Short forms stat sheets use, and the word they stand for. */
const SHORT: Record<string, string> = {
  atk: 'attack', att: 'attack', str: 'strength', mag: 'magic', def: 'defense', defence: 'defense', res: 'resistance',
  spd: 'speed', agi: 'agility', lck: 'luck', luk: 'luck', dex: 'dexterity', skl: 'skill', cha: 'charm', con: 'constitution',
  mov: 'move', mt: 'might', wt: 'weight', wgt: 'weight', crt: 'crit', critical: 'crit', rng: 'range', lv: 'level', lvl: 'level',
  hp: 'hitpoints', mp: 'magicpoints', sp: 'specialpoints', int: 'intelligence', wis: 'wisdom', vit: 'vitality', end: 'endurance',
  desc: 'description', loc: 'location', qty: 'quantity', amt: 'amount',
};
/** Other words for the Name and id columns. */
const NAME_WORDS = ['name', 'character', 'unit', 'item', 'weapon', 'title', 'entry'];
const ID_WORDS = ['id', 'slug'];

const long = (s: string) => SHORT[s] ?? s;

/** Edit distance, for close spellings ("Strenght"). */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/** How well a pasted header fits a column: 4 exact, 3 by key or other word, 2 by short form or
 *  start, 1 a close spelling, 0 not at all. */
function fit(header: string, col: Column): number {
  const h = norm(header);
  if (!h) return 0;
  const names = [col.header, ...(col.aliases ?? [])].map(norm).filter(Boolean);
  if (names[0] === h) return 4;
  if (names.includes(h)) return 3;
  if (col.role === 'name' && NAME_WORDS.includes(h)) return 3;
  if (col.role === 'id' && ID_WORDS.includes(h)) return 3;
  if (names.some((n) => long(n) === long(h))) return 2;
  if (h.length >= 3 && names.some((n) => n.length > h.length && n.startsWith(h))) return 2;
  // A close spelling, of the name or of what its short form stands for ("Resistence" → Res).
  const close = (a: string, b: string) => Math.min(a.length, b.length) >= 4 && distance(a, b) <= (a.length >= 8 ? 2 : 1);
  if (names.some((n) => close(n, h) || close(long(n), long(h)))) return 1;
  return 0;
}

/** For each pasted header, the column it most likely is (by header), or null to leave it out. Each
 *  column is used once, best fits first. Remembered choices win: a header seen before on this Block. */
export function guessColumns(headers: string[], cols: Column[], remembered: Record<string, string> = {}): (string | null)[] {
  const out: (string | null)[] = headers.map(() => null);
  const used = new Set<string>();
  headers.forEach((h, i) => {
    const want = remembered[norm(h)];
    if (want && cols.some((c) => c.header === want) && !used.has(want)) { out[i] = want; used.add(want); }
  });
  const pairs = headers.flatMap((h, i) => cols.map((c) => ({ i, c: c.header, score: fit(h, c) }))).filter((p) => p.score > 0);
  pairs.sort((a, b) => b.score - a.score || a.i - b.i);
  for (const p of pairs) {
    if (out[p.i] !== null || used.has(p.c)) continue;
    out[p.i] = p.c;
    used.add(p.c);
  }
  return out;
}

/** What to remember about a matching, keyed by the header's plain spelling. */
export const rememberColumns = (headers: string[], picks: (string | null)[]) =>
  Object.fromEntries(headers.flatMap((h, i) => (picks[i] && norm(h) ? [[norm(h), picks[i] as string]] : [])));

// ------------------------------------------------------------------ matching rows

export type RowStatus = 'new' | 'changed' | 'same' | 'bad';

export interface PastedRow {
  /** Its row in the sheet, counting the header as row 1 (what the spreadsheet shows). */
  line: number;
  status: RowStatus;
  /** The entry it changes, when it matched one. */
  entry?: Entry;
  /** What the entry will hold. */
  content: EntryContent;
  /** Why it can't be used, in plain words. */
  problems: string[];
}

/** Every column a pasted sheet can fill, for this Block: Download's columns with spoilers and the
 *  optional ones included. */
export const pasteColumns = (block: Block, o: Omit<SheetOptions, 'spoilers' | 'all'>) => sheetColumns(block, { ...o, spoilers: true, all: true });

/** A copy of an entry's content, to change. */
function contentOf(e: Entry): EntryContent {
  const c = structuredClone(e) as Entry & Partial<Pick<Entry, 'id' | 'ref'>>;
  delete (c as Partial<Entry>).id;
  delete (c as Partial<Entry>).ref;
  return c;
}
const fresh = (): EntryContent => ({ name: '', sections: [], categories: {} });

/** Same content, whatever order its keys are in. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/**
 * Each pasted row matched to the app: by id first, then by name (ignoring case, spaces and
 * accents), with its new content. Only the columns picked are written; a blank cell in one of them
 * clears that value (Matt). Rows the app has but the sheet doesn't are left alone.
 */
export function matchRows(block: Block, cols: Column[], table: string[][], picks: (string | null)[]): PastedRow[] {
  const byHeader = new Map(cols.map((c) => [c.header, c]));
  const picked = picks.map((p) => (p ? byHeader.get(p) ?? null : null));
  const nameAt = picked.findIndex((c) => c?.role === 'name');
  const idAt = picked.findIndex((c) => c?.role === 'id');
  const byId = new Map(block.entries.map((e) => [e.id, e]));
  const byName = new Map<string, Entry>();
  for (const e of block.entries) if (!byName.has(norm(e.name))) byName.set(norm(e.name), e);

  const rows: PastedRow[] = table.slice(1).map((cells, r) => {
    const problems: string[] = [];
    const id = idAt >= 0 ? cellText(cells[idAt]) : '';
    const name = nameAt >= 0 ? cellText(cells[nameAt]) : '';
    const entry = (id && byId.get(id)) || (name ? byName.get(norm(name)) : undefined);
    if (id && !byId.has(id) && !entry) problems.push(`No entry has the id "${id}"`);
    const content = entry ? contentOf(entry) : fresh();
    picked.forEach((c, i) => {
      if (!c?.put) return;
      const problem = c.put(content, cellText(cells[i]));
      if (problem) problems.push(problem);
    });
    if (!content.name.trim() && !problems.includes('No name')) problems.push('No name');
    const same = !problems.length && entry && stable(content) === stable(contentOf(entry));
    // A Draft's name needs 3 to 120 characters (as in the form). An unchanged row isn't sent, so an
    // older short name ("Ty") is fine as long as the row doesn't change it.
    const len = content.name.trim().length;
    if (!same && len && (len < 3 || len > 120)) problems.push('Names need 3 to 120 characters');
    const status: RowStatus = problems.length ? 'bad' : same ? 'same' : !entry ? 'new' : 'changed';
    return { line: r + 2, status, entry, content, problems };
  });

  // Two rows can't be the same entry, or two new entries share a name.
  const seen = new Map<string, PastedRow>();
  for (const row of rows) {
    if (row.status === 'bad') continue;
    const key = row.entry ? `e:${row.entry.id}` : `n:${norm(row.content.name)}`;
    const before = seen.get(key);
    if (before) {
      const what = `Rows ${before.line} and ${row.line} are both ${row.entry ? `“${row.entry.name}”` : `called “${row.content.name}”`}`;
      for (const x of [before, row]) { x.status = 'bad'; x.problems.push(what); }
    } else seen.set(key, row);
  }
  return rows;
}

/** A column that's blank on every row clears that value everywhere: worth a warning first. The
 *  pasted header of each such column, with how many entries it would clear. */
export function emptyColumns(cols: Column[], table: string[][], picks: (string | null)[], rows: PastedRow[]) {
  const byHeader = new Map(cols.map((c) => [c.header, c]));
  return picks.flatMap((p, i) => {
    const c = p ? byHeader.get(p) : undefined;
    if (!c?.put || c.role || table.length < 3 || table.slice(1).some((r) => cellText(r[i]))) return [];
    const clears = rows.filter((r) => r.entry && r.status !== 'bad' && c.get(r.entry) != null).length;
    return clears ? [{ header: table[0][i], field: c.header, clears }] : [];
  });
}

/** The batch's title, from its counts: "12 new and 30 fixed from Mira's stat sheet". */
export function batchTitle(rows: PastedRow[], source: string) {
  const n = rows.filter((r) => r.status === 'new').length, f = rows.filter((r) => r.status === 'changed').length;
  const what = [n && `${n} new`, f && `${f} fixed`].filter(Boolean).join(' and ') || 'Nothing';
  const from = source.trim().replace(/^from\s+/i, '');
  return `${what}${from ? ` from ${from}` : ''}`.slice(0, 160);
}
