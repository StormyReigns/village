'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { missingTable } from '@/lib/questions';
import { mentionsIn, plainRefs } from '@/lib/refs';
import { GAMES } from '@/data/games';
import { INBOX_COLUMNS, toInboxItem, type InboxContext, type InboxItem, type Plain } from '@/lib/inbox';
import { useVillager } from '../useVillager';

type Row = Record<string, unknown>;
const GAME_NAMES = new Map(GAMES.map((g) => [g.id, g.shortTitle]));
const emptyCtx = (): InboxContext => ({ questions: new Map(), messages: new Map(), people: new Map(), games: GAME_NAMES });

/**
 * Your inbox, kept live: the newest `size` items, and what's needed to describe them (the words of
 * questions and messages, people's names). `items` is null while signed out, or before the inbox
 * SQL has been run. The bell and the inbox page each use one.
 */
export function useInbox(size: number) {
  const me = useVillager();
  const meId = me?.id ?? null;
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [ctx, setCtx] = useState<InboxContext>(emptyCtx);
  // True when there may be older items than the ones loaded.
  const [more, setMore] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cleared but not deleted yet (there's a moment to undo): a reload mustn't bring them back.
  const hidden = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    const db = browserClient();
    if (!db || !meId) { setItems(null); return; }
    const { data, error } = await db.from('inbox').select(INBOX_COLUMNS)
      .eq('profile_id', meId).order('created_at', { ascending: false }).limit(size + 1);
    if (error) { if (missingTable(error)) setItems(null); return; }
    const rows = ((data ?? []) as Row[]).map(toInboxItem).filter((x) => !hidden.current.has(x.id));
    const list = rows.slice(0, size);
    setMore(rows.length > size);
    setItems(list);

    // What the items point at. Inbox items carry ids, not words, so removed things don't linger.
    const ids = (type: string, key: string) => [...new Set(list.filter((x) => x.type === type && x.payload[key] != null).map((x) => String(x.payload[key])))];
    const questionIds = ids('question_answered', 'question');
    const messageIds = [...ids('mention', 'message'), ...ids('draft_activity', 'message')].map(Number).filter(Boolean);
    const [q, m] = await Promise.all([
      questionIds.length ? db.from('questions').select('id, body, spoiler, reply').in('id', questionIds) : null,
      messageIds.length ? db.from('chat_messages').select('id, body, spoiler').in('id', messageIds) : null,
    ]);
    const next = emptyCtx();
    for (const r of (q?.data ?? []) as Row[]) next.questions.set(r.id as string, { body: r.body as string, spoiler: Boolean(r.spoiler), reply: (r.reply as string) ?? null });
    for (const r of (m?.data ?? []) as Row[]) next.messages.set(Number(r.id), { body: r.body as string, spoiler: Boolean(r.spoiler) });
    // Names: whoever the items are from, and anyone a quoted message mentions.
    const people = new Set<string>();
    for (const x of list) if (typeof x.payload.by === 'string') people.add(x.payload.by);
    for (const v of next.messages.values()) for (const id of mentionsIn(v.body)) people.add(id);
    if (people.size) {
      const p = await db.from('profiles').select('id, username, display_name').in('id', [...people]);
      for (const r of (p.data ?? []) as Row[]) next.people.set(r.id as string, (r.display_name as string) || (r.username as string));
    }
    setCtx(next);
  }, [meId, size]);

  useEffect(() => {
    const db = browserClient();
    if (!db || !meId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- signed out: no inbox
      setItems(null);
      return;
    }
    load().catch(() => {});
    // New items, and activity counting up on one (an update), both reload. Marking a batch read
    // sends many updates at once, so reloads wait a moment and run once.
    const soon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { load().catch(() => {}); }, 400);
    };
    const ch = db.channel(`inbox:${meId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbox', filter: `profile_id=eq.${meId}` }, soon)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inbox', filter: `profile_id=eq.${meId}` }, soon)
      .subscribe();
    return () => { db.removeChannel(ch); if (timer.current) clearTimeout(timer.current); };
  }, [meId, load]);

  /** Marks everything unread as read. Returns the ids that were unread. */
  const markAllRead = useCallback(async () => {
    const unread = items?.filter((x) => !x.readAt).map((x) => x.id) ?? [];
    if (!unread.length || !meId) return unread;
    const now = new Date().toISOString();
    setItems((list) => list?.map((x) => (x.readAt ? x : { ...x, readAt: now })) ?? list);
    await browserClient()?.from('inbox').update({ read_at: now }).eq('profile_id', meId).is('read_at', null);
    return unread;
  }, [items, meId]);

  /** Marks these items read. */
  const markRead = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString(), set = new Set(ids);
    setItems((list) => list?.map((x) => (set.has(x.id) && !x.readAt ? { ...x, readAt: now } : x)) ?? list);
    await browserClient()?.from('inbox').update({ read_at: now }).in('id', ids).is('read_at', null);
  }, []);

  const setRead = useCallback(async (id: number, read: boolean) => {
    const at = read ? new Date().toISOString() : null;
    setItems((list) => list?.map((x) => (x.id === id ? { ...x, readAt: at } : x)) ?? list);
    await browserClient()?.from('inbox').update({ read_at: at }).eq('id', id);
  }, []);

  /** Takes an item out of the list now; `commit` deletes it for good, `undo` puts it back. */
  const hide = useCallback((id: number) => {
    const kept = items?.find((x) => x.id === id);
    hidden.current.add(id);
    setItems((list) => list?.filter((x) => x.id !== id) ?? list);
    return {
      commit: async () => { await browserClient()?.from('inbox').delete().eq('id', id); },
      undo: () => {
        hidden.current.delete(id);
        setItems((list) => (list && kept ? [...list, kept].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : list));
      },
    };
  }, [items]);

  /** A message's words as plain text, with #references and @mentions as names. */
  const plain: Plain = useCallback((body: string) =>
    plainRefs(body, (r) => r.key.split('.').pop()!.replace(/[-_]+/g, ' '), (id) => ctx.people.get(id) ?? 'someone').replace(/\s+/g, ' ').trim(), [ctx]);

  return { me, items, ctx, more, plain, markAllRead, markRead, setRead, hide, reload: load };
}
