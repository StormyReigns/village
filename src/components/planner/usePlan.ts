'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Entry, Route } from '@/data/pages';
import { browserClient } from '@/lib/supabase/browser';
import { useVillager } from '@/components/useVillager';
import { EMPTY_PLAN, fromSaved, planKey, samePlan, tidyPlan, toSaved, type Plan } from '@/lib/planner';

// One Planner Block's plans (docs/blocks/planner.md): your party for each route, kept on this device
// for everyone and in your account when signed in (public.party_plans, written only by
// save_party_plan in 20261115000000_planner.sql). The newer copy wins when the two differ.

export type PlanSave = 'device' | 'saving' | 'saved' | 'error';

interface Kept { party: string[]; at: number }
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
  if (/slow down|party is full|twice|isn.t in this game/i.test(message)) return message.replace(/^.*?(Slow down|Your party is full|Someone)/i, '$1');
  if (/row-level security|permission/i.test(message)) return "That wasn't allowed. Try signing in again.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the village. Your party is kept on this device.";
  if (/save_party_plan|schema cache|does not exist|PGRST/i.test(message)) return 'Saving to your account isn’t switched on yet. Your party is kept on this device.';
  return message;
}

export function usePlan(gameId: string, blockKey: string, roster: Entry[], route: Route | 'all', size: number) {
  const me = useVillager();
  const key = planKey(route);
  const ids = useMemo(() => new Set(roster.map((e) => e.id)), [roster]);
  const cardOf = useMemo(() => new Map(roster.map((e) => [e.id, e.ref?.card])), [roster]);
  const idOf = useMemo(() => new Map(roster.flatMap((e) => (e.ref ? [[e.ref.card, e.id] as const] : []))), [roster]);
  const [store, setStore] = useState<Store>({});
  const [save, setSave] = useState<PlanSave>('device');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Store>({});
  useEffect(() => { latest.current = store; });

  // This device's plans, read once the page is up.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
    setStore(readDevice(gameId, blockKey));
  }, [gameId, blockKey]);

  /** Sends one route's plan to your account. */
  const push = useCallback(async (k: string, plan: Plan) => {
    const db = browserClient();
    if (!db || !me) return;
    setSave('saving');
    const { error: err } = await db.rpc('save_party_plan', { g: gameId, b: blockKey, r: k, p: toSaved(plan, (id) => cardOf.get(id)) });
    if (err) { setSave('error'); setError(planError(err.message)); return; }
    setSave('saved');
    setError(null);
  }, [me, gameId, blockKey, cardOf]);

  const pending = useRef<{ k: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const flush = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    const kept = latest.current[p.k];
    if (kept) await push(p.k, { party: kept.party });
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
      const { data, error: err } = await db.from('party_plans').select('route, plan, updated_at').eq('game_id', gameId).eq('block_key', blockKey);
      if (err) { setError(planError(err.message)); setSave('error'); return; }
      const device = readDevice(gameId, blockKey);
      const merged: Store = { ...device };
      const toSend: string[] = [];
      for (const r of (data ?? []) as { route: string; plan: unknown; updated_at: string }[]) {
        const at = Date.parse(r.updated_at) || 0;
        if (!device[r.route] || device[r.route].at <= at) merged[r.route] = { party: fromSaved(r.plan, (c) => idOf.get(c)).party, at };
      }
      for (const [k, kept] of Object.entries(device)) {
        const row = (data ?? []).find((r) => r.route === k);
        if (kept.party.length && (!row || (Date.parse(row.updated_at) || 0) < kept.at)) toSend.push(k);
      }
      setStore(merged);
      writeDevice(gameId, blockKey, merged);
      for (const k of toSend) await push(k, { party: merged[k].party });
      if (!toSend.length) setSave('saved');
    })().catch(() => { linked.current = null; });
  }, [me?.id, gameId, blockKey, idOf, roster.length, push]);

  const plan = useMemo(() => tidyPlan(store[key] ?? EMPTY_PLAN, ids, size), [store, key, ids, size]);

  /** Changes this route's plan: kept at once, sent to your account a moment after the last change. */
  const setPlan = useCallback((next: Plan) => {
    if (samePlan(next, plan)) return;
    const updated = { ...latest.current, [key]: { party: next.party, at: Date.now() } };
    latest.current = updated;
    setStore(updated);
    writeDevice(gameId, blockKey, updated);
    if (!me) return;
    setSave('saving');
    if (pending.current && pending.current.k !== key) flush();
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { k: key, timer: setTimeout(() => { flush(); }, 1000) };
  }, [plan, key, gameId, blockKey, me, flush]);

  return { plan, setPlan, save: me ? save : 'device' as PlanSave, error, signedIn: Boolean(me) };
}
