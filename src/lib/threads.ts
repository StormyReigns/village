// Chat threads (docs/chat.md): every game has one chat, and each thing being built (an
// entry like Eshmel, a Block's setup) has a thread in it. A thread is named by a key for the
// thing itself, never its name, so renames don't break it:
//   card:<uuid>         an entry in the app
//   draft:<uuid>        a new entry's Draft, until it's published and gets a card
//   block:<block id>    a Block's setup
//   entry:<block>.<id>  an entry that isn't in the database yet
// Messages from before threads (a Draft's "Discuss") have no key, only the Draft they're
// about, and land in that Draft's thread.

export type ThreadKey = string;

interface DraftLike { id: string; cardId: string | null }
interface MessageLike {
  id: number; threadKey: string | null; draftId: string | null; createdAt: string;
  /** System notes (written by the database) aren't talk: see buildStream. */
  kind?: 'chat' | 'system'; event?: { type: string } | null;
}

export const entryThread = (blockId: string, entry: { id: string; ref?: { card: string } }): ThreadKey =>
  entry.ref ? `card:${entry.ref.card}` : `entry:${blockId}.${entry.id}`;

export const draftThread = (d: DraftLike): ThreadKey => (d.cardId ? `card:${d.cardId}` : `draft:${d.id}`);

export const blockThread = (blockId: string): ThreadKey => `block:${blockId}`;

/** A new entry's thread moves to its card once the Draft is published. */
export function resolveThread(key: ThreadKey, drafts: Map<string, DraftLike>): ThreadKey {
  if (!key.startsWith('draft:')) return key;
  const d = drafts.get(key.slice(6));
  return d ? draftThread(d) : key;
}

/** Which thread a message is in, or null for a message to the whole game. */
export function threadOf(m: MessageLike, drafts: Map<string, DraftLike>): ThreadKey | null {
  if (m.threadKey) return resolveThread(m.threadKey, drafts);
  if (m.draftId) return resolveThread(`draft:${m.draftId}`, drafts);
  return null;
}

/**
 * The game's chat as it reads: messages to everyone, and one card per thread, placed where
 * its newest message is, so a thread that's talking moves down to the latest spot. System
 * notes stay out of the cards: something published shows as its own one-line notice (the
 * detail is in the thread), and other notes (a decline) show only in the thread.
 */
export type StreamItem<M> =
  | { kind: 'message'; m: M }
  | { kind: 'system'; m: M }
  | { kind: 'thread'; key: ThreadKey; messages: M[]; at: string };

export function buildStream<M extends MessageLike>(messages: M[], drafts: Map<string, DraftLike>): StreamItem<M>[] {
  const threads = new Map<ThreadKey, M[]>();
  const items: StreamItem<M>[] = [];
  for (const m of messages) {
    if (m.kind === 'system') {
      if (m.event?.type === 'published') items.push({ kind: 'system', m });
      continue;
    }
    const key = threadOf(m, drafts);
    if (!key) { items.push({ kind: 'message', m }); continue; }
    const list = threads.get(key);
    if (list) list.push(m);
    else threads.set(key, [m]);
  }
  for (const [key, list] of threads) items.push({ kind: 'thread', key, messages: list, at: list.at(-1)!.createdAt });
  const last = (x: StreamItem<M>) => (x.kind === 'thread' ? x.messages.at(-1)! : x.m);
  return items.sort((a, b) => last(a).createdAt.localeCompare(last(b).createdAt) || last(a).id - last(b).id);
}
