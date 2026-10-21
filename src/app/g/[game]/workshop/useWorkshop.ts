'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import type { Villager } from '@/components/useVillager';
import type { CardContent } from '@/components/CardPreview';
import type { DraftStats } from '@/lib/standouts';

// Everything the Workshop reads and writes: chat, Drafts, votes and views, kept live
// with Supabase Realtime. Row-level security in the database decides what's allowed;
// this file only asks.

export interface Author { id: string; name: string; username: string; avatarUrl?: string | null }

export interface ChatMessage {
  id: number;
  body: string;
  blockKey: string | null;
  draftId: string | null;
  spoiler: boolean;
  createdAt: string;
  author: Author;
}

export interface LiveDraft extends DraftStats {
  blockKey: string;
  kind: 'fact' | 'opinion';
  title: string;
  content: CardContent;
  source: string | null;
  theory: boolean;
  status: string;
  author: Author;
  myVote: 0 | 1 | -1;
}

export interface NewDraft {
  blockKey: string;
  kind: 'fact' | 'opinion';
  title: string;
  content: CardContent;
  source: string;
  theory: boolean;
}

type Row = Record<string, unknown>;
const PROFILE = 'id, username, display_name, avatar_url';

function toAuthor(p: Row | null | undefined, id: string): Author {
  const username = (p?.username as string) ?? 'villager';
  return { id, username, name: (p?.display_name as string) || username, avatarUrl: (p?.avatar_url as string) ?? null };
}

function toMessage(r: Row, author: Author): ChatMessage {
  return {
    id: r.id as number, body: r.body as string, blockKey: (r.block_key as string) ?? null,
    draftId: (r.linked_draft_id as string) ?? null, spoiler: Boolean(r.spoiler), createdAt: r.created_at as string, author,
  };
}

/** Turns database errors into words a villager can act on. */
export function plainError(message: string): string {
  if (/slow down/i.test(message)) return message.replace(/^.*?(Slow down)/i, '$1');
  if (/row-level security|permission/i.test(message)) return "That wasn't allowed. Try signing in again.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the village. Check your connection and try again.";
  return message;
}

