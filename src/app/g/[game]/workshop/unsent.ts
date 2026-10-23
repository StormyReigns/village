import type { EntryContent } from '@/data/pages';

// A Draft being written is saved on this device as it's typed, so signing in partway
// (which leaves the page) or closing the form by accident doesn't lose it.

export interface Unsent {
  blockId: string;
  /** The entry being fixed, or none for a new entry. */
  entryId?: string;
  content: EntryContent;
  source: string;
  savedAt: number;
}

const key = (gameId: string) => `village:${gameId}:unsent-draft`;
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function readUnsent(gameId: string): Unsent | null {
  try {
    const u: Unsent | null = JSON.parse(localStorage.getItem(key(gameId)) ?? 'null');
    return u && Date.now() - u.savedAt < WEEK ? u : null;
  } catch {
    return null;
  }
}

export function saveUnsent(gameId: string, u: Omit<Unsent, 'savedAt'>) {
  try { localStorage.setItem(key(gameId), JSON.stringify({ ...u, savedAt: Date.now() })); } catch { /* storage unavailable */ }
}

export function clearUnsent(gameId: string) {
  try { localStorage.removeItem(key(gameId)); } catch { /* storage unavailable */ }
}

/** Anything worth keeping? An empty form isn't. */
export function hasWriting(c: EntryContent, source: string) {
  return Boolean(c.name.trim() || c.description?.trim() || c.sections.some((s) => s.text.trim()) || source.trim());
}
