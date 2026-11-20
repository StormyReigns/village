'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Route } from '@/data/content/types';

export interface PlayerPrefs {
  route: Route | 'all';
  spoilers: boolean;
}
const DEFAULTS: PlayerPrefs = { route: 'all', spoilers: false };

/** The player's route and spoiler choice for one game, remembered on this device. */
export function usePlayerPrefs(gameId: string) {
  const key = `village:${gameId}:prefs`;
  const [prefs, setPrefs] = useState<PlayerPrefs>(DEFAULTS);
  // False until this device's choice is read, so screens can wait instead of flashing "All".
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
      if (saved) setPrefs({ ...DEFAULTS, ...saved });
    } catch { /* storage unavailable: keep defaults */ }
    setReady(true);
  }, [key]);

  const update = useCallback((patch: Partial<PlayerPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);

  return [prefs, update, ready] as const;
}
