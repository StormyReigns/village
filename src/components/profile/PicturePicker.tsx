'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Minus, Plus, Trash2, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PROFILE_CHANGED } from '@/components/ProfileDialog';
import type { Villager } from '@/components/useVillager';
import { browserClient } from '@/lib/supabase/browser';
import { AVATAR_BUCKET } from '@/lib/avatar';

// Your profile picture, the way forums and chat apps do it: upload one and crop it to a circle,
// go back to your Discord picture, or remove it and show your initials. Pictures are redrawn
// in the browser (which also drops hidden photo details, like where it was taken) as a small
// square, and kept in the "avatars" bucket under your own folder
// (supabase/migrations/20261125000000_profile_pictures.sql).

const OUT = 400; // pixels on each side of the saved picture
const NOT_READY = 'Profile pictures are almost ready: the database needs one more update.';
const isFile = (p: string | null | undefined): p is string => Boolean(p && p !== 'none');

/** Saves the picture setting, then tidies away the file it replaced. */
async function setPicture(me: Villager, next: string | null): Promise<string | null> {
  const db = browserClient();
  if (!db) return "Couldn't reach the village.";
  const { error } = await db.from('profiles').update({ picture: next }).eq('id', me.id);
  if (error) return /picture/i.test(error.message) ? NOT_READY : error.message;
  if (isFile(me.picture) && me.picture !== next) await db.storage.from(AVATAR_BUCKET).remove([me.picture]);
  window.dispatchEvent(new Event(PROFILE_CHANGED));
  return null;
}

/** The picture, and what you can do with it. */
export function PicturePicker({ me }: { me: Villager }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = async (next: string | null, done: string) => {
    setBusy(true);
    const err = await setPicture(me, next);
    setBusy(false);
    setNote(err ? { ok: false, text: err } : { ok: true, text: done });
  };

  const usingDiscord = !me.picture && Boolean(me.discordUrl);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} aria-label="Upload a new picture"
        className="rounded-full ring-offset-2 hover:ring-2 hover:ring-ink focus-visible:ring-2 focus-visible:ring-ink">
        <Avatar name={me.displayName} url={me.avatarUrl} size={80} />
      </button>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
            <ImagePlus size={16} aria-hidden="true" /> {me.avatarUrl ? 'Change picture' : 'Upload a picture'}
          </button>
          {me.discordUrl && !usingDiscord && (
            <button type="button" disabled={busy} onClick={() => run(null, 'Using your Discord picture.')}
              className="btn-quiet rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">Use my Discord picture</button>
          )}
          {me.avatarUrl && (
            <button type="button" disabled={busy} onClick={() => run('none', 'Picture removed. Your initials show instead.')}
              className="btn-quiet inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
              <Trash2 size={15} aria-hidden="true" /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">A PNG, JPG or WebP. You can crop it next. It shows on your messages, Drafts and profile.</p>
        {note && <p role="status" className={'text-sm ' + (note.ok ? 'text-leaf' : 'text-berry')}>{note.text}</p>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setNote(null); setFile(f); } }} />
      {file && (
        <Cropper file={file} me={me} onClose={() => setFile(null)}
          onSaved={() => { setFile(null); setNote({ ok: true, text: 'Saved. Your new picture shows everywhere.' }); }} />
      )}
    </div>
  );
}

