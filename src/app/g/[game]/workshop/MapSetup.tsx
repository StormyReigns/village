'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Info, MapPin, Undo2 } from 'lucide-react';
import type { Block, BlockMap, Entry, Page } from '@/data/pages';
import type { Villager } from '@/components/useVillager';
import { Piece } from '@/components/Piece';
import { Tip } from '@/components/Tip';
import { MapCanvas, type CanvasPin } from '@/components/world/MapCanvas';
import { mapPictureUrl, pinMark } from '@/components/world/PictureMap';
import { browserClient } from '@/lib/supabase/browser';
import { appChanged } from '@/app/actions';
import { CREDIT_MAX, MAP_MAX_SIDE, cleanSpot, mapOf, spotOf } from '@/lib/world-map';
import { EditorShell } from './EditorShell';
import { contentOf } from './EntryForm';
import { uploadPicture, type LiveDraft, type NewDraft } from './useWorkshop';

const input = 'w-full rounded-xl bg-card px-2.5 py-1.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-sky';

type Spot = { x: number; y: number };

/**
 * A Places Block's map (docs/blocks/world.md): moderators set the picture and its credit, and
 * anyone signed in places pins. Each pin is a Draft for its place (Matt), sent together with
 * "Submit". Pins not sent yet stay on this device, so the 20-Drafts-an-hour limit never loses one.
 */
