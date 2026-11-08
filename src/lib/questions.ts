// Questions (docs/blocks/questions.md): plain helpers shared by the app's bar, the Workshop's
// Questions tab and the inbox. No React and no database here, so they can be tested.

import { rank } from './search.ts';

export interface Question {
  id: string;
  gameId: string;
  /** The Page it's about. */
  pageKey: string | null;
  /** The entry it's about, when it's about one. */
  cardId: string | null;
  body: string;
  spoiler: boolean;
  /** For Builders: what's known so far (Mysteries brought this with them). */
  note: string | null;
  /** Null for questions moved in from the old Mysteries Block. */
  askedBy: string | null;
  status: 'open' | 'answered' | 'removed';
  reply: string | null;
  answerCardId: string | null;
  answerDraftId: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  createdAt: string;
  /** Everyone else who said "me too". */
  meToo: string[];
}

/** Where an answer lives in the app, as the database describes it (inbox payloads carry this). */
export interface AnswerPlace { page?: string; block?: string; blockType?: string; slug?: string }

/** How many players want to know: the asker and everyone who said "me too". */
export function wantCount(q: Pick<Question, 'askedBy' | 'meToo'>): number {
  return (q.askedBy ? 1 : 0) + q.meToo.length;
}

/** Whether you're already waiting on this one (you asked, or said "me too"). */
export function waitingOn(q: Pick<Question, 'askedBy' | 'meToo'>, me: string | null | undefined): boolean {
  return Boolean(me && (q.askedBy === me || q.meToo.includes(me)));
}

/** Open questions, oldest first (Matt: the ones waiting longest come first). */
export function oldestFirst<T extends Pick<Question, 'createdAt'>>(list: T[]): T[] {
  return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Open questions about one Page, oldest first. */
export function openOn<T extends Question>(list: T[], pageKey: string): T[] {
  return oldestFirst(list.filter((q) => q.status === 'open' && q.pageKey === pageKey));
}

/** How long something has been open, in words: "today", "1 day", "4 days", "3 weeks". */
export function openFor(iso: string, now: number = Date.now()): string {
  const days = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return 'today';
  if (days < 14) return days === 1 ? '1 day' : `${days} days`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

/** Questions already asked that look like what's being typed, best first (for "me too"). */
export function similarQuestions<T extends Question>(list: T[], text: string, max = 3): T[] {
  if (text.trim().length < 3) return [];
  return rank(list.filter((q) => q.status === 'open'), text, (q) => ({ name: q.body, text: q.note ?? '' })).slice(0, max);
}

/** The app address of the entry that answers a question. Guides and timelines open in place. */
export function answerHref(gameId: string, p: AnswerPlace): string | null {
  if (!p.page) return null;
  const base = `/g/${gameId}/${p.page}`;
  if (!p.block || !p.slug) return base;
  return p.blockType === 'guide' || p.blockType === 'timeline' ? `${base}#${p.block}-${p.slug}` : `${base}?e=${p.block}.${p.slug}`;
}

/** Turns a database row into a Question. "Me too"s come as rows of { profile_id }. */
export function toQuestion(r: Record<string, unknown>): Question {
  const askers = Array.isArray(r.question_askers) ? (r.question_askers as { profile_id: string }[]) : [];
  return {
    id: r.id as string, gameId: r.game_id as string, pageKey: (r.page_key as string) ?? null, cardId: (r.card_id as string) ?? null,
    body: r.body as string, spoiler: Boolean(r.spoiler), note: (r.note as string) ?? null, askedBy: (r.asked_by as string) ?? null,
    status: (r.status as Question['status']) ?? 'open', reply: (r.reply as string) ?? null,
    answerCardId: (r.answer_card_id as string) ?? null, answerDraftId: (r.answer_draft_id as string) ?? null,
    answeredBy: (r.answered_by as string) ?? null, answeredAt: (r.answered_at as string) ?? null,
    createdAt: r.created_at as string, meToo: askers.map((a) => a.profile_id),
  };
}

/** The columns the app reads, with each question's "me too"s. */
export const QUESTION_COLUMNS = 'id, game_id, page_key, card_id, body, spoiler, note, asked_by, status, reply, answer_card_id, answer_draft_id, answered_by, answered_at, created_at, question_askers(profile_id)';

/** Before the Questions SQL is run the table isn't there; the app then quietly shows nothing. */
export function missingTable(e: { message?: string; code?: string } | null): boolean {
  return Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || /questions|inbox|relation .* does not exist|schema cache/i.test(e.message ?? '')));
}

/** Database errors in words a player can act on. */
export function plainError(message: string): string {
  if (/slow down/i.test(message)) return message.replace(/^.*?(Slow down)/i, '$1');
  if (/duplicate key|unique/i.test(message)) return "You've already done that.";
  if (/row-level security|permission/i.test(message)) return "That wasn't allowed. Try signing in again.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the village. Check your connection and try again.";
  return message;
}

/**
 * The Page that lists every open question in the game: the first one with a guide Block (where
 * players go to learn how things work), else the last Page. Never a fixed id, so every game
 * gets one, whatever its Pages are called.
 */
export function questionsPage<P extends { id: string; blocks: { type: string }[] }>(pages: P[]): P | undefined {
  return pages.find((p) => p.blocks.some((b) => b.type === 'guide')) ?? pages[pages.length - 1];
}