/** Drag to move the picture, zoom with the slider (or the wheel), then save the circle. */
function Cropper({ file, me, onClose, onSaved }: { file: File; me: Villager; onClose: () => void; onSaved: () => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState(280); // the frame's width on screen
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // the picture's top left, inside the frame
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Read the picture.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setError("That picture couldn't be read. Try a PNG, JPG or a screenshot.");
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const fit = () => setSize(Math.min(280, window.innerWidth - 96));
    fit();
    window.addEventListener('resize', fit);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  // The picture always covers the circle: at zoom 1 its short side fills the frame.
  const base = img ? size / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : size, h = img ? img.naturalHeight * base * zoom : size;
  const clamp = useCallback((x: number, y: number, ww = w, hh = h) => ({
    x: Math.min(0, Math.max(size - ww, x)), y: Math.min(0, Math.max(size - hh, y)),
  }), [size, w, h]);

  // Start centered, and stay inside the frame when it changes size.
  useEffect(() => {
    if (!img) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- placing the picture once it has loaded
    setPos({ x: (size - w) / 2, y: (size - h) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new picture loads or the frame resizes
  }, [img, size]);

  /** Zoom around the middle of the circle. */
  const zoomTo = (z: number) => {
    const next = Math.min(4, Math.max(1, z));
    const k = next / zoom, c = size / 2;
    const ww = w * k, hh = h * k;
    setPos(clamp(c - (c - pos.x) * k, c - (c - pos.y) * k, ww, hh));
    setZoom(next);
  };

  const save = async () => {
    if (!img) return;
    setBusy(true);
    setError('');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUT;
    const r = OUT / size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, pos.x * r, pos.y * r, w * r, h * r);
    const encode = (as: string) => new Promise<Blob | null>((done) => canvas.toBlob(done, as, 0.9));
    let blob = await encode('image/webp');
    if (blob?.type !== 'image/webp') blob = await encode('image/jpeg'); // Safari can't make WebP
    const db = browserClient();
    if (!blob || !db) { setBusy(false); setError("That picture couldn't be saved. Try another one."); return; }
    const path = `${me.id}/${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
    const up = await db.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
    if (up.error) { setBusy(false); setError(/bucket|not found/i.test(up.error.message) ? NOT_READY : up.error.message); return; }
    const err = await setPicture(me, path);
    setBusy(false);
    if (err) { await db.storage.from(AVATAR_BUCKET).remove([path]); setError(err); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Crop your picture" onClick={(e) => e.stopPropagation()}
        className="rise w-full max-w-md rounded-t-[2rem] bg-card p-6 text-ink shadow-soft sm:rounded-[2rem]">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-2xl">Crop your picture</h2>
          <button onClick={onClose} className="ml-auto grid size-9 place-items-center rounded-full bg-card-2" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div ref={frame} tabIndex={0} aria-label="Picture. Drag, or use the arrow keys, to move it"
          className="relative mx-auto touch-none select-none overflow-hidden rounded-2xl bg-card-2 outline-none focus-visible:ring-2 focus-visible:ring-ink"
          style={{ width: size, height: size, cursor: img ? 'grab' : 'default' }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp(d.px + e.clientX - d.x, d.py + e.clientY - d.y)); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onWheel={(e) => zoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 30 : 8;
            const move = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
            if (move) { e.preventDefault(); setPos(clamp(pos.x + move[0], pos.y + move[1])); }
          }}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element -- a local picture being cropped
            <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
              style={{ left: pos.x, top: pos.y, width: w, height: h }} />
          )}
          {/* The circle that will be kept; outside it is dimmed. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 9999px rgb(21 23 28 / 0.55)', outline: '2px solid white', outlineOffset: -2 }} />
          {!img && !error && <span className="absolute inset-0 animate-pulse" />}
        </div>
        <label className="mx-auto mt-4 flex max-w-72 items-center gap-3">
          <Minus size={16} className="text-muted" aria-hidden="true" />
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => zoomTo(Number(e.target.value))}
            aria-label="Zoom" className="min-w-0 flex-1 accent-[var(--ink)]" />
          <Plus size={16} className="text-muted" aria-hidden="true" />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-berry">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-quiet rounded-full px-4 py-2 text-sm font-bold">Cancel</button>
          <button onClick={save} disabled={!img || busy} className="btn-primary rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">
            {busy ? 'Saving…' : 'Save picture'}
          </button>
        </div>
      </div>
    </div>
  );
}
