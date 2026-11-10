// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { PAGES } from '../data/pages/fortunes-weave.ts';
import { blockSheet } from './sheets.ts';
import { crc32, xlsx } from './xlsx.ts';
import { readXlsx } from './xlsx-read.ts';
import { guessColumns, matchRows, pasteColumns } from './paste.ts';

const routes = [{ key: 'cai' as const, label: 'Cai' }, { key: 'dietrich' as const, label: 'Dietrich' }, { key: 'theodora' as const, label: 'Theodora' }, { key: 'leda' as const, label: 'Leda' }];
const o = { routes, link: (e: { id: string }) => `https://village/x/${e.id}` };

test('our own download reads back cell for cell, About sheet and all', async () => {
  const sheets = await readXlsx(xlsx([
    { name: 'Gear', columns: ['Name', 'Note', 'Might'], numeric: [false, false, true], rows: [['Théodora 🔥', 'Line one\nLine two & <three>', 14], ['=HYPERLINK("x")', null, -2.5]], table: true },
    { name: "Fortune's About", columns: ['About', ''], rows: [['Credit', 'CC BY-SA']], table: false },
  ]));
  assert.deepEqual(sheets.map((s) => s.name), ['Gear', "Fortune's About"]);
  assert.deepEqual(sheets[0].rows, [['Name', 'Note', 'Might'], ['Théodora 🔥', 'Line one\nLine two & <three>', '14'], ['=HYPERLINK("x")', '', '-2.5']]);
  assert.deepEqual(sheets[1].rows, [['About', ''], ['Credit', 'CC BY-SA']]);
});

/** A zip with every file compressed, the way Excel and Google Sheets save. */
function deflatedZip(files: Record<string, string>) {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const raw = Buffer.from(text, 'utf8'), packed = deflateRawSync(raw), name = Buffer.from(path, 'utf8');
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(raw), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc32(raw), 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    parts.push(local, name, packed); central.push(c, name);
    offset += 30 + name.length + packed.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

test('a compressed workbook with shared strings, gaps, booleans, formulas and rich text, like Excel saves', async () => {
  const bytes = deflatedZip({
    'xl/workbook.xml': '<workbook><sheets><sheet name="Units &amp; more" sheetId="1" r:id="rId3"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId3" Type="x" Target="worksheets/sheet7.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>Name</t></si><si><t>STR</t></si><si><r><t>Ca</t></r><r><rPr><b/></rPr><t xml:space="preserve">i </t></r><rPh><t>カイ</t></rPh></si><si><t>Ninae</t></si></sst>',
    'xl/worksheets/sheet7.xml': `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
      <row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3" t="b"><v>1</v></c><c r="C3"><f>2*5</f><v>10</v></c></row>
      <row r="4"><c r="A4" t="s"><v>3</v></c><c r="C4" t="e"><v>#N/A</v></c></row>
    </sheetData></worksheet>`,
  });
  const [s] = await readXlsx(bytes);
  assert.equal(s.name, 'Units & more');
  assert.deepEqual(s.rows, [['Name', '', 'STR'], ['Cai ', 'Yes', '10'], ['Ninae', '', '']]);
});

test('an uploaded download pastes straight back: Units, nothing changes', async () => {
  const units = PAGES.flatMap((p) => p.blocks).find((b) => b.id === 'units')!;
  const sheet = blockSheet(units, { ...o, spoilers: true });
  const [read] = await readXlsx(xlsx([{ ...sheet, table: true }]));
  const cols = pasteColumns(units, o);
  const picks = guessColumns(read.rows[0], cols);
  const rows = matchRows(units, cols, read.rows, picks);
  assert.equal(rows.length, units.entries.length);
  assert.deepEqual(rows.filter((r) => r.status !== 'same').map((r) => `${r.line}: ${r.problems.join('; ')}`), []);
});

test('not an Excel file says so plainly', async () => {
  await assert.rejects(readXlsx(new TextEncoder().encode('Name,Might\nAura,22')), /isn’t an Excel file/);
});
