'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { SHEET, SheetHandle, useWide } from './split';

/**
 * The frame every Workshop editor shares (Set up, the character form): the title with its
 * main action and the X pinned at the top, the editor on the Workbench (globals.css), and
 * beside it, or on a phone in a sheet below, the preview exactly as players see it, on the
 * Page's own tint. Closing with unsaved changes asks first: save a draft, or discard.
 */
export function EditorShell({ label, title, titleExtra, actions, note, onClose, dirty, onSaveDraft, onDiscard, draftHint, tint, sheetExtra, editor, preview, aside }: {
  /** What a screen reader calls the dialog. */
  label: string;
  title: string;
  /** Beside the title, like an "i" with how it works. */
  titleExtra?: ReactNode;
  /** The main action (Submit, Save setup), pinned beside the X. */
  actions?: ReactNode;
  /** A line under the title: a problem with submitting, or "Saved". */
  note?: ReactNode;
  onClose: () => void;
  /** Something has changed that would be lost by just closing. */
  dirty: boolean;
  onSaveDraft: () => void;
  onDiscard: () => void;
  /** What saving a draft does here, in a sentence. */
  draftHint: string;
  /** The Page's color name, for the preview's tint. */
  tint: string;
  /** Beside "Players see" on the preview's bar, like a Profile / List row switch. */
  sheetExtra?: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
  /** Wide screens only: more help under the preview. */
  aside?: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState<number>(SHEET.start);
  const [asking, setAsking] = useState(false);
  const wide = useWide();
  useEffect(() => { dialog.current?.focus(); }, []);
  const close = () => (dirty ? setAsking(true) : onClose());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm md:items-center md:p-6" onClick={close}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (asking) setAsking(false); else close(); } }}
        className="workbench rise relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden shadow-soft outline-none md:h-auto md:max-h-[92vh] md:rounded-[2rem]">
        <div className="flex shrink-0 items-center gap-3 px-4 py-2.5 md:px-6 md:pb-3 md:pt-5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate font-display text-xl md:text-2xl">{title}</h2>
            {titleExtra}
          </div>
          {actions && <div id="entry-actions" className="shrink-0">{actions}</div>}
          <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-full bg-card ring-1 ring-line" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        {note && <div className="shrink-0 px-4 pb-1 text-sm md:px-6">{note}</div>}

        {/* Phones: the editor and the sheet scroll on their own. Wide: the two sit side by side
            and scroll together under the pinned title, the preview staying in view. */}
        <div data-split className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:gap-6 md:overflow-y-auto md:px-6 md:pb-6 md:pt-1">
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain px-4 pb-4 md:overflow-visible md:p-0">
            {editor}
          </div>
          <div data-sheet className="relative z-10 flex shrink-0 flex-col rounded-t-[1.5rem] shadow-[0_-1px_0_var(--line),0_-14px_28px_-8px_rgba(21,23,28,0.38)] md:sticky md:top-0 md:grid md:h-auto md:content-start md:gap-3 md:self-start md:rounded-none md:shadow-none"
            style={wide ? undefined : { height: `${sheet}%`, background: `var(--${tint}-soft)` }}>
            <SheetHandle pct={sheet} onChange={setSheet}>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">Players see</p>
                {sheetExtra}
              </div>
            </SheetHandle>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:overflow-visible md:rounded-[1.5rem] md:p-3"
              style={wide ? { background: `var(--${tint}-soft)` } : undefined}>
              {preview}
            </div>
            {aside && <div className="hidden gap-3 md:grid">{aside}</div>}
          </div>
        </div>

        {asking && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/30 p-4" onClick={() => setAsking(false)}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="close-ask" aria-describedby="close-ask-hint" onClick={(e) => e.stopPropagation()}
              className="rise grid w-full max-w-sm gap-3 rounded-[1.5rem] bg-card p-5 shadow-soft">
              <h3 id="close-ask" className="font-display text-xl">You have unsaved changes</h3>
              <p id="close-ask-hint" className="text-sm text-muted">{draftHint}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" autoFocus onClick={() => { setAsking(false); onSaveDraft(); }} className="btn-primary rounded-full px-5 py-2 font-bold">Save draft</button>
                <button type="button" onClick={() => { setAsking(false); onDiscard(); }} className="rounded-full px-4 py-2 font-bold text-berry ring-1 ring-line hover:ring-berry">Discard</button>
                <button type="button" onClick={() => setAsking(false)} className="ml-auto rounded-full px-3 py-2 text-sm font-bold text-muted hover:text-ink">Keep editing</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
