'use client';

import { useEffect } from 'react';

/** Turns on offline reading (public/sw.js) on the live site. Off in development, where it would
 *  keep old copies of pages being worked on. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => { /* offline reading just stays off */ });
  }, []);
  return null;
}