export function useWorkshop(gameId: string, me: Villager | null | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drafts, setDrafts] = useState<LiveDraft[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const authors = useRef(new Map<string, Author>());
  const meId = me?.id ?? null;
  // A moderator seeing the site as a villager can vote on their own Drafts. Those
  // votes stay in this browser: the database never lets authors vote for themselves.
  const practicing = Boolean(me?.practice);
  const [practice, setPractice] = useState<Record<string, 1 | -1>>({});
  const shownDrafts = useMemo(() => (!practicing ? drafts : drafts.map((d) => {
    const v = d.author.id === meId ? practice[d.id] : undefined;
    return v ? { ...d, ups: d.ups + (v === 1 ? 1 : 0), downs: d.downs + (v === -1 ? 1 : 0), myVote: v } : d;
  })), [drafts, practice, practicing, meId]);

  const loadDrafts = useCallback(async () => {
    const db = browserClient();
    if (!db) return;
    const [d, s, v] = await Promise.all([
      db.from('drafts')
        .select(`id, block_key, kind, title, content, source, theory, status, created_at, author_id, author:profiles!drafts_author_id_fkey(${PROFILE})`)
        .eq('game_id', gameId).neq('status', 'removed').order('created_at', { ascending: false }).limit(200),
      db.from('draft_scores').select('draft_id, ups, downs, viewers').eq('game_id', gameId),
      meId ? db.from('draft_votes').select('draft_id, value').eq('voter_id', meId) : Promise.resolve({ data: [] as Row[] }),
    ]);
    if (d.error) throw d.error;
    const scores = new Map((s.data ?? []).map((r: Row) => [r.draft_id as string, r]));
    const mine = new Map((v.data ?? []).map((r: Row) => [r.draft_id as string, r.value as number]));
    setDrafts((d.data ?? []).map((r: Row) => {
      const sc = scores.get(r.id as string);
      return {
        id: r.id as string, blockKey: r.block_key as string, kind: r.kind === 'opinion' ? 'opinion' : 'fact',
        title: r.title as string, content: (r.content ?? {}) as CardContent, source: (r.source as string) ?? null,
        theory: Boolean(r.theory), status: r.status as string, createdAt: r.created_at as string,
        author: toAuthor(r.author as Row, r.author_id as string),
        ups: Number(sc?.ups ?? 0), downs: Number(sc?.downs ?? 0), viewers: Number(sc?.viewers ?? 0),
        myVote: ((mine.get(r.id as string) ?? 0) as 0 | 1 | -1),
      };
    }));
  }, [gameId, meId]);

  const authorFor = useCallback(async (id: string): Promise<Author> => {
    const known = authors.current.get(id);
    if (known) return known;
    const { data } = await browserClient()!.from('profiles').select(PROFILE).eq('id', id).maybeSingle();
    const a = toAuthor(data, id);
    authors.current.set(id, a);
    return a;
  }, []);

  const addMessage = useCallback((m: ChatMessage) => {
    setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].sort((a, b) => a.id - b.id)));
  }, []);

  // First load, then stay live.
  useEffect(() => {
    const db = browserClient();
    if (!db) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no database on this copy of the site
      setState('offline');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await db.from('chat_messages')
          .select(`id, body, block_key, linked_draft_id, spoiler, created_at, author_id, author:profiles!chat_messages_author_id_fkey(${PROFILE})`)
          .eq('game_id', gameId).is('removed_at', null).order('id', { ascending: false }).limit(300);
        if (error) throw error;
        await loadDrafts();
        if (cancelled) return;
        setMessages((data ?? []).reverse().map((r: Row) => {
          const a = toAuthor(r.author as Row, r.author_id as string);
          authors.current.set(a.id, a);
          return toMessage(r, a);
        }));
        setState('ready');
      } catch {
        if (!cancelled) setState('offline');
      }
    })();

    let voteTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => { clearTimeout(voteTimer); voteTimer = setTimeout(() => { loadDrafts().catch(() => {}); }, 300); };
    const channel = db.channel(`workshop:${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `game_id=eq.${gameId}` }, async ({ new: r }) => {
        addMessage(toMessage(r, await authorFor(r.author_id as string)));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `game_id=eq.${gameId}` }, ({ new: r }) => {
        if (r.removed_at) setMessages((list) => list.filter((m) => m.id !== r.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drafts', filter: `game_id=eq.${gameId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_votes' }, refreshSoon)
      .subscribe();

    return () => { cancelled = true; clearTimeout(voteTimer); db.removeChannel(channel); };
  }, [gameId, loadDrafts, authorFor, addMessage]);

  /** Posts a chat message. Returns an error in plain words, or null. */
  const send = useCallback(async (body: string, opts: { blockKey?: string | null; draftId?: string | null; spoiler?: boolean } = {}) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to chat.';
    const { data, error } = await db.from('chat_messages')
      .insert({ game_id: gameId, author_id: meId, body, block_key: opts.blockKey ?? null, linked_draft_id: opts.draftId ?? null, spoiler: Boolean(opts.spoiler) })
      .select('id, body, block_key, linked_draft_id, spoiler, created_at, author_id').single();
    if (error) return plainError(error.message);
    addMessage(toMessage(data, await authorFor(meId)));
    return null;
  }, [gameId, meId, addMessage, authorFor]);

  /** Saves a Draft and credits its author. Returns an error in plain words, or null. */
  const postDraft = useCallback(async (d: NewDraft) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to post a Draft.';
    const { data, error } = await db.from('drafts')
      .insert({ game_id: gameId, block_key: d.blockKey, kind: d.kind, title: d.title, content: d.content, source: d.source || null, theory: d.theory, author_id: meId, status: 'open' })
      .select('id').single();
    if (error) return plainError(error.message);
    await db.from('draft_credits').insert({ draft_id: data.id, profile_id: meId, role: 'author' });
    await loadDrafts();
    return null;
  }, [gameId, meId, loadDrafts]);

  /** Sets your vote on a Draft: 1, -1, or 0 to take it back. */
  const vote = useCallback(async (draftId: string, value: 0 | 1 | -1) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to vote.';
    if (practicing && drafts.some((d) => d.id === draftId && d.author.id === meId)) {
      setPractice((p) => {
        const next = { ...p };
        if (value === 0) delete next[draftId];
        else next[draftId] = value;
        return next;
      });
      return null;
    }
    setDrafts((list) => list.map((d) => {
      if (d.id !== draftId) return d;
      const ups = d.ups - (d.myVote === 1 ? 1 : 0) + (value === 1 ? 1 : 0);
      const downs = d.downs - (d.myVote === -1 ? 1 : 0) + (value === -1 ? 1 : 0);
      return { ...d, ups, downs, myVote: value };
    }));
    const { error } = value === 0
      ? await db.from('draft_votes').delete().eq('draft_id', draftId).eq('voter_id', meId)
      : await db.from('draft_votes').upsert({ draft_id: draftId, voter_id: meId, value }, { onConflict: 'draft_id,voter_id' });
    await loadDrafts().catch(() => {});
    return error ? plainError(error.message) : null;
  }, [meId, loadDrafts, practicing, drafts]);

  /** Counts you as a viewer of a Draft (once a day). Standouts divides votes by viewers. */
  const view = useCallback(async (draftId: string) => {
    const db = browserClient();
    if (!db || !meId) return;
    await db.from('draft_views').upsert({ draft_id: draftId, viewer_key: meId }, { onConflict: 'draft_id,viewer_key,day', ignoreDuplicates: true });
  }, [meId]);

  return { state, messages, drafts: shownDrafts, send, postDraft, vote, view };
}
