'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ImagePlus, Info, MapPin, MapPinOff, Maximize2, Search, Undo2 } from 'lucide-react';
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
import type { NewBatch } from './useBatches';

const input = 'w-full rounded-xl bg-card px-2.5 py-1.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-sky';

type Spot = { x: number; y: number };
/** A change not sent yet: a new spot, or null to take the place off the map. */
type Move = Spot | null;
const same = (a: Spot | null | undefined, b: Spot | null | undefined) => (a ?? null) === (b ?? null) || Boolean(a && b && a.x === b.x && a.y === b.y);
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * A Places Block's map (docs/blocks/world.md): moderators set the picture and its credit, and
 * anyone signed in places pins. Each pin is a Draft for its place (Matt), sent together with
 * "Submit": two or more go as one batch (a folder of Drafts voted on once). Pins not sent yet
 * stay on this device.
 */
export function MapSetup({ gameId, block, me, mod, drafts, postDraft, sendBatch, onBatch, onClose }: {
  gameId: string; block: Block & { page: Page }; me: Villager | null | undefined; mod: boolean;
  drafts: LiveDraft[];
  postDraft: (d: NewDraft) => Promise<{ error?: string; id?: string }>;
  sendBatch: (b: NewBatch) => Promise<{ id?: string; error?: string }>;
  /** Everything went as one batch: show it in Drafts. */
  onBatch: (id: string) => void;
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
  const [moves, setMoves] = useState<Record<string, Move>>(() => readMoves(movesKey));
  useEffect(() => { writeMoves(movesKey, moves); }, [movesKey, moves]);
  const live = (e: Entry) => spotOf(e);
  /** Where a place's pin is here: its change not sent yet, else the app's. */
  const spotHere = (e: Entry): Spot | null => (e.id in moves ? moves[e.id] : live(e) ?? null);
  // A to Z, and it stays put while you place pins, so a place is always where you last saw it.
  const places = useMemo(() => [...block.entries].sort((a, b) => byName.compare(a.name, b.name)), [block.entries]);
  // Starts on the first place not on the map yet, so placing begins with one tap on the map.
  const [picked, setPicked] = useState<string | null>(() => places.find((e) => !(e.id in moves) && !spotOf(e))?.id ?? null);
  const [find, setFind] = useState('');
  // What was there before each change made here, newest last, for Undo (and Ctrl+Z).
  const [history, setHistory] = useState<{ id: string; before: Move | undefined }[]>([]);

  const pictureDirty = Boolean(picture) && (picture?.picture !== saved?.picture || credit.trim() !== (saved?.credit ?? ''));
  const pending = block.entries.filter((e) => e.id in moves && !same(moves[e.id], live(e)));
  const openPins = useMemo(() => new Set(drafts.filter((d) => d.cardId && (d.status === 'open' || d.status === 'checking') && d.blockKey === block.id).map((d) => d.cardId!)), [drafts, block.id]);

  const q = find.trim().toLowerCase();
  const region = block.filters?.[0];
  const shown = q ? places.filter((e) => e.name.toLowerCase().includes(q) || (region && e.categories[region]?.toLowerCase().includes(q))) : places;
  const unplaced = places.filter((e) => !spotHere(e)).length;
  const pick = picked ? block.entries.find((e) => e.id === picked) : undefined;

  const pins: CanvasPin[] = block.entries.flatMap((e) => {
    const s = spotHere(e);
    // Every pin in its usual yellow here; one placed or moved and not sent yet glows.
    return s ? [{ id: e.id, ...s, name: e.name, mark: pinMark(e, block), ring: e.id in moves }] : [];
  });
  const pickSpot = pick ? spotHere(pick) : null;
  const last = history.at(-1);
  const lastName = last ? block.entries.find((e) => e.id === last.id)?.name : undefined;

  /** Makes one change, remembering what it replaced so it can be undone. */
  const change = (id: string, to: Move | undefined) => {
    setHistory((h) => [...h, { id, before: moves[id] }].slice(-50));
    const next = { ...moves };
    if (to === undefined) delete next[id]; else next[id] = to;
    setMoves(next);
    return next;
  };
  const undoLast = () => {
    if (!last) return;
    const next = { ...moves };
    if (last.before === undefined) delete next[last.id]; else next[last.id] = last.before;
    setMoves(next);
    setHistory((h) => h.slice(0, -1));
    setPicked(last.id);
    setNote('');
  };
  // Ctrl+Z (Cmd+Z) undoes the last pin, unless you're typing.
  const undoRef = useRef(undoLast);
  useEffect(() => { undoRef.current = undoLast; });
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.key.toLowerCase() !== 'z') return;
      const t = ev.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      ev.preventDefault();
      undoRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  // Placing a pin moves on to the next place that isn't on the map yet, so a whole map is just
  // tap, tap, tap. Picking a place that's already on the map (to move it) doesn't move on.
  const place = (spot: Spot) => {
    if (!pick) { setNote('Pick a place in the list first, then tap where it is.'); return; }
    const s = cleanSpot(spot);
    if (!s) return;
    const wasOff = !spotHere(pick);
    const next = change(pick.id, same(s, live(pick)) ? undefined : s);
    setNote('');
    if (wasOff) {
      // The next place down the list that isn't on the map, coming round to the top.
      const at = places.findIndex((e) => e.id === pick.id);
      const off = (e: Entry) => !(e.id in next ? next[e.id] : live(e));
      const after = [...places.slice(at + 1), ...places.slice(0, at)].find(off);
      if (after) setPicked(after.id);
    }
  };
  /** Takes a place off the map (or just drops a pin that was never sent). */
  const takeOff = (e: Entry) => change(e.id, live(e) ? null : undefined);
  /** Puts a place back as it is in the app. */
  const undo = (id: string) => change(id, undefined);
  const [fullAsk, setFullAsk] = useState(0);
  // Keep the picked place in view in the full screen list.
  useEffect(() => {
    if (picked) document.querySelector(`[data-place="${CSS.escape(picked)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [picked]);
  /** The place as it would be with its pin change: the spot set, or gone. */
  const withPin = (e: Entry) => {
    const c = contentOf(e), m = moves[e.id];
    if (m) c.spot = m; else delete c.spot;
    return c;
  };
  const send = async () => {
    if (!me) { setNote('Sign in to send pins.'); return; }
    setBusy('send');
    let sent = 0, problem = '', batchId = '';
    const left = { ...moves };
    const ready = pending.filter((e) => e.ref);
    const missing = pending.find((e) => !e.ref);
    if (missing) problem = `${missing.name} isn't in the database yet.`;
    // Two or more: one batch, voted on once and published together. If batches aren't open to you
    // right now (3 a day), they go one by one instead.
    if (ready.length >= 2) {
      const res = await sendBatch({
        blockKey: block.id,
        title: `Map pins: ${ready.length} places`,
        source: (credit.trim() ? `Placed on the map (${credit.trim()})` : 'Placed on the map').slice(0, 300),
        rows: ready.map((e) => ({ content: withPin(e), card: e.ref!.card, revision: e.ref!.revision })),
      });
      if (res.id) { batchId = res.id; sent = ready.length; for (const e of ready) delete left[e.id]; }
      else if (!/batches a day|almost ready/i.test(res.error ?? '')) problem = res.error ?? "Couldn't send.";
    }
    if (!batchId && !problem) {
      for (const e of ready) {
        const res = await postDraft({
          blockKey: block.id, kind: 'fact', title: e.name, content: withPin(e), source: '', theory: false,
          cardId: e.ref!.card, baseRevision: e.ref!.revision,
        });
        if (res.error) { problem = res.error; break; }
        delete left[e.id];
        sent++;
      }
    }
    // Changes that match the app already need nothing.
    for (const e of block.entries) if (e.id in left && same(left[e.id], live(e))) delete left[e.id];
    setMoves(left);
    setHistory([]);
    setBusy(null);
    const waiting = Object.keys(left).length;
    if (batchId && !waiting) { onBatch(batchId); return; }
    setNote([sent ? (batchId ? `${sent} pins sent together as one batch for votes.` : `${sent} pin${sent === 1 ? '' : 's'} sent as Drafts for votes.`) : '', problem, waiting ? `${waiting} wait on this device: send them later.` : ''].filter(Boolean).join(' '));
  };

  /** What to do next, over the map and in the full screen tray: the picked place, then Undo. */
  const prompt = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <MapPin size={15} className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 font-bold">
        {!pick ? 'Pick a place, then tap the map'
          : pickSpot ? <><span className="rounded bg-signal px-1">{pick.name}</span> is on the map. Tap to move it</>
          : <>Tap the map to put <span className="rounded bg-signal px-1">{pick.name}</span> there</>}
      </p>
      {pick && pickSpot && (
        <button type="button" onClick={() => takeOff(pick)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-line hover:ring-ink">
          <MapPinOff size={12} aria-hidden="true" /> Take it off
        </button>
      )}
      {last && (
        <button type="button" onClick={undoLast} title="Undo (Ctrl+Z)"
          className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-line hover:ring-ink">
          <Undo2 size={12} className="shrink-0" aria-hidden="true" /> <span className="truncate">Undo{lastName ? ` ${lastName}` : ''}</span>
        </button>
      )}
    </div>
  );
  const findBox = (cls: string) => (
    <label className={'relative block ' + cls}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input type="search" value={find} onChange={(ev) => setFind(ev.target.value)} placeholder="Find a place" aria-label="Find a place"
        className="w-full rounded-full bg-card py-1.5 pl-8 pr-3 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-signal" />
    </label>
  );

  const src = picture ? mapPictureUrl(picture.picture) : '';

  return (
    <EditorShell
      label={`Map of ${block.title}`}
      title={`Map: ${block.title}`}
      titleExtra={
        <Tip text="Pick a place, then tap where it is on the map. Undo (or Ctrl+Z) takes back a slip. Submit sends your pins together as one batch, voted on like any fix. Pins you haven't sent stay on this device.">
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
              {places.length > 8 && findBox('')}
              {!shown.length && <p className="px-1 text-sm text-muted">No place matches &ldquo;{find.trim()}&rdquo;.</p>}
              <ul className="grid rounded-2xl bg-card ring-1 ring-line empty:hidden">
                {shown.map((e) => {
                  const moved = pending.some((p) => p.id === e.id);
                  const on = Boolean(spotHere(e));
                  const where = region ? e.categories[region] : '';
                  const status = moved ? (!on ? 'Coming off · not sent' : live(e) ? 'Moved · not sent' : 'Placed · not sent') : openPins.has(e.ref?.card ?? '') ? 'A Draft is open' : on ? 'On the map' : 'Not on the map';
                  return (
                    <li key={e.id} className="flex items-center gap-2 border-t border-line px-2 py-1.5 first:border-t-0">
                      <button type="button" onClick={() => setPicked(e.id === picked ? null : e.id)} aria-pressed={e.id === picked}
                        className={'flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1 text-left ' + (e.id === picked ? 'bg-signal' : 'hover:bg-card-2')}>
                        <Piece size={30} color={`var(--${block.page.tint})`} outline={!on && !moved}>
                          <span className={'text-[9px] font-black ' + (on || moved ? 'text-white' : 'text-ink')}>{pinMark(e, block)}</span>
                        </Piece>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{e.name}{e.spoiler ? ' · spoiler' : ''}</span>
                          <span className={'block truncate text-xs ' + (moved ? 'font-bold text-ink' : 'text-muted')}>{where ? `${where} · ` : ''}{status}</span>
                        </span>
                        {e.id === picked && <span className="hidden shrink-0 text-xs font-bold sm:inline">Tap the map</span>}
                      </button>
                      {moved ? (
                        <button type="button" onClick={() => undo(e.id)} aria-label={`Undo the change to ${e.name}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink"><Undo2 size={13} aria-hidden="true" /> Undo</button>
                      ) : on && (
                        <button type="button" onClick={() => takeOff(e)} aria-label={`Take ${e.name} off the map`} title="Take it off the map"
                          className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><MapPinOff size={15} aria-hidden="true" /></button>
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
          <div className="flex items-start gap-2">
            {prompt}
            <button type="button" onClick={() => setFullAsk(fullAsk + 1)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-bold ring-1 ring-line hover:ring-ink">
              <Maximize2 size={13} aria-hidden="true" /> Full screen
            </button>
          </div>
          <MapCanvas src={src} pic={picture} alt={`Map of ${block.title}`} pins={pins} selected={picked} tint={block.page.tint}
            onPin={(id) => setPicked(id)} onSpot={place} credit={credit.trim() || undefined} fullRequest={fullAsk}
            focus={pick && pickSpot ? { ...pickSpot, key: pick.id } : null} frameClass="h-[min(70dvh,40rem)]"
            tray={
              // Full screen: the places in a strip under the map, the picked one in yellow. Placing
              // a pin moves on to the next place not on the map yet.
              <div className="bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
                <div className="flex items-start gap-2">
                  {prompt}
                  <span className="shrink-0 pt-0.5 text-xs text-muted">{unplaced ? `${unplaced} left` : 'All placed'}{pending.length ? ` · ${pending.length} to submit` : ''}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {places.length > 8 && findBox('w-36 shrink-0 sm:w-52')}
                  <ul className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                  {!shown.length && <li className="py-1 text-sm text-muted">No match</li>}
                  {shown.map((e) => {
                    const on = Boolean(spotHere(e));
                    return (
                      <li key={e.id} className="shrink-0">
                        <button type="button" data-place={e.id} onClick={() => setPicked(e.id === picked ? null : e.id)} aria-pressed={e.id === picked}
                          className={'flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-bold ring-1 ' + (e.id === picked ? 'bg-signal text-ink ring-ink' : on ? 'bg-card-2 text-muted ring-line' : 'bg-card text-ink ring-ink/40')}>
                          <Piece size={24} color={`var(--${block.page.tint})`} outline={!on}>
                            {on ? <Check size={10} strokeWidth={3} className="text-white" aria-hidden="true" /> : <span className="text-[8px] font-black text-ink">{pinMark(e, block)}</span>}
                          </Piece>
                          <span className="max-w-40 truncate">{e.name}</span>
                        </button>
                      </li>
                    );
                  })}
                  </ul>
                </div>
                <p className="mt-1 text-xs text-muted">Close the map (X) when you&apos;re done, then Submit sends your pins for votes.</p>
              </div>
            } />
        </div>
      ) : (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted ring-1 ring-line">The map shows here once it has a picture. Until then players see the region tiles.</p>
      )}
    />
  );
}

function readMoves(key: string): Record<string, Move> {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(v).flatMap(([k, s]): [string, Move][] => { if (s === null) return [[k, null]]; const c = cleanSpot(s); return c ? [[k, c]] : []; }));
  } catch { return {}; }
}
function writeMoves(key: string, m: Record<string, Move>) {
  try { if (Object.keys(m).length) localStorage.setItem(key, JSON.stringify(m)); else localStorage.removeItem(key); } catch { /* private mode */ }
}
