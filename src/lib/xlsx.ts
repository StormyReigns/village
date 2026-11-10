// A small .xlsx writer, so a Block downloads as a real Excel file without a library
// (docs/blocks/spreadsheets.md). An .xlsx is a zip of a few XML files: the workbook, a sheet
// each, and the styles. Text is written in the cell itself (inline), never as a formula, so
// nothing a contributor typed can run. Numbers stay numbers, the header row is bold and frozen,
// filters are on, columns are sized to their content and cells with line breaks wrap.

import type { Cell } from './sheets.ts';

export interface XlsxSheet {
  name: string;
  columns: string[];
  numeric?: boolean[];
  rows: Cell[][];
  /** Bold, frozen header row with filters (the data sheet). Off for the About sheet. */
  table?: boolean;
  /** Column widths in characters; worked out from the content when left out. */
  widths?: number[];
}

// ------------------------------------------------------------------ the zip

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip with every file stored as is (no compression: sheets are small, and it keeps this short). */
export function zip(files: { path: string; data: Uint8Array }[], when = new Date()): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
  const date = ((Math.max(when.getFullYear(), 1980) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const locals: Uint8Array[] = [], centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.path), crc = crc32(f.data), size = f.data.length;
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 0, true);
    l.setUint16(10, time, true); l.setUint16(12, date, true); l.setUint32(14, crc, true);
    l.setUint32(18, size, true); l.setUint32(22, size, true); l.setUint16(26, name.length, true); l.setUint16(28, 0, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
    c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, f.data);
    centrals.push(central);
    offset += local.length + size;
  }
  const centralSize = centrals.reduce((n, x) => n + x.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, at); at += part.length; }
  return out;
}

// ------------------------------------------------------------------ the workbook

/** Characters XML can't hold (control characters) are dropped; the rest is escaped. */
const xml = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function colName(i: number) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** A sheet name Excel accepts: no []:*?/\, at most 31 characters, never blank. */
export function sheetName(s: string, taken: string[] = []) {
  let n = s.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').slice(0, 31) || 'Sheet';
  for (let i = 2; taken.some((t) => t.toLowerCase() === n.toLowerCase()); i++) n = `${n.slice(0, 28)} ${i}`;
  return n;
}

/** Widths from the longest line in each column (header included), between 8 and 60. */
function fitWidths(s: XlsxSheet) {
  return s.columns.map((h, i) => {
    const longest = Math.max(h.length, ...s.rows.map((r) => {
      const c = r[i];
      return c == null ? 0 : Math.max(...String(c).split('\n').map((l) => l.length));
    }));
    return Math.min(60, Math.max(8, longest + 2));
  });
}

// Styles: 0 plain, 1 bold header, 2 wrapped text (top-aligned, for cells with line breaks), 3 top-aligned.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(s: XlsxSheet) {
  const widths = s.widths ?? fitWidths(s);
  const last = colName(Math.max(s.columns.length - 1, 0));
  const lastRow = s.rows.length + 1;
  const cell = (c: Cell, ref: string, header: boolean, numeric: boolean) => {
    if (c == null || c === '') return '';
    if (typeof c === 'number' && Number.isFinite(c) && (numeric || !header)) return `<c r="${ref}" s="3"><v>${c}</v></c>`;
    const t = String(c);
    const style = header ? 1 : t.includes('\n') ? 2 : 3;
    return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(t)}</t></is></c>`;
  };
  const rows = [s.columns, ...s.rows].map((r, ri) => {
    const header = ri === 0 && s.table !== false;
    return `<row r="${ri + 1}">${r.map((c, ci) => cell(c, `${colName(ci)}${ri + 1}`, header, Boolean(s.numeric?.[ci]) && ri > 0)).join('')}</row>`;
  }).join('');
  const frozen = s.table === false ? '<sheetView workbookViewId="0"/>' : '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${last}${lastRow}"/><sheetViews>${frozen}</sheetViews><sheetFormatPr defaultRowHeight="15"/>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows}</sheetData>${s.table === false ? '' : `<autoFilter ref="A1:${last}${lastRow}"/>`}
</worksheet>`;
}

/** The workbook as .xlsx bytes. */
export function xlsx(sheets: XlsxSheet[], when = new Date()): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const names: string[] = [];
  for (const s of sheets) names.push(sheetName(s.name, names));
  const files: { path: string; data: Uint8Array }[] = [];
  const add = (path: string, text: string) => files.push({ path, data: enc.encode(text) });
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(names[0] ?? 'Village')}</dc:title><dc:creator>Village</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${when.toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`);
  // Excel keeps each sheet's filter range as a hidden name; an empty list isn't allowed.
  const filters = sheets.map((s, i) => (s.table === false ? '' : `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(names[i].replace(/'/g, "''"))}'!$A$1:$${colName(Math.max(s.columns.length - 1, 0))}$${s.rows.length + 1}</definedName>`)).join('');
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${filters ? `<definedNames>${filters}</definedNames>` : ''}</workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add('xl/styles.xml', STYLES);
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zip(files, when);
}
