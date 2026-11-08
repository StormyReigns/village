'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { missingTable, plainError, QUESTION_COLUMNS, toQuestion, type AnswerPlace, type Question } from '@/lib/questions';

// A game's questions (docs/blocks/questions.md), kept live: asking, "me too", answering by
// linking an entry, and the moderators' tidying. Row-level security in the database decides
// what's allowed (20261108000000_questions.sql); this file only asks. Answering with a Draft
// goes through the Workshop's Drafts, and the database closes the question when it ships.

/** A question with where its answer lives, for "see Cai". */
export interface LiveQuestion extends Question { answer: AnswerPlace | null }

type Row = Record<string, unknown>;
const COLUMNS = `${QUESTION_COLUMNS}, answer:cards!questions_answer_card_id_fkey(slug, block_key, game_blocks(page_key, type))`;

function toLive(r: Row): LiveQuestion {
  const a = r.answer as Row | null;
  const b = (Array.isArray(a?.game_blocks) ? a?.game_blocks[0] : a?.game_blocks) as Row | null | undefined;
  return {
    ...toQuestion(r),
    answer: a ? { slug: a.slug as string, block: a.block_key as string, page: (b?.page_key as string) ?? undefined, blockType: (b?.type as string) ?? undefined } : null,
  };
}

/** What a player typed before signing in, kept on this device so nothing is lost. */
export interface UnsentQuestion { body: string; pageKey: string; spoiler: boolean }
const unsentKey = (gameId: string) => `village:${gameId}:unsent-question`;
export function readUnsentQuestion(gameId: string): UnsentQuestion | null {
  try { return JSON.parse(localStorage.getItem(unsentKey(gameId)) ?? 'null'); } catch { return null; }
}
export function saveUnsentQuestion(gameId: string, q: UnsentQuestion | null) {
  try {
    if (q && q.body.trim()) localStorage.setItem(unsentKey(gameId), JSON.stringify(q));
    else localStorage.removeItem(unsentKey(gameId));
  } catch { /* storage unavailable */ }
}

export function useQuestions(gameId: string, meId: string | null | undefined) {
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  // 'missing': the Questions SQL hasn't been run yet, so the app shows nothing about them.
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'offline'>('loading');

  const load = useCallback(async () => {
    const db = browserClient();
    if (!db) { setState('offline'); return; }
    const { data, error } = await db.from('questions').select(COLUMNS)
      .eq('game_id', gameId).in('status', ['open', 'answered']).order('created_at', { ascending: false }).limit(500);
    if (error) { setState(missingTable(error) ? 'missing' : 'offline'); return; }
    setQuestions(((data ?? []) as unknown as Row[]).map(toLive).reverse());
    setState('ready');
  }, [gameId]);

  useEffect(() => {
    const db = browserClient();
    if (!db) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no database on this copy of the site
      setState('offline');
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => { load().catch(() => {}); }, 300); };
    load().catch(() => setState('offline'));
    // Each bar listens on its own channel, so two on one screen never share one.
    const ch = db.channel(`questions:${gameId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `game_id=eq.${gameId}` }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'question_askers', filter: `game_id=eq.${gameId}` }, soon)
      .subscribe();
    return () => { clearTimeout(timer); db.removeChannel(ch); };
  }, [gameId, load]);

  /** Posts a question. Returns its id, or an error in plain words. */
  const ask = useCallback(async (q: { body: string; pageKey: string | null; spoiler: boolean; cardId?: string | null }): Promise<{ id?: string; error?: string }> => {
    const db = browserClient();
    if (!db || !meId) return { error: 'Sign in to ask, so the answer can reach you.' };
    const body = q.body.trim().replace(/\s+/g, ' ');
    if (body.length < 3) return { error: 'Ask in a few words, like “How does Long join?”' };
    if (body.length > 300) return { error: 'Keep it short: 300 characters at most.' };
    const { data, error } = await db.from('questions')
      .insert({ game_id: gameId, page_key: q.pageKey, card_id: q.cardId ?? null, body, spoiler: q.spoiler, asked_by: meId })
      .select('id').single();
    if (error) return { error: missingTable(error) ? 'Questions are almost ready: the database needs one more update.' : plainError(error.message) };
    await load();
    return { id: data.id as string };
  }, [gameId, meId, load]);

  /** Adds your "me too" to a question, or takes it back. */
  const meToo = useCallback(async (questionId: string, on: boolean) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to say “me too”, so the answer reaches you as well.';
    setQuestions((list) => list.map((q) => (q.id !== questionId ? q
      : { ...q, meToo: on ? [...q.meToo.filter((x) => x !== meId), meId] : q.meToo.filter((x) => x !== meId) })));
    const { error } = on
      ? await db.from('question_askers').insert({ question_id: questionId, profile_id: meId })
      : await db.from('question_askers').delete().eq('question_id', questionId).eq('profile_id', meId);
    if (error && !/duplicate key/i.test(error.message)) { await load(); return plainError(error.message); }
    return null;
  }, [meId, load]);

  /** "It's already there": links the entry that answers it, with a reply for the asker. */
  const answerWithLink = useCallback(async (questionId: string, cardId: string, reply: string) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to answer.';
    const { error } = await db.rpc('answer_question', { q: questionId, card: cardId, reply: reply.trim() });
    if (error) return plainError(error.message);
    await load();
    return null;
  }, [meId, load]);

  // ------------------------------------------------------------ moderators

  /** "That didn't answer it": the asker or a moderator opens it again, and the answer is cleared. */
  const reopen = useCallback(async (questionId: string) => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in first.';
    const { error } = await db.rpc('reopen_question', { q: questionId });
    if (error) return plainError(error.message);
    await load();
    return null;
  }, [meId, load]);

  /** Moderators: removes a question. */
  const remove = useCallback(async (questionId: string) => {
    const db = browserClient();
    if (!db) return 'Sign in first.';
    const { error } = await db.from('questions').update({ status: 'removed' }).eq('id', questionId);
    if (error) return plainError(error.message);
    await load();
    return null;
  }, [load]);

  /** Folds a duplicate into another question; its asker and "me too"s move across. */
  const merge = useCallback(async (duplicate: string, into: string) => {
    const db = browserClient();
    if (!db) return 'Sign in first.';
    const { error } = await db.rpc('merge_question', { dup: duplicate, into_q: into });
    if (error) return plainError(error.message);
    await load();
    return null;
  }, [load]);

  /** Reports a question to the moderators. */
  const report = useCallback(async (questionId: string, reason: string, note = '') => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to report.';
    const { error } = await db.from('flags').insert({ question_id: questionId, reason, note: note.trim() || null, reporter_id: meId });
    return error ? plainError(error.message) : null;
  }, [meId]);

  return { state, questions, reload: load, ask, meToo, answerWithLink, reopen, moderate: { remove, merge }, report };
}

export type QuestionsData = ReturnType<typeof useQuestions>;
