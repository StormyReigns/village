// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGES } from '../data/pages/fortunes-weave.ts';
import type { Block } from '../data/pages/types.ts';
import { blockSheet, fileName, toCsv, toTsv } from './sheets.ts';
import { colName, crc32, sheetName, xlsx } from './xlsx.ts';

const blocks = PAGES.flatMap((p) => p.blocks);
const find = (id: string) => blocks.find((b) => b.id === id)!;
const routes = [{ key: 'theodora' as const, label: 'Theodora' }, { key: 'cai' as const, label: 'Cai' }];
const opts = { spoilers: true, routes: [], link: (e: { id: string }) => `https://village/x/${e.id}` };

const small: Block = {
  id: 'gear', type: 'items', title: 'Gear', icon: 'Sword', stats: [{ key: 'might', label: 'Might', better: 'high' }],
  fields: [
    { key: 'Type', label: 'Type', kind: 'tag' },
    { key: 'Price', label: 'Price', kind: 'number' },
    { key: '@stats', label: 'Stats', kind: 'chart' },
    { key: 'Where to get it', label: 'Where to get it', kind: 'list' },
    { key: 'Secret', label: 'Secret', kind: 'longtext', spoiler: true },
    { key: 'Old', label: 'Old', kind: 'text', off: true },
  ],
  entries: [
    { id: 'iron-sword', name: 'Iron Sword', sections: [{ label: 'Price', text: '500' }, { label: 'Where to get it', text: 'Town: Shop\nMine: Chest' }, { label: 'Secret', text: 'Shh' }], categories: { Type: 'Sword' }, stats: { might: 5 }, source: 'The game' },
    { id: 'hidden-blade', name: 'Hidden Blade', sections: [{ label: 'Price', text: '1,200 G' }], categories: { Type: 'Sword' }, spoiler: true },
  ],
};

test("a sheet's columns follow the Block's fields, by their names, then Source, Link and id", () => {
  const s = blockSheet(small, opts);
  assert.deepEqual(s.columns, ['Name', 'Type', 'Price', 'Might', 'Where to get it', 'Secret', 'Spoiler', 'Source', 'Link', 'id']);
  assert.deepEqual(s.rows[0], ['Iron Sword', 'Sword', 500, 5, 'Town: Shop\nMine: Chest', 'Shh', null, 'The game', 'https://village/x/iron-sword', 'iron-sword']);
  // A price that isn't a plain number stays as written.
  assert.equal(s.rows[1][2], '1,200 G');
  assert.deepEqual(s.numeric, [false, false, true, true, false, false, false, false, false, false]);
});

test('without spoilers, spoiler entries and spoiler columns are gone', () => {
  const s = blockSheet(small, { ...opts, spoilers: false });
  assert.deepEqual(s.columns, ['Name', 'Type', 'Price', 'Might', 'Where to get it', 'Source', 'Link', 'id']);
  assert.deepEqual(s.rows.map((r) => r[0]), ['Iron Sword']);
});

test('Units: every route value gets its own column, and no two columns share a name', () => {
  const units = find('units');
  const s = blockSheet(units, { ...opts, routes });
  assert.equal(s.columns[0], 'Name');
  assert.ok(s.columns.includes('Appears on'));
  assert.ok(s.columns.some((c) => / \(as Theodora\)$/.test(c)), s.columns.join(' | '));
  assert.equal(s.columns.at(-1), 'id');
  assert.equal(new Set(s.columns.map((c) => c.toLowerCase())).size, s.columns.length, 'no two columns share a name');
  assert.equal(s.rows.length, units.entries.length);
  for (const r of s.rows) assert.equal(r.length, s.columns.length);
});

test('Weapons: the stats are numbers', () => {
  const weapons = blocks.find((b) => b.type === 'items' && b.stats?.some((d) => d.key === 'might'))!;
  const s = blockSheet(weapons, opts);
  const at = s.columns.indexOf('Might');
  assert.ok(at > 0);
  assert.ok(s.rows.some((r) => typeof r[at] === 'number'));
});

test('older Blocks (Checklists, Timelines) still make a sheet', () => {
  for (const b of blocks.filter((x) => ['checklist', 'timeline', 'collection'].includes(x.type) && x.entries.length)) {
    const s = blockSheet(b, { ...opts, routes });
    assert.equal(s.columns[0], 'Name', b.id);
    assert.equal(s.columns.at(-1), 'id', b.id);
    for (const r of s.rows) assert.equal(r.length, s.columns.length, b.id);
  }
});

test('CSV: Excel\'s mark, quoting, and nothing that could run as a formula', () => {
  const csv = toCsv({ name: 'x', columns: ['Name', 'Note', 'N'], numeric: [false, false, true], rows: [['A, B', 'Say "hi"\nthere', -3], ['=SUM(A1)', null, null]] });
  assert.ok(csv.startsWith('\uFEFFName,Note,N\r\n'));
  assert.ok(csv.includes('"A, B","Say ""hi""\nthere",-3\r\n'));
  assert.ok(csv.includes("'=SUM(A1),,\r\n"));
  assert.equal(csv.charCodeAt(0), 0xfeff, 'starts with the UTF-8 mark');
});

