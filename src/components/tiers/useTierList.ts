'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Entry } from '@/data/pages';
import { browserClient } from '@/lib/supabase/browser';
import { useVillager } from '@/components/useVillager';
import { EMPTY_LIST, countsByCard, fromPlacements, placedCount, readList, tidy, toPieces, type Counts, type MyList, type Tier } from '@/lib/tiers';

// One Tier list Block's data (docs/blocks/tier-lists.md): the community's counts, your own list
// (on this device, and in your account when signed in), saving, sharing, reasons and reports.
// Row-level security and the save function decide what's allowed (20261109000000_tier_lists.sql).

type Row = Record<string, unknown>;
export type TierState = 'loading' | 'ready' | 'missing' | 'offline';
export type SaveState = 'device' | 'saving' | 'saved' | 'error';

/** Before the Tier lists SQL is run there's nothing to read: the community tab says so. */
const missing = (e: { message?: string; code?: string } | null) =>
  Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /tier_|schema cache|does not exist/i.test(e.message ?? '')));

/** Database errors in words a player can act on. */
export function tierError(message: string): string {
  if (/slow down/i.test(message)) return message.replace(/^.*?(Slow down)/i, '$1');
  if (/row-level security|permission/i.test(message)) return "That wasn't allowed. Try signing in again.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the village. Your list is kept on this device.";
  return message;
}

const deviceKey = (gameId: string, block: string) => `village:${gameId}:tiers:${block}`;

