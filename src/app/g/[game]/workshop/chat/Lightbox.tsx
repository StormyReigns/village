'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Link2, X } from 'lucide-react';

/**
 * A chat picture opened over the page, outside the chat: large on a dark backdrop, with who
 * shared it, and Download, Copy picture, Copy link (to the message) and Open full size.
 * Several pictures step with the arrows or the arrow keys. Escape, the X or a click on the
 * backdrop closes it, and focus goes back to the picture that opened it.
 */
export function Lightbox({ pictures, start, by, when, messageLink, onClose }: {
  pictures: { url: string; name: string }[];
  start: number;
  /** "Ana" */
  by: string;
  /** "Yesterday 3:42 PM" */
  when: string;
  /** The full address of the message the pictures are on. */
  messageLink: string;
  onClose: () => void;
}) {
  const [at, setAt] = useState(start);
  const [done, setDone] = useState<'' | 'picture' | 'link'>('');
  const [error, setError] = useState('');
  const close = useRef<HTMLButtonElement>(null);
  const many = pictures.length > 1;
  const pic = pictures[at];
  const canCopyPicture = typeof window !== 'undefined' && 'ClipboardItem' in window && Boolean(navigator.clipboard?.write);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; back?.focus?.({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (many && e.key === 'ArrowRight') setAt((i) => (i + 1) % pictures.length);
      else if (many && e.key === 'ArrowLeft') setAt((i) => (i - 1 + pictures.length) % pictures.length);
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [many, pictures.length, onClose]);

  const flash = (what: 'picture' | 'link') => { setDone(what); setError(''); setTimeout(() => setDone(''), 2000); };

  const download = async () => {
    try {
      const blob = await fetch(pic.url).then((r) => { if (!r.ok) throw new Error(); return r.blob(); });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = pic.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { setError("Couldn't download it. Try Open full size."); }
  };

  // The clipboard only takes PNG everywhere, so the picture is redrawn as one first.
  const copyPicture = async () => {
    try {
      const png = fetch(pic.url).then((r) => r.blob()).then(createImageBitmap).then((bitmap) => {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
        return new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error())), 'image/png'));
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      flash('picture');
    } catch { setError("Couldn't copy the picture here. Try Download."); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(messageLink); flash('link'); } catch { setError("Couldn't copy the link."); }
  };

  const tool = 'inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-paper hover:bg-white/20';
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Picture shared by ${by}`} onClick={onClose}
      className="fixed inset-0 z-[90] flex flex-col bg-ink/90 text-paper">
      <div className="flex items-center gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 flex-1 truncate text-sm"><b>{by}</b> <span className="opacity-70">· {when}{many ? ` · ${at + 1} of ${pictures.length}` : ''}</span></p>
        <button ref={close} type="button" onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a villager's picture from our own storage, any size */}
        <img src={pic.url} alt={`Picture shared by ${by}`} onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain shadow-soft" />
        {many && (
          <>
            <button type="button" aria-label="Previous picture" onClick={(e) => { e.stopPropagation(); setAt((at - 1 + pictures.length) % pictures.length); }}
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/70 hover:bg-ink">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next picture" onClick={(e) => { e.stopPropagation(); setAt((at + 1) % pictures.length); }}
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/70 hover:bg-ink">
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={download} className={tool}><Download size={16} aria-hidden="true" /> Download</button>
        {canCopyPicture && (
          <button type="button" onClick={copyPicture} className={tool}>
            {done === 'picture' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {done === 'picture' ? 'Copied' : 'Copy picture'}
          </button>
        )}
        <button type="button" onClick={copyLink} className={tool}>
          {done === 'link' ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />} {done === 'link' ? 'Link copied' : 'Copy link'}
        </button>
        <a href={pic.url} target="_blank" rel="noopener noreferrer" className={tool}><ExternalLink size={16} aria-hidden="true" /> Open full size</a>
        {error && <p role="status" className="basis-full text-center text-sm text-signal">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