test('formula injection: text a contributor typed never runs as a formula, anywhere', () => {
  const bad = ['=HYPERLINK("http://evil","Click")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'];
  const sheet = { name: 'x', columns: ['Name', 'Might'], numeric: [false, true], rows: [...bad.map((b) => [b, null]), ['Iron Sword', -3]] as (string | number | null)[][] };
  const csv = toCsv(sheet).split('\r\n').slice(1, -1);
  const tsv = toTsv(sheet).split('\r\n').slice(1);
  bad.forEach((b, i) => {
    assert.ok(/^"?'/.test(csv[i]), `CSV: ${JSON.stringify(csv[i])}`);
    assert.ok(/^"?'/.test(tsv[i]), `copied rows: ${JSON.stringify(tsv[i])}`);
  });
  // A real negative number stays a number, not text.
  assert.ok(csv.at(-1)!.endsWith(',-3'));
  // In the .xlsx, text is always an inline string: no formula element, and the text is kept as typed.
  const sheet1 = unzip(xlsx([{ ...sheet, table: true }])).get('xl/worksheets/sheet1.xml')!;
  assert.ok(!sheet1.includes('<f>') && !sheet1.includes('<f '));
  assert.ok(sheet1.includes('<c r="A2" t="inlineStr" s="3"><is><t xml:space="preserve">=HYPERLINK(&quot;http://evil&quot;,&quot;Click&quot;)</t>'));
  assert.ok(sheet1.includes('<c r="B8" s="3"><v>-3</v></c>'));
});

test('xlsx: accents and emoji survive, characters XML cannot hold are dropped, names are escaped', () => {
  const files = unzip(xlsx([{ name: "Fortune's <Weave>", columns: ['Name', 'Note'], rows: [['Théodora 🔥', 'a\u0001b\u000bc & \'d\'']], table: true }]));
  const sheet1 = files.get('xl/worksheets/sheet1.xml')!;
  assert.ok(sheet1.includes('Théodora 🔥'));
  assert.ok(sheet1.includes('abc &amp; &apos;d&apos;'));
  assert.ok(files.get('xl/workbook.xml')!.includes('name="Fortune&apos;s &lt;Weave&gt;"'));
});

test('copied rows: tabs, with a cell holding line breaks quoted the way Excel copies it', () => {
  const sheet = { name: 'x', columns: ['Name', 'Where', 'Might'], numeric: [false, false, true], rows: [['Iron "Big" Sword', 'Town: Shop\nMine: Chest', 5]] as (string | number | null)[][] };
  assert.equal(toTsv(sheet), 'Name\tWhere\tMight\r\n"Iron ""Big"" Sword"\t"Town: Shop\nMine: Chest"\t5');
});

test('file names say the game, the Block and whether spoilers are in', () => {
  assert.equal(fileName('fortunes-weave', { id: 'units' }, false, 'xlsx'), 'fortunes-weave-units-no-spoilers-village.xlsx');
  assert.equal(fileName('fortunes-weave', { id: 'units' }, true, 'csv'), 'fortunes-weave-units-village.csv');
});

test('xlsx helpers: column letters, sheet names, the zip checksum', () => {
  assert.deepEqual([0, 25, 26, 51, 52, 701, 702].map(colName), ['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA']);
  assert.equal(sheetName('Weapons and magic: the full list [all]'), 'Weapons and magic the full list');
  assert.equal(sheetName('About', ['about']), 'About 2');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

/** Reads the files back out of a stored (uncompressed) zip, checking each checksum. */
function unzip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, string>();
  let at = 0;
  while (v.getUint32(at, true) === 0x04034b50) {
    const crc = v.getUint32(at + 14, true), size = v.getUint32(at + 18, true), n = v.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + n));
    const data = bytes.subarray(at + 30 + n, at + 30 + n + size);
    assert.equal(crc32(data), crc, name);
    out.set(name, new TextDecoder().decode(data));
    at += 30 + n + size;
  }
  return out;
}

test('xlsx: a real workbook with numbers as numbers, a frozen bold header with filters, and an About sheet', () => {
  const s = blockSheet(small, opts);
  const files = unzip(xlsx([{ ...s, table: true }, { name: 'About', columns: ['About', ''], rows: [['Credit', 'CC BY-SA & you']], table: false }]));
  assert.deepEqual([...files.keys()].sort(), ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']);
  const sheet1 = files.get('xl/worksheets/sheet1.xml')!;
  assert.ok(sheet1.includes('<c r="C2" s="3"><v>500</v></c>'), 'a price is a number');
  assert.ok(sheet1.includes('<c r="A1" t="inlineStr" s="1">'), 'the header is bold');
  assert.ok(sheet1.includes('state="frozen"'));
  assert.ok(sheet1.includes('<autoFilter ref="A1:J3"/>'));
  assert.ok(sheet1.includes('s="2"><is><t xml:space="preserve">Town: Shop\nMine: Chest</t>'), 'line breaks wrap');
  assert.ok(!sheet1.includes('<f>'), 'no formulas, ever');
  const sheet2 = files.get('xl/worksheets/sheet2.xml')!;
  assert.ok(sheet2.includes('CC BY-SA &amp; you'));
  assert.ok(!sheet2.includes('autoFilter'));
  assert.ok(files.get('xl/workbook.xml')!.includes('<sheet name="Gear" sheetId="1" r:id="rId1"/><sheet name="About" sheetId="2" r:id="rId2"/>'));
});
