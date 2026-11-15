'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Entry, Route } from '@/data/pages';
import { browserClient } from '@/lib/supabase/browser';
import { useVillager } from '@/components/useVillager';
import { EMPTY_PLAN, fromSaved, planKey, samePlan, tidyPlan, toSaved, type BackRefs, type Known, type Plan, type Refs } from '@/lib/planner';

// One Planner Block's plans (docs/blocks/planner.md): your party for each route, kept on this device
// for everyone and in your account when signed in (public.party_plans, written only by
// save_party_plan in 20261115000000_planner.sql). The newer copy wins when the two differ.

export type PlanSave = 'device' | 'saving' | 'saved' | 'error';

interface Kept extends Plan { at: number }
type Store = Record<string, Kept>;

const deviceKey = (gameId: string, block: string) => `village:${gameId}:plan:${block}`;

function readDevice(gameId: string, block: string): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(deviceKey(gameId, block)) ?? '{}');
    return raw && typeof raw === 'object' ? raw as Store : {};
  } catch { return {}; }
}
function writeDevice(gameId: string, block: string, store: Store) {
  try { localStorage.setItem(deviceKey(gameId, block), JSON.stringify(store)); } catch { /* storage unavailable */ }
}

/** Database errors in words a player can act on. */
export function planError(message: string): string {
  if (/save your party first|sign in to share/i.test(message)) return message.replace(/^.*?(Save your party first|Sign in to share)/i, '$1');
  if (/slow down|party is full|twice|isn.t in this game/i.test(message)) return message.replace(/^.*?(Slow down|Your party is full|Someone)/i, '$1');
  if (/row-level security|permission/i.test(message)) return "That wasn't allowed. Try signing in again.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the village. Your party is kept on this device.";
  if (/save_party_plan|schema cache|does not exist|PGRST/i.test(message)) return 'Saving to your account isn’t switched on yet. Your party is kept on this device.';
  return message;
}

/** What a plan can pick from: the roster, the classes (with each one's tier) and each gear slot's items. */
export interface PlanSources {
  roster: Entry[];
  classes?: { entries: Entry[]; band: (e: Entry) => string };
  slots?: { key: string; entries: Entry[]; count: number }[];
}

