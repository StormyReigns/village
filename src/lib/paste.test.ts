// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGES } from '../data/pages/fortunes-weave.ts';
import type { Block } from '../data/pages/types.ts';
import { blockSheet, toCsv, toTsv } from './sheets.ts';
import { entriesOf } from './fields.ts';
import { batchTitle, cellText, emptyColumns, guessColumns, matchRows, pasteColumns, readTable, rememberColumns } from './paste.ts';

const blocks = PAGES.flatMap((p) => p.blocks);
const find = (id: string) => blocks.find((b) => b.id === id)!;
const routes = [{ key: 'cai' as const, label: 'Cai' }, { key: 'dietrich' as const, label: 'Dietrich' }, { key: 'theodora' as const, label: 'Theodora' }, { key: 'leda' as const, label: 'Leda' }];
const o = { routes, link: (e: { id: string }) => `https://village/x/${e.id}` };

/** Paste a table into a Block with Village's own guesses, as the screen starts out. */
function paste(block: Block, text: string) {
  const table = readTable(text);
  const cols = pasteColumns(block, o);
  const picks = guessColumns(table[0], cols);
  return { table, cols, picks, rows: matchRows(block, cols, table, picks) };
}

test('reading: tabs from Excel, commas or semicolons from CSV, quoted cells with line breaks', () => {
  assert.deepEqual(readTable('Name\tWhere\r\nIron Sword\t"Town: Shop\nMine: Chest"\r\n\r\n'), [['Name', 'Where'], ['Iron Sword', 'Town: Shop\nMine: Chest']]);
  assert.deepEqual(readTable('﻿Name,Note\n"A, B","Say ""hi"""\nC'), [['Name', 'Note'], ['A, B', 'Say "hi"'], ['C', '']]);
  assert.deepEqual(readTable('Name;Might\nAura;22'), [['Name', 'Might'], ['Aura', '22']]);
  assert.equal(cellText("'=SUM(A1)"), '=SUM(A1)');
  assert.equal(cellText(' - '), '');
});

test('round trip: every Block downloaded and pasted straight back changes nothing', () => {
  for (const b of blocks.filter((x) => x.entries.length && x.type !== 'guide' && x.type !== 'tierlist')) {
    for (const format of ['tsv', 'csv'] as const) {
      const sheet = blockSheet(b, { ...o, spoilers: true });
      const { picks, rows } = paste(b, format === 'tsv' ? toTsv(sheet) : toCsv(sheet));
      assert.deepEqual(picks, sheet.columns, `${b.id} ${format}: every column is recognized`);
      const off = rows.filter((r) => r.status !== 'same');
      assert.equal(off.length, 0, `${b.id} ${format}: ${off.slice(0, 2).map((r) => `row ${r.line} ${r.status} ${r.problems.join('; ')}`).join(' | ')}`);
      // A Classes tier's header card is never a row (src/lib/sheets.ts).
      assert.equal(rows.length, entriesOf(b).length);
    }
  }
});

test('a sheet downloaded without spoilers pastes back without touching spoilers', () => {
  const units = find('units');
  const { rows } = paste(units, toTsv(blockSheet(units, { ...o, spoilers: false })));
  assert.ok(rows.length > 0 && rows.every((r) => r.status === 'same'));
});

const weapons = blocks.find((b) => b.type === 'items' && b.stats?.some((d) => d.key === 'might'))!;
const aura = weapons.entries.find((e) => e.name === 'Aura')!;

test('changes: a new number, a cleared cell, a new row; problems in plain words', () => {
  const text = [
    'Weapon\tMT\tHit\tWt\tCrit\tWhere to get it',
    `Aura\t99\t${aura.stats!.hit}\t${aura.stats!.weight}\t\t`, // Might changes, Crit and Where clear
    'Brand New Blade\t5\t80\t3\t0\tA shop',
    'Bolting\thigh\t1\t1\t1\t',
    'Al\t1\t1\t1\t1\t',
  ].join('\n');
  const { picks, rows } = paste(weapons, text);
  assert.deepEqual(picks, ['Name', 'Might', 'Hit', 'Weight', 'Crit', 'Where to get it'], 'Weapon → Name, MT → Might, Wt → Weight');
  const [a, n, bolt, al] = rows;
  assert.equal(a.status, 'changed');
  assert.equal(a.content.stats?.might, 99);
  assert.equal(a.content.stats?.crit, undefined, 'a blank cell clears the value');
  assert.equal(a.content.sections.find((s) => s.label === 'Where to get it'), undefined);
  assert.equal(a.entry?.id, aura.id);
  assert.equal(n.status, 'new');
  assert.deepEqual(n.content.stats, { might: 5, hit: 80, weight: 3, crit: 0 });
  assert.equal(bolt.status, 'bad');
  assert.deepEqual(bolt.problems, ['Might isn’t a number: "high"'.replace('’', "'")]);
  assert.equal(al.status, 'bad');
  assert.match(al.problems[0], /3 to 120/);
});

