'use client';

import { useSyncExternalStore } from 'react';

// The one video playing right now (docs/blocks/videos.md, "Pop out"). One player for the whole
// site, kept in VideoDock (the root layout), so it keeps playing while you scroll, open another
// Page or close the entry panel: a YouTube player restarts if it's moved in the page, so it
// never moves. It only sits over its spot on the entry (a "slot") or in a corner.
//
//   inline  over its slot, in place on the entry
//   auto    in the corner because its slot scrolled away, closed or got covered; it goes back
//           by itself when the slot is in view again
//   pinned  in the corner because you tapped "Pop out"; it stays until Back or X

export interface Playing {
  /** The video's id in Village (one entry's video). */
  id: string;
  youtubeId: string;
  start: number;
  title: string;
  /** The address it started on, for Back once you've left that Page. */
  where: string;
}

export type DockMode = 'inline' | 'auto' | 'pinned';

export interface DockState {
  now: Playing | null;
  mode: DockMode;
  /** The spots on entries showing this video, newest last; the newest one is used. */
  slots: HTMLElement[];
  /** Whether VideoDock is on the page. Without it a video plays in place, as before. */
  host: boolean;
  /** Scroll to the slot once it shows up (Back after leaving its Page). */
  seek: boolean;
}

let state: DockState = { now: null, mode: 'inline', slots: [], host: false, seek: false };
const listeners = new Set<() => void>();

function set(patch: Partial<DockState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const server: DockState = { now: null, mode: 'inline', slots: [], host: false, seek: false };

export const dockState = () => state;
export const useDock = () => useSyncExternalStore(subscribe, dockState, () => server);

/** Plays a video in place, replacing whatever was playing. */
export function play(v: Omit<Playing, 'where'>) {
  set({ now: { ...v, where: window.location.pathname + window.location.search }, mode: 'inline', seek: false });
}

/** Stops the video. */
export function stop() { set({ now: null, mode: 'inline', seek: false }); }

export function setMode(mode: DockMode) { if (state.mode !== mode) set({ mode }); }
export function setSeek(seek: boolean) { if (state.seek !== seek) set({ seek }); }
export function setHost(host: boolean) { set({ host }); }

/** A spot on an entry where the playing video sits when it's in place. */
export function addSlot(el: HTMLElement) {
  if (!state.slots.includes(el)) set({ slots: [...state.slots, el] });
}
export function removeSlot(el: HTMLElement) {
  if (state.slots.includes(el)) set({ slots: state.slots.filter((s) => s !== el) });
}

/** The slot in use: the newest one still on the page. */
export const activeSlot = (s: DockState) => [...s.slots].reverse().find((el) => el.isConnected) ?? null;
