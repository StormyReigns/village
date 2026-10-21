'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/browser';

export interface Villager {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isFounder: boolean;
}

/**
 * Who's signed in, if anyone. `undefined` while checking, `null` when signed out.
 * Sign-in happens in the browser, so pages stay prerendered and fast.
 */
export function useVillager(): Villager | null | undefined {
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
      const { data } = await db.from('profiles').select('username, display_name, is_founder').eq('id', user.id).maybeSingle();
      const meta = user.user_metadata ?? {};
      if (!cancelled) setVillager({
        id: user.id,
        username: data?.username ?? 'villager',
        displayName: data?.display_name || meta.full_name || meta.name || data?.username || 'Villager',
        avatarUrl: meta.avatar_url,
        isFounder: Boolean(data?.is_founder),
      });
    };
    db.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => { load(session?.user ?? null); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return villager;
}

export async function signOut() {
  await browserClient()?.auth.signOut();
}
