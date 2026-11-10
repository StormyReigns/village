'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Download, FileUp, Info } from 'lucide-react';
import type { Entry } from '@/data/pages';
import { getGame } from '@/data/games';
import { sharePath } from '@/data/pages/links';
import { SignInPrompt } from '@/components/SignInPrompt';
import type { Villager } from '@/components/useVillager';
import { EntryDetails, EntryIcon, type RouteOption } from '@/components/app/EntryPanel';
import { CharacterCard } from '@/components/app/CharacterCard';
import { Tip } from '@/components/Tip';
import { byFields } from '@/lib/fields';
import { aboutRows, blockSheet, fileName } from '@/lib/sheets';
import { xlsx } from '@/lib/xlsx';
import { readXlsx, type ReadSheet } from '@/lib/xlsx-read';
import { batchTitle, emptyColumns, guessColumns, matchRows, pasteColumns, readTable, rememberColumns, type PastedRow } from '@/lib/paste';
import type { Placed } from './chat/Chat';
import { EditorShell } from './EditorShell';
import { ChangeList } from './EntryForm';
import { changesBetween } from './changes';
import { useWide } from './split';
import type { BatchData } from './useBatches';

// "Paste from a sheet" (docs/blocks/spreadsheets.md, level 2): paste rows copied from Excel or
// Google Sheets, or upload a CSV or .xlsx; check which column is which field; see what's new, what
// changes and what can't be used; credit the sheet; send it all as one batch of Drafts.

const MAX_ROWS = 200;
const input = 'w-full rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky';

/** What's kept on this device by "Save draft", per Block. */
interface Kept { text: string; source: string; link: string }
const keptKey = (gameId: string, blockId: string) => `village:paste-draft:${gameId}:${blockId}`;
const pickKey = (gameId: string, blockId: string) => `village:paste-columns:${gameId}:${blockId}`;
const readJson = <T,>(key: string): T | null => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const writeJson = (key: string, v: unknown) => { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } };

