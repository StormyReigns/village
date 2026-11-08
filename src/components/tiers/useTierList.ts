'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Entry } from '@/data/pages';
import { browserClient } from '@/lib/supabase/browser';
import { useVillager } from '@/components/useVillager';
import { EMPTY_LIST, countsByCard, fromPlacements, placedCount, readList, tidy, toPieces, type Counts, type MyList, type Tier } from '@/lib/tiers';

// One Tier list Block's data (docs/blocks/tier-lists.md): the community's counts and your lists.
// - Your main list (the Block's reason, "MVP"): on this device, and in your account when signed in.
//   It counts toward Community only once you submit it; later edits count once you submit again.
// - Your unique lists, each with its own title: in your account, never counted, shareable.
// Row-level security and the database functions decide what's allowed
// (20261109000000_tier_lists.sql, 20261109120000_tier_lists_submit.sql).

type Row = Record<string, unknown>;
export type TierState = 'loading' | 'ready' | 'missing' | 'offline';
export type SaveState = 'device' | 'saving' | 'saved' | 'error';

/** 'main' is your list for the Block's reason; anything else is a unique list's id. */
export type ListKey = 'main' | string;

export interface UniqueList { id: string; title: string; shared: boolean; list: MyList }

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

/** Two lists are the same when every tier holds the same pieces in the same order, with the same reasons. */
export function sameList(a: MyList, b: MyList, tiers: Tier[]) {
  const norm = (l: MyList) => JSON.stringify(tiers.map((t) => (l.rows[t.key] ?? []).map((id) => [id, l.reasons[id]?.trim() || ''])));
  return norm(a) === norm(b);
}

const deviceKey = (gameId: string, block: string) => `village:${gameId}:tiers:${block}`;

