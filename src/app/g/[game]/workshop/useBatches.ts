'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/browser';
import type { EntryContent } from '@/data/pages';
import { appChanged } from '@/app/actions';
import { plainError, type Author } from './useWorkshop';

// Batches: rows pasted from a spreadsheet, reviewed together (docs/blocks/spreadsheets.md, level
// 2; the database side is 20261112000000_draft_batches.sql). Each row is an ordinary Draft; the
// batch is the folder people vote on once and moderators publish in one go. Kept apart from
// useWorkshop so the Workshop's main hook stays as it was.

type Row = Record<string, unknown>;

export interface Batch {
  id: string;
  blockKey: string;
  title: string;
  source: string;
  status: 'open' | 'stable' | 'declined' | 'removed';
  declineReason: string | null;
  createdAt: string;
  author: Author;
  ups: number;
  downs: number;
  standout: number;
  myVote: 0 | 1 | -1;
}

/** One row of a batch: its Draft, and what the entry held when the row was sent. */
export interface BatchRow {
  id: string;
  title: string;
  content: EntryContent;
  cardId: string | null;
  status: string;
  /** The entry as it was when the batch was sent; undefined for a new entry. */
  before?: EntryContent;
}

export interface NewBatch {
  blockKey: string;
  title: string;
  source: string;
  rows: { content: EntryContent; card?: string; revision?: number; source?: string }[];
}

const PROFILE = 'id, username, display_name, avatar_url';
const author = (p: Row | null | undefined, id: string): Author => {
  const username = (p?.username as string) ?? 'villager';
  return { id, username, name: (p?.display_name as string) || username, avatarUrl: (p?.avatar_url as string) ?? null };
};
/** The batch tables aren't there until Matt runs the SQL; until then batches simply don't show. */
const missingTable = (e: { message?: string; code?: string } | null) => Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || /draft_batches|batch_votes|batch_scores|send_batch|batch_id/.test(e.message ?? '')));