export function MapSetup({ gameId, block, me, mod, drafts, postDraft, onClose }: {
  gameId: string; block: Block & { page: Page }; me: Villager | null | undefined; mod: boolean;
  drafts: LiveDraft[];
  postDraft: (d: NewDraft) => Promise<{ error?: string; id?: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const saved = mapOf(block);
  const [picture, setPicture] = useState<BlockMap | null>(saved);
  const [credit, setCredit] = useState(saved?.credit ?? '');
  const [busy, setBusy] = useState<'upload' | 'save' | 'send' | null>(null);
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);

  // Pins placed here and not sent yet, by place. Kept on the device.
  const movesKey = `village:pins:${gameId}:${block.id}`;
  const [moves, setMoves] = useState<Record<string, Spot>>(() => readMoves(movesKey));
  useEffect(() => { writeMoves(movesKey, moves); }, [movesKey, moves]);
  const [picked, setPicked] = useState<string | null>(null);

  const pictureDirty = Boolean(picture) && (picture?.picture !== saved?.picture || credit.trim() !== (saved?.credit ?? ''));
  const live = (e: Entry) => spotOf(e);
  const pending = block.entries.filter((e) => {
    const m = moves[e.id], l = live(e);
    return m && !(l && l.x === m.x && l.y === m.y);
  });
  const openPins = useMemo(() => new Set(drafts.filter((d) => d.cardId && (d.status === 'open' || d.status === 'checking') && d.blockKey === block.id).map((d) => d.cardId!)), [drafts, block.id]);

  // Places not on the map come first, then the rest, each in the Block's order.
  const places = [...block.entries].sort((a, b) => Number(Boolean(moves[a.id] ?? live(a))) - Number(Boolean(moves[b.id] ?? live(b))));
  const unplaced = places.filter((e) => !moves[e.id] && !live(e)).length;
  const pick = picked ? block.entries.find((e) => e.id === picked) : undefined;

  const pins: CanvasPin[] = block.entries.flatMap((e) => {
    const s = moves[e.id] ?? live(e);
    return s ? [{ id: e.id, ...s, name: e.name, mark: pinMark(e, block), done: !moves[e.id], ring: Boolean(moves[e.id]) }] : [];
  });
  const pickSpot = pick ? moves[pick.id] ?? live(pick) : null;

  const upload = async (f: File) => {
    if (!me) { setNote('Sign in first.'); return; }
    setBusy('upload');
    const res = await uploadPicture('map-pictures', gameId, me.id, f, MAP_MAX_SIDE);
    setBusy(null);
    if (typeof res === 'string') { setNote(res); return; }
    if (!res.w || !res.h) { setNote("That picture couldn't be read. Try a PNG, JPEG or WebP."); return; }
    setPicture({ picture: res.path, w: res.w, h: res.h });
    setNote(saved ? 'New picture ready. Pins keep their place as a share of the picture, so use one of the same area. Save map to use it.' : 'Picture ready. Save map to use it.');
  };

  const saveMap = async () => {
    const db = browserClient();
    if (!db || !picture) return;
    setBusy('save');
    const value: BlockMap = { picture: picture.picture, w: picture.w, h: picture.h, ...(credit.trim() ? { credit: credit.trim().slice(0, CREDIT_MAX) } : {}) };
    const { error } = await db.from('game_blocks').update({ map: value }).eq('game_id', gameId).eq('block_key', block.id);
    if (!error) { await appChanged(gameId); router.refresh(); }
    setBusy(null);
    setNote(error ? (/column/i.test(error.message) ? 'Maps are almost ready: the database needs one more update.' : `Couldn't save: ${error.message}`) : 'Saved. The app shows the map now.');
  };

  const place = (spot: Spot) => {
    if (!pick) { setNote('Pick a place in the list first, then tap where it is.'); return; }
    const s = cleanSpot(spot);
    if (s) setMoves({ ...moves, [pick.id]: s });
    setNote('');
  };
  const undo = (id: string) => { const next = { ...moves }; delete next[id]; setMoves(next); };

  const send = async () => {
    if (!me) { setNote('Sign in to send pins.'); return; }
    setBusy('send');
    let sent = 0, problem = '';
    const left = { ...moves };
    for (const e of pending) {
      if (!e.ref) { problem = `${e.name} isn't in the database yet.`; break; }
      const res = await postDraft({
        blockKey: block.id, kind: 'fact', title: e.name, content: { ...contentOf(e), spot: moves[e.id] }, source: '', theory: false,
        cardId: e.ref.card, baseRevision: e.ref.revision,
      });
      if (res.error) { problem = res.error; break; }
      delete left[e.id];
      sent++;
    }
    // Moves that match the app already need nothing.
    for (const e of block.entries) { const l = live(e), m = left[e.id]; if (m && l && l.x === m.x && l.y === m.y) delete left[e.id]; }
    setMoves(left);
    setBusy(null);
    const waiting = Object.keys(left).length;
    setNote([sent ? `${sent} pin${sent === 1 ? '' : 's'} sent as Drafts for votes.` : '', problem, waiting ? `${waiting} wait on this device: send them later.` : ''].filter(Boolean).join(' '));
  };

  const src = picture ? mapPictureUrl(picture.picture) : '';

  return (
    <EditorShell
      label={`Map of ${block.title}`}
      title={`Map: ${block.title}`}
      titleExtra={
        <Tip text="Pick a place, then tap where it is on the map. Each pin goes in as a Draft for its place, voted like any fix. Pins you haven't sent stay on this device.">
          <button type="button" aria-label="How placing pins works" className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
            <Info size={17} aria-hidden="true" />
          </button>
        </Tip>
      }
      actions={
        <button type="button" onClick={send} disabled={!pending.length || busy !== null} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
          {busy === 'send' ? 'Sending…' : pending.length ? `Submit ${pending.length} pin${pending.length === 1 ? '' : 's'}` : 'Submit pins'}
        </button>
      }
      note={note && <p role="status" className={/^(Saved|Picture ready|New picture|\d+ pins? sent)/.test(note) && !/wait|isn't|Slow|Couldn't/.test(note) ? 'text-leaf' : 'text-berry'}>{note}</p>}
      onClose={onClose}
      dirty={pictureDirty}
      onSaveDraft={onClose}
      onDiscard={() => { setPicture(saved); setCredit(saved?.credit ?? ''); onClose(); }}
      draftHint="Your pins stay on this device either way. Save draft closes; Discard throws away the new picture."
      tint={block.page.tint}
      editor={
        <div className="grid gap-4">
          {/* The picture: moderators set it, like a Block's setup. */}
          <section className="grid gap-2 rounded-2xl bg-card p-3 ring-1 ring-line">
            <h3 className="font-bold">Map picture</h3>
            {mod ? (
              <>
                <p className="text-sm text-muted">Any picture of the world: the game&apos;s map, or one drawn by the community. Big is good: players zoom in.</p>
                <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => file.current?.click()} disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink disabled:opacity-60">
                    <ImagePlus size={15} aria-hidden="true" /> {busy === 'upload' ? 'Uploading…' : picture ? 'Replace picture' : 'Upload a picture'}
                  </button>
                  {picture && <span className="text-xs text-muted">{picture.w} × {picture.h}</span>}
                </div>
                <label className="grid gap-1">
                  <span className="text-sm font-bold">Credit</span>
                  <input value={credit} maxLength={CREDIT_MAX} onChange={(e) => setCredit(e.target.value)} placeholder="Map: Game8, or Drawn by stormyreigns" className={input} />
                  <span className="text-xs text-muted">Shown small under the map. Say where the picture comes from.</span>
                </label>
                {pictureDirty && (
                  <button type="button" onClick={saveMap} disabled={busy !== null} className="btn-primary w-fit rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">{busy === 'save' ? 'Saving…' : 'Save map'}</button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">{saved ? `Set by the moderators${saved.credit ? ` · ${saved.credit}` : ''}.` : 'A moderator adds the map picture first. Ask in the chat.'}</p>
            )}
          </section>

          {/* The pins: one per place. */}
          {picture && (
            <section className="grid gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold">Places</h3>
                <span className="text-xs text-muted">{unplaced ? `${unplaced} not on the map yet` : 'Every place is on the map'}</span>
              </div>
              {!me && <p className="rounded-xl bg-card-2 px-3 py-2 text-sm text-muted">Sign in to send pins. You can try placing them first.</p>}
              <ul className="grid rounded-2xl bg-card ring-1 ring-line">
                {places.map((e) => {
                  const moved = pending.some((p) => p.id === e.id);
                  const on = Boolean(live(e));
                  const status = moved ? (on ? 'Moved · not sent' : 'Placed · not sent') : openPins.has(e.ref?.card ?? '') ? 'A Draft is open' : on ? 'On the map' : 'Not on the map';
                  return (
                    <li key={e.id} className="flex items-center gap-2 border-t border-line px-2 py-1.5 first:border-t-0">
                      <button type="button" onClick={() => setPicked(e.id === picked ? null : e.id)} aria-pressed={e.id === picked}
                        className={'flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1 text-left ' + (e.id === picked ? 'bg-signal' : 'hover:bg-card-2')}>
                        <Piece size={30} color={`var(--${block.page.tint})`} outline={!on && !moved}>
                          <span className={'text-[9px] font-black ' + (on || moved ? 'text-white' : 'text-ink')}>{pinMark(e, block)}</span>
                        </Piece>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{e.name}{e.spoiler ? ' · spoiler' : ''}</span>
                          <span className={'block text-xs ' + (moved ? 'font-bold text-ink' : 'text-muted')}>{status}</span>
                        </span>
                        {e.id === picked && <span className="hidden shrink-0 text-xs font-bold sm:inline">Tap the map</span>}
                      </button>
                      {moved && (
                        <button type="button" onClick={() => undo(e.id)} aria-label={`Undo the pin for ${e.name}`} title="Undo"
                          className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><Undo2 size={15} aria-hidden="true" /></button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      }
      preview={picture ? (
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <MapPin size={15} aria-hidden="true" />
            {pick ? <>Tap the map to put <span className="rounded bg-signal px-1">{pick.name}</span> there</> : 'Pick a place, then tap the map'}
          </p>
          <MapCanvas src={src} pic={picture} alt={`Map of ${block.title}`} pins={pins} selected={picked} tint={block.page.tint}
            onPin={(id) => setPicked(id)} onSpot={place} credit={credit.trim() || undefined}
            focus={pick && pickSpot ? { ...pickSpot, key: pick.id } : null} frameClass="h-[min(70dvh,40rem)]" />
        </div>
      ) : (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted ring-1 ring-line">The map shows here once it has a picture. Until then players see the region tiles.</p>
      )}
    />
  );
}

function readMoves(key: string): Record<string, Spot> {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(v).flatMap(([k, s]) => { const c = cleanSpot(s); return c ? [[k, c]] : []; }));
  } catch { return {}; }
}
function writeMoves(key: string, m: Record<string, Spot>) {
  try { if (Object.keys(m).length) localStorage.setItem(key, JSON.stringify(m)); else localStorage.removeItem(key); } catch { /* private mode */ }
}