export function useTierList(gameId: string, blockKey: string, entries: Entry[], tiers: Tier[]) {
  const me = useVillager();
  const [counts, setCounts] = useState<Map<string, Counts>>(new Map());
  const [state, setState] = useState<TierState>('loading');
  const [total, setTotal] = useState(0);
  const [main, setMain] = useState<MyList>(EMPTY_LIST);
  const [mainId, setMainId] = useState<string | null>(null);
  const [mainShared, setMainShared] = useState(false);
  const [submitted, setSubmitted] = useState<{ list: MyList; at: string } | null>(null);
  const [uniques, setUniques] = useState<UniqueList[]>([]);
  const [active, setActive] = useState<ListKey>('main');
  const [save, setSave] = useState<SaveState>('device');
  const [error, setError] = useState<string | null>(null);

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

  // Your main list on this device, read once after the page loads.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
      setMain(tidy(readList(localStorage.getItem(deviceKey(gameId, blockKey))), ids, tiers));
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tiers by their keys
  }, [gameId, blockKey, ids, tiersKey]);

  const pending = useRef<{ key: ListKey; timer: ReturnType<typeof setTimeout> } | null>(null);
  const latest = useRef<{ main: MyList; uniques: UniqueList[] }>({ main, uniques });
  useEffect(() => { latest.current = { main, uniques }; });

  /** Sends one whole list to your account. */
  const push = useCallback(async (key: ListKey, l: MyList) => {
    const db = browserClient();
    if (!db || !me) return;
    setSave('saving');
    const args: Record<string, unknown> = { g: gameId, b: blockKey, pieces: toPieces(l, tiers, (id) => cardOf.get(id)) };
    if (key !== 'main') args.l = key;
    const { data, error: err } = await db.rpc('save_tier_list', args);
    if (err) { setSave('error'); setError(tierError(err.message)); return; }
    if (key === 'main') setMainId(data as string);
    setSave('saved');
    setError(null);
  }, [me, gameId, blockKey, tiers, cardOf]);

  const flush = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    const l = p.key === 'main' ? latest.current.main : latest.current.uniques.find((u) => u.id === p.key)?.list;
    if (l) await push(p.key, l);
  }, [push]);

  // Signed in: read all your lists. Your account's main list wins; one made on this device before
  // signing in is sent up.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (!me?.id || state === 'missing' || linked.current === me.id) return;
    const db = browserClient();
    if (!db) return;
    linked.current = me.id;
    (async () => {
      const heads = await db.from('tier_lists').select('id, kind, title, shared, submitted_at').eq('game_id', gameId).eq('block_key', blockKey).eq('profile_id', me.id);
      if (heads.error) { linked.current = null; return; }
      const rows = (heads.data ?? []) as Row[];
      const p = rows.length ? await db.from('tier_placements').select('list_id, card_id, tier_key, position, reason').in('list_id', rows.map((r) => r.id as string)) : { data: [] };
      const placements = (p.data ?? []) as { list_id: string; card_id: string; tier_key: string; position: number; reason: string | null }[];
      const listOf = (id: string) => fromPlacements(placements.filter((x) => x.list_id === id), (c) => idOf.get(c));
      const mainRow = rows.find((r) => r.kind === 'main');
      const subRow = rows.find((r) => r.kind === 'submitted');
      setMainShared(Boolean(mainRow?.shared));
      setSubmitted(subRow ? { list: listOf(subRow.id as string), at: subRow.submitted_at as string } : null);
      setUniques(rows.filter((r) => r.kind === 'unique').map((r) => ({ id: r.id as string, title: r.title as string, shared: Boolean(r.shared), list: listOf(r.id as string) })));
      const saved = mainRow ? listOf(mainRow.id as string) : EMPTY_LIST;
      if (mainRow) setMainId(mainRow.id as string);
      if (placedCount(saved)) {
        setMain(saved);
        try { localStorage.setItem(deviceKey(gameId, blockKey), JSON.stringify(saved)); } catch { /* storage unavailable */ }
        setSave('saved');
      } else if (placedCount(latest.current.main)) {
        push('main', latest.current.main);
      } else setSave('saved');
    })().catch(() => { linked.current = null; });
  }, [me?.id, state, gameId, blockKey, idOf, push]);

  /** The list you're looking at. */
  const unique = active === 'main' ? undefined : uniques.find((u) => u.id === active);
  const list = unique?.list ?? main;

  /** Changes the list you're looking at: kept at once, sent to your account a moment after the last change. */
  const setList = useCallback((next: MyList) => {
    const key = active;
    if (key === 'main') {
      setMain(next);
      latest.current = { ...latest.current, main: next };
      try { localStorage.setItem(deviceKey(gameId, blockKey), JSON.stringify(next)); } catch { /* storage unavailable */ }
    } else {
      setUniques((us) => {
        const updated = us.map((u) => (u.id === key ? { ...u, list: next } : u));
        latest.current = { ...latest.current, uniques: updated };
        return updated;
      });
    }
    if (!me || state === 'missing') return;
    setSave('saving');
    if (pending.current && pending.current.key !== key) flush();
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { key, timer: setTimeout(() => { flush(); }, 1200) };
  }, [active, gameId, blockKey, me, state, flush]);

  // Leaving with a save still waiting: send it now.
  useEffect(() => () => { flush(); }, [flush]);

  /** Switches to another of your lists, saving the one you leave first. */
  const choose = useCallback((key: ListKey) => { flush(); setActive(key); }, [flush]);

  /** Submits your main list to the community (saving it first). */
  const submit = useCallback(async (): Promise<string | null> => {
    const db = browserClient();
    if (!db || !me) return 'Sign in to submit your list.';
    if (pending.current?.key === 'main') await flush();
    else await push('main', latest.current.main);
    const { error: err } = await db.rpc('submit_tier_list', { g: gameId, b: blockKey });
    if (err) return tierError(err.message);
    setSubmitted({ list: latest.current.main, at: new Date().toISOString() });
    loadCounts().catch(() => {});
    return null;
  }, [me, gameId, blockKey, flush, push, loadCounts]);

  /** Takes your list out of the community's. */
  const withdraw = useCallback(async (): Promise<string | null> => {
    const db = browserClient();
    if (!db || !me) return 'Sign in first.';
    const { error: err } = await db.rpc('withdraw_tier_list', { g: gameId, b: blockKey });
    if (err) return tierError(err.message);
    setSubmitted(null);
    loadCounts().catch(() => {});
    return null;
  }, [me, gameId, blockKey, loadCounts]);

  /** Starts a unique list with its own title, empty, and opens it. */
  const createUnique = useCallback(async (title: string): Promise<string | null> => {
    const db = browserClient();
    if (!db || !me) return 'Sign in to make a list of your own.';
    await flush();
    const { data, error: err } = await db.rpc('create_unique_tier_list', { g: gameId, b: blockKey, t: title });
    if (err) return tierError(err.message);
    const id = data as string;
    setUniques((us) => [...us, { id, title: title.trim().replace(/\s+/g, ' '), shared: false, list: EMPTY_LIST }]);
    setActive(id);
    return null;
  }, [me, gameId, blockKey, flush]);

  const renameUnique = useCallback(async (id: string, title: string): Promise<string | null> => {
    const db = browserClient();
    if (!db) return "Couldn't reach the village.";
    const { error: err } = await db.rpc('rename_unique_tier_list', { l: id, t: title });
    if (err) return tierError(err.message);
    setUniques((us) => us.map((u) => (u.id === id ? { ...u, title: title.trim().replace(/\s+/g, ' ') } : u)));
    return null;
  }, []);

  const deleteUnique = useCallback(async (id: string): Promise<string | null> => {
    const db = browserClient();
    if (!db) return "Couldn't reach the village.";
    if (pending.current?.key === id) { clearTimeout(pending.current.timer); pending.current = null; }
    const { error: err } = await db.from('tier_lists').delete().eq('id', id);
    if (err) return tierError(err.message);
    setUniques((us) => us.filter((u) => u.id !== id));
    setActive('main');
    return null;
  }, []);

  /** Shares the list you're looking at (saving it first): its link, with your name. Returns its id, or an error. */
  const share = useCallback(async (): Promise<{ id?: string; error?: string }> => {
    const db = browserClient();
    if (!db || !me) return { error: 'Sign in to share your list.' };
    const key = active;
    if (pending.current?.key === key) await flush();
    else if (key === 'main' && !mainId) await push('main', latest.current.main);
    const id = key === 'main' ? (mainId ?? (await db.from('tier_lists').select('id').eq('game_id', gameId).eq('block_key', blockKey).eq('profile_id', me.id).eq('kind', 'main').maybeSingle()).data?.id as string | undefined) : key;
    if (!id) return { error: 'Place a piece first.' };
    const { error: err } = await db.rpc('share_tier_list', { l: id, on_off: true });
    if (err) return { error: tierError(err.message) };
    if (key === 'main') { setMainShared(true); setMainId(id); } else setUniques((us) => us.map((u) => (u.id === id ? { ...u, shared: true } : u)));
    return { id };
  }, [me, active, mainId, gameId, blockKey, flush, push]);

  /** Makes the list you're looking at private again. */
  const unshare = useCallback(async () => {
    const db = browserClient();
    const id = active === 'main' ? mainId : active;
    if (!db || !me || !id) return;
    const { error: err } = await db.rpc('share_tier_list', { l: id, on_off: false });
    if (err) return;
    if (active === 'main') setMainShared(false); else setUniques((us) => us.map((u) => (u.id === id ? { ...u, shared: false } : u)));
  }, [me, active, mainId]);

  return {
    me, counts: byEntry, total, state, cardOf, save, error,
    // Your lists
    active, choose, list, setList, main, uniques, unique, createUnique, renameUnique, deleteUnique,
    shared: unique ? unique.shared : mainShared, listId: unique ? unique.id : mainId, share, unshare,
    // Submitting (main list only)
    submitted, changed: submitted ? !sameList(main, submitted.list, tiers) : false, submit, withdraw,
  };
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