/** Hands the player a file the browser's way. */
function save(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function PasteSheet({ gameId, block, routes, me, data, onClose, onSent }: {
  gameId: string; block: Placed; routes: RouteOption[]; me: Villager | null | undefined; data: BatchData;
  onClose: () => void; onSent: (batchId: string) => void;
}) {
  const wide = useWide();
  const [text, setText] = useState('');
  const [book, setBook] = useState<{ file: string; sheets: ReadSheet[]; at: number } | null>(null);
  const [source, setSource] = useState('');
  const [link, setLink] = useState('');
  const [okLicence, setOkLicence] = useState(false);
  const [picks, setPicks] = useState<(string | null)[] | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [focus, setFocus] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // What "Save draft" kept last time on this device comes back.
  useEffect(() => {
    const k = readJson<Kept>(keptKey(gameId, block.id));
    if (!k) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
    setText(k.text); setSource(k.source); setLink(k.link);
  }, [gameId, block.id]);

  const sheetOpts = useMemo(() => ({ routes, link: (e: Entry) => (typeof window === 'undefined' ? '' : window.location.origin) + sharePath(gameId, block.page, block, e) }), [routes, gameId, block]);
  const cols = useMemo(() => pasteColumns(block, sheetOpts), [block, sheetOpts]);
  const table = useMemo(() => (book ? book.sheets[book.at]?.rows ?? [] : text.trim() ? readTable(text) : []), [book, text]);
  const headers = useMemo(() => table[0] ?? [], [table]);
  const guessed = useMemo(() => guessColumns(headers, cols, readJson<Record<string, string>>(pickKey(gameId, block.id)) ?? {}), [headers, cols, gameId, block.id]);
  // The builder's own choices, until the headers change.
  const chosen = picks && picks.length === headers.length ? picks : guessed;
  const rows = useMemo(() => (table.length > 1 ? matchRows(block, cols, table, chosen) : []), [block, cols, table, chosen]);
  const warnings = useMemo(() => emptyColumns(cols, table, chosen, rows), [cols, table, chosen, rows]);
  const named = chosen.some((p) => cols.find((c) => c.header === p)?.role === 'name');

  const group = (s: PastedRow['status']) => rows.map((r, i) => ({ r, i })).filter((x) => x.r.status === s);
  const fresh = group('new'), changed = group('changed'), same = group('same'), bad = group('bad');
  const sending = [...fresh, ...changed].filter((x) => !skip.has(x.i));
  const fullSource = `${source.trim()}${link.trim() ? ` (${link.trim()})` : ''}`;
  const ready = named && sending.length > 0 && sending.length <= MAX_ROWS && source.trim().length >= 3 && okLicence;
  const why = !table.length ? null : !named ? 'Pick which column holds the names.'
    : !sending.length ? 'Nothing to send: every row is the same as the app, ticked off, or can’t be used.'
    : sending.length > MAX_ROWS ? `A batch holds ${MAX_ROWS} rows at most. Untick ${sending.length - MAX_ROWS}, and send them next time.`
    : source.trim().length < 3 ? 'Say where the sheet is from, so it can be credited.'
    : !okLicence ? 'Tick the box about sharing under CC BY-SA.' : null;

  const setPick = (i: number, v: string | null) => {
    const next = [...chosen];
    // A field can be filled from one column only: the other one goes back to "Leave out".
    if (v) next.forEach((p, j) => { if (p === v && j !== i) next[j] = null; });
    next[i] = v;
    setPicks(next);
    setSkip(new Set());
  };

  const loadFile = async (file: File) => {
    setNote('');
    if (file.size > 5_000_000) { setNote('That file is over 5 MB. Copy just the rows you need and paste them instead.'); return; }
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const sheets = (await readXlsx(new Uint8Array(await file.arrayBuffer()))).filter((s) => s.rows.length);
        if (!sheets.length) { setNote('That workbook has no rows in it.'); return; }
        setBook({ file: file.name, sheets, at: 0 });
      } else {
        setBook(null);
        setText(await file.text());
      }
      setPicks(null); setSkip(new Set()); setFocus(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Couldn’t read that file.');
    }
  };

  const ownSheet = () => {
    const s = blockSheet(block, { ...sheetOpts, spoilers: true });
    const about = aboutRows({ game: getGame(gameId)?.shortTitle ?? gameId, page: block.page.title, block: block.title, spoilers: true, rows: s.rows.length,
      link: window.location.origin + sharePath(gameId, block.page, block), date: new Date().toISOString().slice(0, 10) });
    save(xlsx([{ ...s, table: true }, { name: 'About', columns: ['About this sheet', ''], rows: about, table: false, widths: [16, 100] }]),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName(gameId, block, true, 'xlsx'));
  };

  const send = async () => {
    if (!ready || busy) return;
    setBusy(true); setNote('');
    // Columns chosen this time are remembered for this Block, so next week's paste needs no matching.
    writeJson(pickKey(gameId, block.id), { ...readJson<Record<string, string>>(pickKey(gameId, block.id)), ...rememberColumns(headers, chosen) });
    const res = await data.send({
      blockKey: block.id, title: batchTitle(sending.map((x) => x.r), source), source: fullSource,
      rows: sending.map(({ r }) => ({ content: r.content, card: r.entry?.ref?.card, revision: r.entry?.ref?.revision, source: r.content.source })),
    });
    setBusy(false);
    if (res.error) { setNote(res.error); return; }
    writeJson(keptKey(gameId, block.id), null);
    onSent(res.id!);
  };

  // The row shown in the preview: the one picked, else the first that would be sent.
  const shown = focus != null ? rows[focus] : sending[0]?.r;
  const color = `var(--${block.page.tint})`;
  const preview = (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-line md:p-4">
      {!shown ? <p className="text-sm text-muted">Paste some rows, and tap one to see how it looks in the app.</p>
        : byFields(block) && block.type !== 'guide'
          ? <CharacterCard entry={shown.content} block={block} route="all" routes={routes} color={color} size={wide ? 120 : 76} />
          : <EntryDetails entry={shown.content} block={block} route="all" routes={routes} color={color} />}
    </div>
  );

  const rowLine = ({ r, i }: { r: PastedRow; i: number }, tick: boolean) => {
    const changes = r.status === 'changed' && r.entry ? changesBetween(r.entry, r.content, block, routes) : [];
    return (
      <li key={i} className={'rounded-2xl bg-card ring-1 ' + (focus === i ? 'ring-ink' : 'ring-line')}>
        <div className="flex items-center gap-2 px-2.5 py-2">
          {tick && (
            <input type="checkbox" checked={!skip.has(i)} aria-label={`Send ${r.content.name}`} className="size-4 shrink-0 accent-[var(--ink)]"
              onChange={() => setSkip((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
          )}
          <button type="button" onClick={() => setFocus(focus === i ? null : i)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <EntryIcon entry={{ ...r.content, id: r.entry?.id ?? `row-${i}` } as Entry} block={block} size="sm" color={color} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{r.content.name || <span className="text-muted">No name</span>}</span>
              <span className="block truncate text-xs text-muted">
                Row {r.line}{r.status === 'changed' ? ` · ${changes.length} change${changes.length === 1 ? '' : 's'}` : ''}{r.status === 'bad' ? ` · ${r.problems.join(' · ')}` : ''}
              </span>
            </span>
            {r.status === 'changed' && <ChevronDown size={15} className={'shrink-0 text-muted transition ' + (focus === i ? 'rotate-180' : '')} aria-hidden="true" />}
          </button>
        </div>
        {focus === i && changes.length > 0 && <div className="border-t border-line px-3 pb-3"><ChangeList changes={changes} /></div>}
      </li>
    );
  };

  const section = (title: string, list: { r: PastedRow; i: number }[], opts: { tick?: boolean; open?: boolean; tone?: string; hint?: string }) => list.length > 0 && (
    <details open={opts.open} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1">
        <span className={'text-sm font-bold ' + (opts.tone ?? '')}>{title} · {list.length}</span>
        {opts.hint && <span className="text-xs text-muted">{opts.hint}</span>}
        <ChevronDown size={15} className="ml-auto text-muted transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-1 grid gap-1.5">{list.map((x) => rowLine(x, Boolean(opts.tick)))}</ul>
    </details>
  );

  const editor = (
    <div className="grid content-start gap-4">
      {/* 1. Paste or upload */}
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-sm font-bold">1. Paste rows, headers included</p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-bold ring-1 ring-line hover:ring-ink">
            <FileUp size={14} aria-hidden="true" /> Choose a file
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ''; }} />
          </label>
        </div>
        {book ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-line">
            <span className="min-w-0 flex-1 truncate"><b>{book.file}</b> · {Math.max(0, (book.sheets[book.at]?.rows.length ?? 1) - 1)} rows</span>
            {book.sheets.length > 1 && (
              <label className="text-xs">
                <span className="sr-only">Which sheet</span>
                <select value={book.at} onChange={(e) => { setBook({ ...book, at: Number(e.target.value) }); setPicks(null); setSkip(new Set()); setFocus(null); }} className="rounded-full px-2 py-1 font-bold">
                  {book.sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
              </label>
            )}
            <button type="button" onClick={() => { setBook(null); setPicks(null); setFocus(null); }} className="text-xs font-bold text-muted hover:text-ink">Paste instead</button>
          </div>
        ) : (
          <textarea value={text} onChange={(e) => { setText(e.target.value); setPicks(null); setSkip(new Set()); setFocus(null); }} rows={text ? 4 : 6} spellCheck={false}
            placeholder={'Select the rows in Excel or Google Sheets (with the header row), copy, and paste here.\n\nName\tMight\tHit\nIron Sword\t5\t90'}
            className={input + ' font-mono text-xs leading-relaxed'} />
        )}
        <p className="text-xs text-muted">
          Easiest: <button type="button" onClick={ownSheet} className="inline-flex items-center gap-1 font-bold text-ink underline"><Download size={12} aria-hidden="true" />download {block.title} as a sheet</button>, fix or add rows in it, and paste it back. Its columns match already.
        </p>
      </div>

      {/* 2. Columns */}
      {headers.length > 0 && (
        <div className="grid gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold">2. Which column is which</p>
            <Tip text="Village guessed from the headers. Fix any that are wrong. Columns left out aren't touched. A blank cell in a column you use clears that value." tint={block.page.tint}>
              <Info size={14} className="text-muted" aria-label="How columns work" />
            </Tip>
          </div>
          <ul className="grid gap-1.5">
            {headers.map((h, i) => {
              const samples = table.slice(1).map((r) => r[i]?.trim()).filter(Boolean).slice(0, 2);
              return (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-2xl bg-card px-3 py-1.5 ring-1 ring-line">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{h || `Column ${i + 1}`}</span>
                    <span className="block truncate text-xs text-muted">{samples.join(' · ') || 'empty'}</span>
                  </span>
                  <label>
                    <span className="sr-only">Field for {h || `column ${i + 1}`}</span>
                    <select value={chosen[i] ?? ''} onChange={(e) => setPick(i, e.target.value || null)}
                      className={'w-full rounded-xl px-2 py-1.5 text-sm ' + (chosen[i] ? 'font-bold' : 'text-muted')}>
                      <option value="">Leave out</option>
                      {cols.filter((c) => c.role !== 'link').map((c) => <option key={c.header} value={c.header}>{c.role === 'id' ? 'id (to match entries)' : c.header}</option>)}
                    </select>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 3. Rows */}
      {rows.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-bold">3. What happens</p>
          <div className="flex flex-wrap gap-1.5 text-xs font-bold">
            <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-leaf">{fresh.length} new</span>
            <span className="rounded-full bg-sky-soft px-2.5 py-1 text-sky">{changed.length} changed</span>
            <span className="rounded-full bg-card px-2.5 py-1 text-muted ring-1 ring-line">{same.length} same as the app</span>
            {bad.length > 0 && <span className="rounded-full bg-berry-soft px-2.5 py-1 text-berry">{bad.length} can’t use</span>}
          </div>
          {warnings.map((w) => (
            <p key={w.field} className="flex items-start gap-2 rounded-2xl bg-sun-soft px-3 py-2 text-sm">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span><b>{w.header}</b> is empty on every row: this clears {w.field} on {w.clears} {w.clears === 1 ? 'entry' : 'entries'}. Set it to “Leave out” if that’s not what you meant.</span>
            </p>
          ))}
          {section('Can’t use', bad, { open: true, tone: 'text-berry', hint: 'Fix these in the sheet and paste again' })}
          {section('New', fresh, { tick: true, open: true, tone: 'text-leaf' })}
          {section('Changed', changed, { tick: true, open: true, tone: 'text-sky', hint: 'Tap one to see what changes' })}
          {section('Same as the app', same, {})}
          <p className="text-xs text-muted">Entries the sheet doesn’t have are left alone. Pasting never deletes anything.</p>
        </div>
      )}

      {/* 4. Credit */}
      {rows.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-bold">4. Where it’s from</p>
          <label className="grid gap-1">
            <span className="text-xs text-muted">Who made the sheet, and what it is<span className="text-berry"> *</span></span>
            <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={200} placeholder="Fan stat sheet by Mira" className={input} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted">A link to it, if there is one</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={90} placeholder="https://docs.google.com/spreadsheets/…" className={input} />
          </label>
          <label className="flex items-start gap-2 rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-line">
            <input type="checkbox" checked={okLicence} onChange={(e) => setOkLicence(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]" />
            <span>I made this sheet, or its maker is happy for it to be shared under CC BY-SA, like everything on Village.</span>
          </label>
        </div>
      )}
      {why && rows.length > 0 && <p className="text-sm text-muted">{why}</p>}
    </div>
  );

  const count = sending.length;
  return (
    <EditorShell
      label={`Paste from a sheet into ${block.title}`}
      title={`Paste into ${block.title}`}
      actions={me === null ? (
        <SignInPrompt forWhat="send rows from your sheet">Sign in</SignInPrompt>
      ) : (
        <button type="button" onClick={send} disabled={!ready || busy || me === undefined} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
          {busy ? 'Sending…' : count ? `Send ${count} for review` : 'Send for review'}
        </button>
      )}
      note={note ? <p role="status" className="text-berry">{note}</p> : ready ? <p className="flex items-center gap-1.5 text-muted"><Check size={14} aria-hidden="true" />One batch of Drafts. Nothing changes in the app until it’s reviewed and published.</p> : undefined}
      onClose={onClose}
      dirty={Boolean(text.trim() || book)}
      onSaveDraft={() => { if (!book) writeJson(keptKey(gameId, block.id), { text, source, link } satisfies Kept); onClose(); }}
      onDiscard={() => { writeJson(keptKey(gameId, block.id), null); onClose(); }}
      draftHint={book ? 'An uploaded file isn’t kept: choose it again next time. Discard closes without sending.' : 'Save draft keeps what you pasted on this device, ready the next time you open this. Discard throws it away.'}
      tint={block.page.tint}
      editor={editor}
      preview={preview}
    />
  );
}

