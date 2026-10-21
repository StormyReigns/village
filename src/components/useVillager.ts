'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/browser';
import { useViewAsSetting, type ViewAs } from './viewAs';

export interface Villager {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isFounder: boolean;
  /** A moderator for any game, or the whole village. */
  isModerator: boolean;
  /** Games they moderate; null means every game. */
  modGames: (string | null)[];
  /** A moderator seeing the site as a villager: their own posts are treated as someone else's. */
  practice?: boolean;
}

/**
 * Who's really signed in, if anyone. `undefined` while checking, `null` when signed out.
 * Sign-in happens in the browser, so pages stay prerendered and fast.
 */
export function useAccount(): Villager | null | undefined {
  const [villager, setVillager] = useState<Villager | null | undefined>(undefined);

  useEffect(() => {
    const db = browserClient();
    if (!db) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no database configured: signed out
      setVillager(null);
      return;
    }
    let cancelled = false;
    const load = async (user: User | null) => {
      if (!user) { if (!cancelled) setVillager(null); return; }
      const [{ data }, mods] = await Promise.all([
        db.from('profiles').select('username, display_name, is_founder, avatar_url').eq('id', user.id).maybeSingle(),
        db.from('moderators').select('game_id').eq('profile_id', user.id),
      ]);
      const meta = user.user_metadata ?? {};
      if (!cancelled) setVillager({
        id: user.id,
        username: data?.username ?? 'villager',
        displayName: data?.display_name || meta.full_name || meta.name || data?.username || 'Villager',
        avatarUrl: data?.avatar_url || meta.avatar_url,
        isFounder: Boolean(data?.is_founder),
        isModerator: Boolean(mods.data?.length),
        modGames: (mods.data ?? []).map((m) => m.game_id as string | null),
      });
    };
    db.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => { load(session?.user ?? null); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return villager;
}

/** Whether this account can use moderator powers (the Founder always can). */
export function hasPowers(v: Villager | null | undefined): v is Villager {
  return Boolean(v && (v.isModerator || v.isFounder));
}

/** Applies a moderator's "see it as" choice to their real account. */
export function seenAs(real: Villager | null | undefined, view: ViewAs): Villager | null | undefined {
  if (!hasPowers(real) || view === 'self') return real;
  if (view === 'visitor') return null;
  return { ...real, isModerator: false, modGames: [], practice: true };
}

/** Whether these moderator tools apply on this game (never while seeing the site as someone else). */
export function canModerate(v: Villager | null | undefined, gameId: string): boolean {
  return Boolean(v && !v.practice && v.modGames.some((g) => g === null || g === gameId));
}

/**
 * Who the page should treat you as. Usually your account; for a moderator using
 * "see it as", a regular villager or a signed-out visitor.
 */
export function useVillager(): Villager | null | undefined {
  const real = useAccount();
  const view = useViewAsSetting();
  return useMemo(() => seenAs(real, view), [real, view]);
}

export async function signOut() {
  await browserClient()?.auth.signOut();
}
