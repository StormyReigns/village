'use client';

import { useSyncExternalStore } from 'react';

/**
 * Moderator power: see the site as someone else. Kept in this browser only, so it
 * changes nothing for anyone else, and it lasts across pages until switched back.
 *   self     - you, with your moderator powers
 *   villager - a signed-in villager who isn't you (your posts look like anyone's)
 *   visitor  - someone who isn't signed in
 */
export type ViewAs = 'self' | 'villager' | 'visitor';

const KEY = 'village:view-as';
const EVENT = 'village:view-as';

function read(): ViewAs {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'villager' || v === 'visitor' ? v : 'self';
  } catch {
    return 'self';
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange); // other tabs
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener('storage', onChange); };
}

export function setViewAs(v: ViewAs) {
  try {
    if (v === 'self') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch { /* storage blocked: the switch just won't stick */ }
  window.dispatchEvent(new Event(EVENT));
}

/** The raw setting. Use useVillager() for who the page should treat you as. */
export function useViewAsSetting(): ViewAs {
  return useSyncExternalStore(subscribe, read, () => 'self');
}