export function useTierList(gameId: string, blockKey: string, entries: Entry[], tiers: Tier[]) {
  const me = useVillager();
  const [counts, setCounts] = useState<Map<string, Counts>>(new Map());
  const [state, setState] = useState<TierState>('loading');
  const [total, setTotal] = useState(0);
  const [list, setListState] = useState<MyList>(EMPTY_LIST);
  const [save, setSave] = useState<SaveState>('device');
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [listId, setListId] = useState<string | null>(null);

  // Entries by id and by card, for turning saved rows into a list and back.
  const cardOf = useMemo(() => new Map(entries.map((e) => [e.id, e.ref?.card])), [entries]);
  const idOf = useMemo(() => new Map(entries.flatMap((e) => (e.ref ? [[e.ref.card, e.id] as const] : []))), [entries]);
  const ids = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);
  const tiersKey = tiers.map((t) => t.key).join(',');

  /** Counts per entry id. */
  const byEntry = useMemo(() => {
    const out = new Map<string, Counts>();
    for (const [card, c] of counts) { const id = idOf.get(card); if (id) out.set(id, c); }
    return out;
  }, [counts, idOf]);

  const loadCounts = useCallback(async () => {
    const db = browserClient();
    if (!db) { setState('offline'); return; }
    const [t, n] = await Promise.all([db.rpc('tier_tallies', { g: gameId, b: blockKey }), db.rpc('tier_list_count', { g: gameId, b: blockKey })]);
    const err = t.error ?? n.error;
    if (err) { setState(missing(err) ? 'missing' : 'offline'); return; }
    setCounts(countsByCard((t.data ?? []) as { card_id: string; tier_key: string; lists: number }[]));
    setTotal((n.data as number) ?? 0);
    setState('ready');
  }, [gameId, blockKey]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading from the database once the page is up
  useEffect(() => { loadCounts().catch(() => setState('offline')); }, [loadCounts]);

  // Your list on this device, read once after the page loads.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
      setListState(tidy(readList(localStorage.getItem(deviceKey(gameId, blockKey))), ids, tiers));
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tiers by their keys
  }, [gameId, blockKey, ids, tiersKey]);

  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(list);

  /** Sends the whole list to your account. */
  const push = useCallback(async (l: MyList) => {
    const db = browserClient();
    if (!db || !me) return;
    setSave('saving');
    const { data, error: err } = await db.rpc('save_tier_list', { g: gameId, b: blockKey, pieces: toPieces(l, tiers, (id) => cardOf.get(id)) });
    if (err) { setSave('error'); setError(tierError(err.message)); return; }
    setListId(data as string);
    setSave('saved');
    setError(null);
    loadCounts().catch(() => {});
  }, [me, gameId, blockKey, tiers, cardOf, loadCounts]);

  // Signed in: your account's list wins; a list made on this device before signing in is sent up.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (!me?.id || state === 'missing' || linked.current === me.id) return;
    const db = browserClient();
    if (!db) return;
    linked.current = me.id;
    (async () => {
      const head = await db.from('tier_lists').select('id, shared').eq('game_id', gameId).eq('block_key', blockKey).eq('profile_id', me.id).maybeSingle();
      if (head.error) { linked.current = null; return; }
      const row = head.data as Row | null;
      let saved = EMPTY_LIST;
      if (row) {
        setListId(row.id as string);
        setShared(Boolean(row.shared));
        const p = await db.from('tier_placements').select('card_id, tier_key, position, reason').eq('list_id', row.id as string);
        saved = fromPlacements((p.data ?? []) as { card_id: string; tier_key: string; position: number; reason: string | null }[], (c) => idOf.get(c));
      }
      if (placedCount(saved)) {
        setListState(saved);
        try { localStorage.setItem(deviceKey(gameId, blockKey), JSON.stringify(saved)); } catch { /* storage unavailable */ }
        setSave('saved');
      } else if (placedCount(latest.current)) {
        push(latest.current);
      } else setSave('saved');
    })().catch(() => { linked.current = null; });
  }, [me?.id, state, gameId, blockKey, idOf, push]);

  /** Changes your list: kept on this device at once, sent to your account a moment after the last change. */
  const setList = useCallback((next: MyList) => {
    latest.current = next;
    setListState(next);
    try { localStorage.setItem(deviceKey(gameId, blockKey), JSON.stringify(next)); } catch { /* storage unavailable */ }
    if (!me || state === 'missing') return;
    setSave('saving');
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => { pending.current = null; push(latest.current); }, 1200);
  }, [gameId, blockKey, me, state, push]);

  // Leaving with a save still waiting: send it now.
  useEffect(() => () => { if (pending.current) { clearTimeout(pending.current); push(latest.current); } }, [push]);

  /** Shares your list (saving it first if needed). Returns its id, or an error in words. */
  const share = useCallback(async (): Promise<{ id?: string; error?: string }> => {
    const db = browserClient();
    if (!db || !me) return { error: 'Sign in to share your list.' };
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    await push(latest.current);
    const { data, error: err } = await db.rpc('share_tier_list', { g: gameId, b: blockKey, on_off: true });
    if (err) return { error: tierError(err.message) };
    setShared(true);
    setListId(data as string);
    return { id: data as string };
  }, [me, gameId, blockKey, push]);

  /** Makes a shared list private again. */
  const unshare = useCallback(async () => {
    const db = browserClient();
    if (!db || !me) return;
    const { error: err } = await db.rpc('share_tier_list', { g: gameId, b: blockKey, on_off: false });
    if (!err) setShared(false);
  }, [me, gameId, blockKey]);

  return { me, counts: byEntry, total, state, list, setList, save, error, shared, listId, share, unshare, cardOf };
}

export interface Reason { id: string; tier: string; text: string; mine: boolean }

/** Reasons people gave for one piece, newest first, without names. */
export function useReasons(gameId: string, blockKey: string, cardId: string | undefined) {
  const [reasons, setReasons] = useState<Reason[] | null>(null);
  useEffect(() => {
    const db = browserClient();
    if (!db || !cardId) return;
    let live = true;
    db.rpc('tier_reasons', { g: gameId, b: blockKey, c: cardId }).then(({ data, error }) => {
      if (!live) return;
      setReasons(error ? [] : ((data ?? []) as Row[]).map((r) => ({ id: r.id as string, tier: r.tier_key as string, text: r.reason as string, mine: Boolean(r.mine) })));
    });
    return () => { live = false; };
  }, [gameId, blockKey, cardId]);
  return reasons;
}

/** Reports a reason to the game's moderators. */
export async function reportReason(id: string, reason: string, meId: string | undefined): Promise<string | null> {
  const db = browserClient();
  if (!db || !meId) return 'Sign in to report.';
  const { error } = await db.from('flags').insert({ tier_placement_id: id, reason, reporter_id: meId });
  return error ? (/duplicate key|unique/i.test(error.message) ? 'You already reported it. A moderator will take a look.' : tierError(error.message)) : null;
}
