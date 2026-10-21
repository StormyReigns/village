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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
      if (saved) setPrefs({ ...DEFAULTS, ...saved });
    } catch { /* storage unavailable: keep defaults */ }
  }, [key]);

  const update = useCallback((patch: Partial<PlayerPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);

  return [prefs, update] as const;
}
