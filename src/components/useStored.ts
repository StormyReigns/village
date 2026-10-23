'use client';

import { useCallback, useEffect, useState } from 'react';

/** A small preference remembered on this device, like a folded panel. */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
      if (saved) setValue(JSON.parse(saved));
    } catch { /* storage unavailable: keep the default */ }
  }, [key]);
  const save = useCallback((next: T) => {
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }, [key]);
  return [value, save] as const;
}