test('columns the sheet does not have stay as they are', () => {
  const { rows } = paste(weapons, `Name\tMight\nAura\t${aura.stats!.might}`);
  assert.equal(rows[0].status, 'same');
  const { rows: r2 } = paste(weapons, 'Name\tMight\nAura\t1');
  assert.deepEqual(r2[0].content.stats, { ...aura.stats, might: 1 });
  assert.deepEqual(r2[0].content.sections, aura.sections, 'other fields untouched');
});

test('rows match by id first, then by name ignoring case and accents; doubles and unknown ids are problems', () => {
  const { rows } = paste(weapons, `id\tName\tMight\n${aura.id}\tAura renamed\t22\n\tbolting\t1\nnope\tNobody here\t1\n\tFresh One\t1\n\tfresh one\t2`);
  assert.equal(rows[0].entry?.id, aura.id);
  assert.equal(rows[0].content.name, 'Aura renamed');
  assert.equal(rows[1].entry?.name, 'Bolting');
  assert.equal(rows[2].status, 'bad');
  assert.match(rows[2].problems[0], /No entry has the id "nope"/);
  assert.equal(rows[3].status, 'bad');
  assert.equal(rows[4].status, 'bad');
  assert.match(rows[4].problems.at(-1)!, /Rows 5 and 6 are both called/);
});

test('short forms and close spellings find their stat; remembered choices win', () => {
  const units = find('units');
  const cols = pasteColumns(units, o);
  assert.deepEqual(guessColumns(['Unit', 'Strength', 'Spd', 'Luk', 'Resistence', 'Notes'], cols), ['Name', 'Str', 'Spd', 'Lck', 'Res', null]);
  const remembered = rememberColumns(['Notes'], ['Description']);
  assert.equal(guessColumns(['Notes'], cols, remembered)[0], 'Description');
});

test('toggles, yes or no, routes and spoilers read back from the words Download writes', () => {
  // Units with "Playable or NPC" and a yes or no field switched on.
  const base = find('units');
  const units: Block = { ...base, fields: [...base.fields!.map((f) => (f.key === 'Playable' ? { ...f, off: false } : f)), { key: 'Recruitable', label: 'Recruitable', kind: 'yesno' }] };
  const cai = units.entries.find((e) => e.name === 'Cai') ?? units.entries[0];
  const { rows } = paste(units, `Name\tPlayable or NPC\tAppears on\tSpoiler\tRecruitable\n${cai.name}\tnpc\tTheodora, leda\tyes\tY\n${cai.name} Two\tmaybe\tNowhere\t\tperhaps`);
  assert.equal(rows[0].content.sections.find((s) => s.label === 'Recruitable')?.text, 'Yes');
  assert.match(rows[1].problems.join(' | '), /Recruitable must be Yes or No: "perhaps"/);
  assert.equal(rows[0].content.categories.Playable, 'NPC');
  assert.deepEqual(rows[0].content.routes, ['theodora', 'leda']);
  assert.equal(rows[0].content.spoiler, true);
  assert.equal(rows[1].status, 'bad');
  assert.match(rows[1].problems.join(' | '), /Playable or NPC must be Playable or NPC: "maybe"/);
  assert.match(rows[1].problems.join(' | '), /no route called "Nowhere"/);
});

test('a column blank on every row is flagged before it clears a value everywhere', () => {
  const { table, cols, picks, rows } = paste(weapons, 'Name\tCrit\nAura\t\nBolting\t');
  const warn = emptyColumns(cols, table, picks, rows);
  assert.equal(warn.length, 1);
  assert.equal(warn[0].field, 'Crit');
  assert.ok(warn[0].clears >= 1);
});

test('a batch is titled from its counts and source', () => {
  const { rows } = paste(weapons, 'Name\tMight\nAura\t1\nBrand New Blade\t5\nAnother Blade\t6');
  assert.equal(batchTitle(rows, "Mira's stat sheet"), "2 new and 1 fixed from Mira's stat sheet");
});
