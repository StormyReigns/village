'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { SheetHandle, useBeside, useSheetSize, useWideBox } from './split';

/**
 * The Workshop's chat, for editors to hop over to it. On wide screens the chat sits beside the
 * editor already; on smaller ones the editor fills the screen, so its bar gets a Chat button,
 * and the chat has a way back. The editor stays open meanwhile, nothing lost.
 */
export const EditorChat = createContext<{ count: number; open: () => void } | null>(null);

/**
 * The frame every Workshop editor shares (Set up, the entry form): the title with its main
 * action and the X pinned at the top, the editor on the Workbench (globals.css), and beside
 * it, or in a sheet below when the frame is narrow, the preview exactly as players see it, on
 * the Page's own tint. On wide screens it opens in the Workshop's work column, next to the
 * chat; on smaller ones it fills the screen. Closing with unsaved changes asks first: save a
 * draft, or discard.
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
  /** Wide frames only: more help under the preview. */
  aside?: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useSheetSize();
  const [asking, setAsking] = useState(false);
  const wide = useWideBox(dialog);
  const beside = useBeside();
  const chat = useContext(EditorChat);
  useEffect(() => { dialog.current?.focus({ preventScroll: true }); }, []);
  const close = () => (dirty ? setAsking(true) : onClose());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm md:items-center md:p-6 lg:static lg:z-auto lg:min-h-0 lg:flex-1 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
      onClick={beside ? undefined : close}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal={!beside} aria-label={label} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (asking) setAsking(false); else close(); } }}
        className="@container workbench rise relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden shadow-soft outline-none md:h-[92vh] md:rounded-[2rem] lg:h-full lg:max-w-none lg:rounded-2xl lg:shadow-none lg:ring-1 lg:ring-line">
        <div className="flex shrink-0 items-center gap-3 px-4 py-2.5 @3xl:px-6 @3xl:pb-3 @3xl:pt-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate font-display text-xl @3xl:text-2xl">{title}</h2>
            {titleExtra}
          </div>
          {chat && (
            <button type="button" onClick={chat.open} aria-label={`Chat, ${chat.count} messages. Your edit stays open`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink lg:hidden">
              <MessageCircle size={16} aria-hidden="true" /> {chat.count}
            </button>
          )}
          {actions && <div id="entry-actions" className="shrink-0">{actions}</div>}
          <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-full bg-card ring-1 ring-line" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        {note && <div className="shrink-0 px-4 pb-1 text-sm @3xl:px-6">{note}</div>}

        {/* The editor and the preview each scroll on their own: in a narrow frame the preview is
            a sheet below, in a wide one a column on the right past a thin line. */}
        <div data-split className="flex min-h-0 flex-1 flex-col @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_23.5rem] @3xl:border-t @3xl:border-line">
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain px-4 pb-4 @3xl:px-6 @3xl:pb-6 @3xl:pt-4">
            {editor}
          </div>
          <div data-sheet className="relative z-10 flex shrink-0 flex-col rounded-t-[1.5rem] shadow-[0_-1px_0_var(--line),0_-14px_28px_-8px_rgba(21,23,28,0.38)] @3xl:block @3xl:h-auto @3xl:min-h-0 @3xl:overflow-y-auto @3xl:overscroll-contain @3xl:rounded-none @3xl:border-l @3xl:border-line @3xl:px-6 @3xl:pb-6 @3xl:pt-4 @3xl:shadow-none"
            style={wide ? undefined : { height: `${sheet}%`, background: `var(--${tint}-soft)` }}>
            <SheetHandle pct={sheet} onChange={setSheet}>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">Players see</p>
                {sheetExtra}
              </div>
            </SheetHandle>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 @3xl:mt-2 @3xl:overflow-visible @3xl:rounded-[1.5rem] @3xl:p-3"
              style={wide ? { background: `var(--${tint}-soft)` } : undefined}>
              {preview}
            </div>
            {aside && <div className="hidden gap-3 @3xl:mt-3 @3xl:grid">{aside}</div>}
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