export function usePlan(gameId: string, blockKey: string, sources: PlanSources, route: Route | 'all', size: number) {
  const roster = sources.roster;
  const me = useVillager();
  const key = planKey(route);
  // Entry ids and cards both ways, per Block, and what a stored plan may hold.
  const { known, refs, back } = useMemo(() => {
    const there = (es: Entry[]) => new Map(es.map((e) => [e.id, e.ref?.card]));
    const backOf = (es: Entry[]) => new Map(es.flatMap((e) => (e.ref ? [[e.ref.card, e.id] as const] : [])));
    const cls = sources.classes?.entries ?? [];
    const slots = sources.slots ?? [];
    const known: Known = {
      ids: new Set(roster.map((e) => e.id)), size,
      classBand: new Map(cls.map((e) => [e.id, sources.classes!.band(e)])),
      slots: Object.fromEntries(slots.map((s) => [s.key, { ids: new Set(s.entries.map((e) => e.id)), count: s.count }])),
    };
    const r = there(roster), rb = backOf(roster), c = there(cls), cb = backOf(cls);
    const items = Object.fromEntries(slots.map((s) => [s.key, { to: there(s.entries), from: backOf(s.entries) }]));
    const refs: Refs = { roster: (id) => r.get(id), classes: (id) => c.get(id), item: (slot, id) => items[slot]?.to.get(id) };
    const back: BackRefs = { roster: (card) => rb.get(card), classes: (card) => cb.get(card), item: (slot, card) => items[slot]?.from.get(card) };
    return { known, refs, back };
  }, [roster, sources.classes, sources.slots, size]);
  const [store, setStore] = useState<Store>({});
  // Whether this device's plans have been read yet (they can't be before the page is up).
  const [ready, setReady] = useState(false);
  const [save, setSave] = useState<PlanSave>('device');
  const [error, setError] = useState<string | null>(null);
  // Each route's saved row in the account: its id (for a shared link) and whether it's shared.
  const [rows, setRows] = useState<Record<string, { id: string; shared: boolean }>>({});
  const latest = useRef<Store>({});
  useEffect(() => { latest.current = store; });

  // This device's plans, read once the page is up.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
    setStore(readDevice(gameId, blockKey));
    setReady(true);
  }, [gameId, blockKey]);

  /** Sends one route's plan to your account. */
  const push = useCallback(async (k: string, plan: Plan) => {
    const db = browserClient();
    if (!db || !me) return;
    setSave('saving');
    const { error: err } = await db.rpc('save_party_plan', { g: gameId, b: blockKey, r: k, p: toSaved(tidyPlan(plan, known), refs) });
    if (err) { setSave('error'); setError(planError(err.message)); return; }
    setSave('saved');
    setError(null);
  }, [me, gameId, blockKey, refs, known]);

  const pending = useRef<{ k: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const flush = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    const kept = latest.current[p.k];
    if (kept) await push(p.k, kept);
  }, [push]);
  useEffect(() => () => { flush(); }, [flush]);

  // Signed in: read your account's plans once. For each route the newer copy wins; one that's newer
  // on this device (or only here) is sent up.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (!me?.id || linked.current === me.id || !roster.length) return;
    const db = browserClient();
    if (!db) return;
    linked.current = me.id;
    (async () => {
      const ask = (cols: string) => db.from('party_plans').select(cols).eq('game_id', gameId).eq('block_key', blockKey);
      let res = await ask('id, route, plan, updated_at, shared');
      // Before the sharing SQL (20261118000000_planner_share.sql) there's no shared column: read without it.
      if (res.error && /shared/i.test(res.error.message)) res = await ask('id, route, plan, updated_at');
      const { data: raw, error: err } = res;
      const data = raw as unknown as { id: string; route: string; plan: unknown; updated_at: string; shared?: boolean }[] | null;
      if (err) { setError(planError(err.message)); setSave('error'); return; }
      const device = readDevice(gameId, blockKey);
      const merged: Store = { ...device };
      const toSend: string[] = [];
      setRows(Object.fromEntries(((data ?? []) as { id: string; route: string; shared?: boolean }[]).map((r) => [r.route, { id: r.id, shared: Boolean(r.shared) }])));
      for (const r of (data ?? []) as { route: string; plan: unknown; updated_at: string }[]) {
        const at = Date.parse(r.updated_at) || 0;
        if (!device[r.route] || device[r.route].at <= at) merged[r.route] = { ...fromSaved(r.plan, back), at };
      }
      for (const [k, kept] of Object.entries(device)) {
        const row = (data ?? []).find((r) => r.route === k);
        if (kept.party.length && (!row || (Date.parse(row.updated_at) || 0) < kept.at)) toSend.push(k);
      }
      setStore(merged);
      writeDevice(gameId, blockKey, merged);
      for (const k of toSend) await push(k, merged[k]);
      if (!toSend.length) setSave('saved');
    })().catch(() => { linked.current = null; });
  }, [me?.id, gameId, blockKey, back, roster.length, push]);

  const plan = useMemo(() => tidyPlan(store[key] ?? EMPTY_PLAN, known), [store, key, known]);

  /** Changes this route's plan: kept at once, sent to your account a moment after the last change. */
  const setPlan = useCallback((next: Plan) => {
    if (samePlan(next, plan)) return;
    const updated = { ...latest.current, [key]: { ...next, at: Date.now() } };
    latest.current = updated;
    setStore(updated);
    writeDevice(gameId, blockKey, updated);
    if (!me) return;
    setSave('saving');
    if (pending.current && pending.current.k !== key) flush();
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { k: key, timer: setTimeout(() => { flush(); }, 1000) };
  }, [plan, key, gameId, blockKey, me, flush]);

  /** Shares this route's party by its link, or makes it private again (saving it first). The link's
   *  plan id, or an error in words. */
  const share = useCallback(async (on: boolean): Promise<{ id?: string; error?: string }> => {
    const db = browserClient();
    if (!db || !me) return { error: 'Sign in to share your party.' };
    if (pending.current) await flush();
    else await push(key, latest.current[key] ?? EMPTY_PLAN);
    const { data, error: err } = await db.rpc('share_party_plan', { g: gameId, b: blockKey, r: key, on_off: on });
    if (err) return { error: planError(err.message) };
    const id = data as string;
    setRows((r) => ({ ...r, [key]: { id, shared: on } }));
    return { id };
  }, [me, flush, push, key, gameId, blockKey]);

  return { plan, setPlan, ready, save: me ? save : 'device' as PlanSave, error, signedIn: Boolean(me), shared: rows[key]?.shared ? rows[key].id : null, share,
    /** Every route's plan as kept (the All view's runs). */
    all: store as Record<string, Plan> };
}
