'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardCopy, ClipboardPaste, FileSpreadsheet, FileText, Sheet as SheetIcon, X } from 'lucide-react';
import type { Block } from '@/data/pages';
import { sharePath } from '@/data/pages/links';
import { getGame } from '@/data/games';
import { Tip } from '@/components/Tip';
import type { BlockContext } from '@/components/app/blockParts';
import { aboutRows, blockSheet, fileName, spoilerCount, toCsv, toTsv } from '@/lib/sheets';
import { xlsx } from '@/lib/xlsx';

// "Download as a sheet" in a Block's header (docs/blocks/spreadsheets.md): Excel, CSV, or rows
// copied to paste straight into Excel or Google Sheets. Made here in the browser from the Block
// already on the page. Spoilers stay out unless the player has already shown them, or ticks them in.

/** Hands the player a file the browser's way (saved, or opened on a phone). */
function save(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The older way to copy, for browsers that refuse the clipboard API: select the text in a hidden
 *  box and copy it. */
function copyOld(text: string) {
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position:fixed;left:-9999px;top:0;';
  document.body.appendChild(box);
  box.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* not allowed either */ }
  box.remove();
  return ok;
}

export function SheetButton({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const [open, setOpen] = useState(false);
  const [spoilers, setSpoilers] = useState(ctx.spoilers);
  const [done, setDone] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const hidden = spoilerCount(block);
  // The button swaps in and out of its tooltip (see below), so keep focus on it either way.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) btn.current?.focus({ preventScroll: true });
    touched.current = true;
  }, [open]);

  // Opening starts from the page's spoiler choice, with no message.
  const toggle = () => {
    if (!open) { setSpoilers(ctx.spoilers); setDone(null); }
    setOpen(!open);
  };

  // Escape or a click outside closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const sheet = () => blockSheet(block, {
    spoilers, routes: ctx.routes, link: (e) => window.location.origin + sharePath(ctx.gameId, ctx.page, block, e),
  });
  const count = (n: number) => `${n} ${n === 1 ? 'row' : 'rows'}`;

  const excel = () => {
    const s = sheet();
    const about = aboutRows({
      game: getGame(ctx.gameId)?.shortTitle ?? ctx.gameId, page: ctx.pageTitle, block: block.title, spoilers, rows: s.rows.length,
      link: window.location.origin + sharePath(ctx.gameId, ctx.page, block), date: new Date().toISOString().slice(0, 10),
    });
    const bytes = xlsx([{ ...s, table: true }, { name: 'About', columns: ['About this sheet', ''], rows: about, table: false, widths: [16, 100] }]);
    save(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName(ctx.gameId, block, spoilers, 'xlsx'));
    setDone(`Saved ${count(s.rows.length)} as an Excel file`);
  };
  const csv = () => {
    const s = sheet();
    save(toCsv(s), 'text/csv;charset=utf-8', fileName(ctx.gameId, block, spoilers, 'csv'));
    setDone(`Saved ${count(s.rows.length)} as a CSV file`);
  };
  const copy = async () => {
    const s = sheet();
    // Tab-separated text, the way Excel copies cells: a cell with line breaks is quoted, so they stay
    // inside it. (An HTML table was tried: Chrome strips the hint Excel needs, and rows split.)
    const tsv = toTsv(s);
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      if (!copyOld(tsv)) { setDone('!Couldn’t copy here. Try Excel or CSV instead'); return; }
    }
    setDone(`Copied ${count(s.rows.length)}. Paste them into a sheet`);
  };

  const trigger = (
    <button ref={btn} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={`Download ${block.title} as a spreadsheet`}
      className={'grid size-8 place-items-center rounded-full ring-1 transition ' + (open ? 'text-ink ring-ink' : 'text-muted ring-line hover:text-ink hover:ring-ink')}>
      <SheetIcon size={15} aria-hidden="true" />
    </button>
  );
  const choice = 'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-card-2 focus-visible:bg-card-2';
  return (
    <div ref={box} className="relative shrink-0">
      {/* No tooltip while the menu is open: it would sit over the menu's title. */}
      {open ? trigger : <Tip text={`Download ${block.title} as a spreadsheet`} tint={ctx.tint}>{trigger}</Tip>}
      {open && (
        <>
          {/* On a phone the menu is a sheet from the bottom over a dimmed page. */}
          <div className="fixed inset-0 z-40 bg-ink/30 sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label={`Download ${block.title}`}
            className="pop rise fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-10 sm:w-80 sm:rounded-2xl sm:p-2">
            <div className="flex items-start gap-2 px-3 pb-1 pt-1 sm:pt-2">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg leading-tight">Download {block.title}</p>
                <p className="text-xs text-muted">As a spreadsheet, one row each</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-8 shrink-0 place-items-center rounded-full bg-card-2 sm:hidden" aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            {hidden > 0 && (
              <label className="mx-3 my-1.5 flex cursor-pointer items-center gap-2 rounded-xl bg-card-2 px-3 py-2 text-sm">
                <input type="checkbox" checked={spoilers} onChange={(e) => { setSpoilers(e.target.checked); setDone(null); }} className="size-4 accent-[var(--ink)]" />
                <span className="flex-1 font-bold">Include spoilers</span>
                <span className="text-xs text-muted">{spoilers ? 'In the sheet' : 'Left out'}</span>
              </label>
            )}
            <button type="button" onClick={excel} className={choice}>
              <FileSpreadsheet size={20} className="mt-0.5 shrink-0 text-leaf" aria-hidden="true" />
              <span><span className="block font-bold">Excel (.xlsx)</span><span className="block text-xs text-muted">Numbers stay numbers, filters on. Opens in Google Sheets too</span></span>
            </button>
            <button type="button" onClick={csv} className={choice}>
              <FileText size={20} className="mt-0.5 shrink-0 text-sky" aria-hidden="true" />
              <span><span className="block font-bold">CSV</span><span className="block text-xs text-muted">Plain text that opens anywhere</span></span>
            </button>
            <button type="button" onClick={copy} className={choice}>
              <ClipboardCopy size={20} className="mt-0.5 shrink-0 text-plum" aria-hidden="true" />
              <span><span className="block font-bold">Copy rows</span><span className="block text-xs text-muted">Paste straight into Excel or Google Sheets</span></span>
            </button>
            {/* A message starting with "!" is a failure: red, no tick. */}
            <p role="status" className={'mx-3 mt-1 flex min-h-5 items-center gap-1.5 text-xs font-bold ' + (!done ? 'text-transparent' : done.startsWith('!') ? 'text-berry' : 'text-leaf')}>
              {done && !done.startsWith('!') && <Check size={13} aria-hidden="true" />}{done ? done.replace(/^!/, '') : '.'}
            </p>
            <Link href={`/g/${ctx.gameId}/workshop?paste=${block.id}`} className="mx-3 mt-1 flex items-center gap-1.5 border-t border-line pt-2 text-xs font-bold hover:underline">
              <ClipboardPaste size={13} aria-hidden="true" /> Fixed something? Paste it back in the Workshop
            </Link>
            <p className="mx-3 mb-1 mt-1.5 text-[11px] leading-snug text-muted">
              Made by the community, shared under CC BY-SA. Reuse it freely and credit Village.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