export function useBatches(gameId: string, meId: string | null, mod: boolean, onDraftsChanged: () => Promise<void> | void) {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const db = browserClient();
    if (!db) return;
    let q = db.from('draft_batches').select(`id, block_key, title, source, status, decline_reason, created_at, author_id, author:profiles!draft_batches_author_id_fkey(${PROFILE})`)
      .eq('game_id', gameId).order('created_at', { ascending: false }).limit(100);
    if (!mod) q = q.neq('status', 'removed');
    const [b, s, v] = await Promise.all([
      q,
      db.from('batch_scores').select('batch_id, ups, downs, standout').eq('game_id', gameId),
      meId ? db.from('batch_votes').select('batch_id, value').eq('voter_id', meId) : Promise.resolve({ data: [] as Row[], error: null }),
    ]);
    if (missingTable(b.error)) { setMissing(true); setReady(true); return; }
    if (b.error) return;
    const scores = new Map(((s.data ?? []) as Row[]).map((r) => [r.batch_id as string, r]));
    const mine = new Map(((v.data ?? []) as Row[]).map((r) => [r.batch_id as string, r.value as number]));
    setBatches(((b.data ?? []) as unknown as Row[]).map((r) => {
      const sc = scores.get(r.id as string);
      return {
        id: r.id as string, blockKey: r.block_key as string, title: r.title as string, source: r.source as string,
        status: r.status as Batch['status'], declineReason: (r.decline_reason as string) ?? null, createdAt: r.created_at as string,
        author: author(r.author as Row, r.author_id as string),
        ups: Number(sc?.ups ?? 0), downs: Number(sc?.downs ?? 0), standout: Number(sc?.standout ?? 0),
        myVote: (mine.get(r.id as string) ?? 0) as 0 | 1 | -1,
      };
    }));
    setMissing(false);
    setReady(true);
  }, [gameId, meId, mod]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the database once it's reachable
  useEffect(() => { void load(); }, [load]);

  /** A batch's rows, with what each entry held when the batch was sent (for "What changes"). */
  const loadRows = useCallback(async (batchId: string): Promise<BatchRow[]> => {
    const db = browserClient();
    if (!db) return [];
    const { data } = await db.from('drafts').select('id, title, content, card_id, base_revision_id, status').eq('batch_id', batchId).order('created_at').order('id');
    const rows = (data ?? []) as Row[];
    const revs = rows.map((r) => r.base_revision_id as number).filter(Boolean);
    const before = new Map<number, EntryContent>();
    if (revs.length) {
      const { data: rv } = await db.from('card_revisions').select('id, content').in('id', revs);
      for (const r of (rv ?? []) as Row[]) before.set(r.id as number, r.content as EntryContent);
    }
    const full = (c: Partial<EntryContent>, title: string): EntryContent => ({ ...c, name: c.name ?? title, sections: c.sections ?? [], categories: c.categories ?? {} });
    return rows.map((r) => ({
      id: r.id as string, title: r.title as string, content: full(r.content as Partial<EntryContent>, r.title as string),
      cardId: (r.card_id as string) ?? null, status: r.status as string,
      before: r.base_revision_id ? before.get(r.base_revision_id as number) : undefined,
    }));
  }, []);

  /** Sends pasted rows as one batch. Returns its id, or a problem in plain words. */
  const send = useCallback(async (b: NewBatch): Promise<{ id?: string; error?: string }> => {
    const db = browserClient();
    if (!db || !meId) return { error: 'Sign in to send a batch.' };
    const { data, error } = await db.rpc('send_batch', {
      g: gameId, block: b.blockKey, title: b.title, source: b.source,
      rows: b.rows.map((r) => ({ content: r.content, card: r.card ?? null, revision: r.revision ?? null, source: r.source ?? null })),
    });
    if (missingTable(error)) return { error: 'Batches are almost ready: the database needs one more update.' };
    if (error) return { error: plainError(error.message) };
    await load();
    return { id: data as string };
  }, [gameId, meId, load]);

  /** "I can confirm" (1), "Seems wrong" (-1), or 0 to take it back. */
  const vote = useCallback(async (batchId: string, value: 0 | 1 | -1) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to vote.';
    setBatches((list) => list.map((b) => (b.id !== batchId ? b : {
      ...b, myVote: value,
      ups: b.ups - (b.myVote === 1 ? 1 : 0) + (value === 1 ? 1 : 0),
      downs: b.downs - (b.myVote === -1 ? 1 : 0) + (value === -1 ? 1 : 0),
    })));
    const { error } = value === 0
      ? await db.from('batch_votes').delete().eq('batch_id', batchId).eq('voter_id', meId)
      : await db.from('batch_votes').upsert({ batch_id: batchId, voter_id: meId, value }, { onConflict: 'batch_id,voter_id' });
    await load();
    return error ? plainError(error.message) : null;
  }, [meId, load]);

  /** Moderators: publish every row. Rows that changed since, or can't go out, are set aside. */
  const ship = useCallback(async (batchId: string): Promise<{ shipped?: number; aside?: number; error?: string }> => {
    const db = browserClient();
    if (!db || !meId) return { error: 'Sign in first.' };
    const { data, error } = await db.rpc('ship_batch', { batch: batchId });
    if (error) return { error: plainError(error.message) };
    await appChanged(gameId);
    router.refresh();
    await Promise.all([load(), onDraftsChanged()]);
    const r = (data ?? {}) as { shipped?: number; aside?: number };
    return { shipped: r.shipped ?? 0, aside: r.aside ?? 0 };
  }, [meId, gameId, router, load, onDraftsChanged]);

  /** Moderators: decline with a reason the sender gets in their inbox. */
  const decline = useCallback(async (batchId: string, reason: string) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in first.';
    const { error } = await db.rpc('decline_batch', { batch: batchId, reason });
    await Promise.all([load(), onDraftsChanged()]);
    return error ? plainError(error.message) : null;
  }, [meId, load, onDraftsChanged]);

  /** The sender takes back a batch nobody has decided yet. */
  const withdraw = useCallback(async (batchId: string) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in first.';
    const { error } = await db.rpc('withdraw_batch', { batch: batchId });
    await load();
    return error ? plainError(error.message) : null;
  }, [meId, load]);

  /** "This row's off": it leaves the batch as a Draft of its own, and moderators see why. */
  const setAside = useCallback(async (draftId: string, note: string) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in first.';
    const { error } = await db.rpc('set_aside_row', { draft: draftId, note });
    await onDraftsChanged();
    return error ? plainError(error.message) : null;
  }, [meId, onDraftsChanged]);

  return { batches, ready, missing, load, loadRows, send, vote, ship, decline, withdraw, setAside };
}

export type BatchData = ReturnType<typeof useBatches>;
