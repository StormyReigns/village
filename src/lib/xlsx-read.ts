// Reading an uploaded .xlsx without a library (docs/blocks/spreadsheets.md, level 2). An .xlsx is a
// zip of XML files; Excel and Google Sheets compress them with "deflate", which every modern browser
// (and Node) can undo with DecompressionStream. Only what pasting needs is read: each sheet's name
// and its cells as text. Formulas give their last saved result; dates stay as Excel's day numbers.

export interface ReadSheet { name: string; rows: string[][] }

/** The files in a zip, by path. Stored and deflated files are read; anything else is skipped. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record sits in the last 64 KB; it says where the list of files (central directory) is.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('This isn’t an Excel file (.xlsx), or it’s damaged.');
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(at, true) !== 0x02014b50) throw new Error('This Excel file is damaged.');
    const method = v.getUint16(at + 10, true), size = v.getUint32(at + 20, true);
    const nameLen = v.getUint16(at + 28, true), extraLen = v.getUint16(at + 30, true), commentLen = v.getUint16(at + 32, true);
    const local = v.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) out.set(name, data);
    else if (method === 8) out.set(name, await inflate(data));
  }
  return out;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITY[e.toLowerCase()]);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
/** The text of a cell's or shared string's <t> runs, leaving out pronunciation guides (<rPh>). */
const runs = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)].map((m) => unescape(m[1] ?? '')).join('');

/** Column letters to a number: A → 0, AA → 26. */
const colIndex = (ref: string) => [...ref.replace(/\d+$/, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** A path inside the zip, relative to the workbook. */
const resolve = (target: string) => (target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`);

/** Every sheet in an .xlsx, in the workbook's order, as rows of text (empty rows dropped). */
export async function readXlsx(bytes: Uint8Array): Promise<ReadSheet[]> {
  const files = await unzip(bytes);
  const text = (p: string) => { const f = files.get(p); return f ? new TextDecoder().decode(f) : ''; };
  const book = text('xl/workbook.xml');
  if (!book) throw new Error('This isn’t an Excel file (.xlsx).');
  const rels = new Map([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => runs(m[1]));

  return [...book.matchAll(/<sheet\b[^>]*>/g)].map((m) => {
    const name = unescape(attr(m[0], 'name') ?? 'Sheet');
    const target = rels.get(attr(m[0], 'r:id'));
    const xml = target ? text(resolve(target)) : '';
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const at = Number(attr(r[0], 'r') ?? rows.length + 1) - 1;
      const cells: string[] = [];
      let next = 0;
      for (const c of (r[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[0], 'r');
        const i = ref ? colIndex(ref) : next;
        next = i + 1;
        const type = attr(c[0], 't'), body = c[2] ?? '';
        const value = unescape(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
        cells[i] = type === 's' ? shared[Number(value)] ?? ''
          : type === 'inlineStr' ? runs(body)
          : type === 'b' ? (value === '1' ? 'Yes' : 'No')
          : type === 'e' ? ''
          : value;
      }
      rows[at] = Array.from(cells, (x) => x ?? '');
    }
    const kept = rows.filter((r) => r?.some((x) => x.trim()));
    const width = Math.max(0, ...kept.map((r) => r.length));
    return { name, rows: kept.map((r) => [...r, ...Array(width - r.length).fill('')]) };
  });
}
