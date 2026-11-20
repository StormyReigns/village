// Your inbox (docs/inbox.md): news written for you by the database. Each item is a type plus a
// payload; this file says what each type means in words, which group it filters under, and where
// tapping it goes. The bell (src/components/Inbox.tsx) and the inbox page (/inbox) both use it.

import { answerHref, type AnswerPlace } from './questions.ts';
import { messagePath } from './links.ts';
import { ROLE, TENURE } from './ranks.ts';

export interface InboxItem {
  id: number; gameId: string | null; type: string; payload: Record<string, unknown>; readAt: string | null; createdAt: string;
}

type Row = Record<string, unknown>;
export const INBOX_COLUMNS = 'id, game_id, type, payload, read_at, created_at';
export const toInboxItem = (r: Row): InboxItem => ({
  id: r.id as number, gameId: (r.game_id as string) ?? null, type: r.type as string,
  payload: (r.payload as Record<string, unknown>) ?? {}, readAt: (r.read_at as string) ?? null, createdAt: r.created_at as string,
});

/** The filters on the inbox page, in order. Each item belongs to one. */
export const GROUPS = [
  { key: 'talk', label: 'Mentions and replies' },
  { key: 'drafts', label: 'Your Drafts' },
  { key: 'questions', label: 'Questions' },
  { key: 'titles', label: 'Titles and badges' },
] as const;
export type Group = (typeof GROUPS)[number]['key'] | 'other';

export function groupOf(type: string): Group {
  if (type === 'mention' || type === 'draft_activity') return 'talk';
  if (type.startsWith('draft_') || type.startsWith('batch_')) return 'drafts';
  if (type.startsWith('question_')) return 'questions';
  if (type === 'title_up' || type === 'badge_up') return 'titles';
  return 'other';
}

/** The icon each item shows (names from lucide-react, picked in the component). */
export type Icon = 'question' | 'mention' | 'reply' | 'shipped' | 'declined' | 'batch' | 'community' | 'title' | 'badge' | 'news';

/** What's read from elsewhere to describe items: the words of questions and messages, and names. */
export interface InboxContext {
  questions: Map<string, { body: string; spoiler: boolean; reply: string | null }>;
  messages: Map<number, { body: string; spoiler: boolean }>;
  people: Map<string, string>;
  games: Map<string, string>;
}

export interface Described { icon: Icon; title: string; body?: string; href?: string; link?: string; quote?: boolean }

const n = (v: unknown) => Number(v ?? 0) || 0;
const s = (v: unknown) => (v == null ? undefined : String(v));
const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** A message's words as plain text, mentions and references turned into names. */
export type Plain = (body: string) => string;

/** What one inbox item says, and where tapping it goes. */
export function describe(item: InboxItem, ctx: InboxContext, plain: Plain): Described {
  const p = item.payload;
  const g = item.gameId;
  const workshop = g ? `/g/${g}/workshop` : '/town-hall';
  const draftLink = p.draft && g ? `${workshop}?draft=${s(p.draft)}` : workshop;
  const who = (id: unknown) => (id ? ctx.people.get(String(id)) : undefined) ?? 'Someone';
  const msg = (id: unknown) => (id == null ? undefined : ctx.messages.get(n(id)));

  switch (item.type) {
    case 'question_answered': {
      const href = g ? answerHref(g, p as AnswerPlace) ?? undefined : undefined;
      // The question's words come from the question itself, so a removed one isn't shown.
      const q = ctx.questions.get(String(p.question));
      return {
        icon: 'question',
        title: !q ? 'Your question was answered' : q.spoiler ? 'Your spoiler question was answered' : `“${q.body}”`,
        body: q?.reply ?? s(p.reply), href, link: p.entry ? `see ${String(p.entry)}` : 'see the answer',
      };
    }
    case 'mention': {
      const m = msg(p.message);
      const href = g && p.message != null ? messagePath(g, n(p.message)) : workshop;
      return {
        icon: 'mention', title: `${who(p.by)} mentioned you`,
        // A removed message isn't readable any more, so it isn't shown.
        body: !m ? undefined : m.spoiler || p.spoiler ? 'Spoiler · open it to read' : plain(m.body), quote: Boolean(m && !m.spoiler),
        href, link: 'reply',
      };
    }
    case 'draft_activity': {
      const replies = n(p.replies), doubts = n(p.doubts);
      const parts = [replies && plural(replies, 'reply', 'replies'), doubts && plural(doubts, '“Seems wrong”', '“Seems wrong”s')].filter(Boolean);
      const m = replies ? msg(p.message) : undefined;
      return {
        icon: 'reply', title: `${parts.join(' and ') || 'Activity'} on ${s(p.title) ?? 'your Draft'}`,
        body: m ? `${who(p.by)}: ${m.spoiler ? 'Spoiler' : plain(m.body)}` : doubts && !replies ? 'Someone thinks part of it may be wrong. A source or a fix can settle it.' : undefined,
        href: draftLink, link: 'see the Draft',
      };
    }
    case 'draft_published': {
      const app = g && p.page ? answerHref(g, p as AnswerPlace) ?? undefined : undefined;
      return p.removed
        ? { icon: 'shipped', title: `Your request to remove ${s(p.title)} was approved`, body: 'It’s out of the app now.', href: draftLink, link: 'see the Draft' }
        : { icon: 'shipped', title: `${s(p.title)} is in the app`, body: `Approved by ${who(p.by)}. That’s a harvest.`, href: app ?? draftLink, link: app ? `see ${s(p.entry) ?? 'it'}` : 'see the Draft' };
    }
    case 'draft_declined':
      return { icon: 'declined', title: `${s(p.title)} wasn’t published`, body: s(p.reason) ? `“${s(p.reason)}”` : `Declined by ${who(p.by)}.`, href: draftLink, link: 'see the Draft' };
    case 'title_up': {
      const title = `${s(p.tenure) ?? 'New'} ${s(p.role) ?? 'Villager'}`;
      if (p.part === 'star') return { icon: 'title', title: `A Keeper star: ${n(p.stars)} now`, body: `${n(p.harvests)} changes of yours are in the app.`, href: '/me', link: 'your profile' };
      const ladder = p.part === 'tenure' ? TENURE : ROLE;
      const note = ladder.find((x) => x.name === p.step)?.note;
      return {
        icon: 'title', title: p.part === 'tenure' ? `You’re ${s(p.step)} now` : `You’re a${/^[AEIOU]/.test(s(p.step) ?? '') ? 'n' : ''} ${s(p.step)} now`,
        body: `Your title is ${title}.${note ? ` ${note}` : ''}`, href: '/me', link: 'your profile',
      };
    }
    case 'badge_up': {
      const game = (g && ctx.games.get(g)) ?? 'A game';
      const leaves = n(p.leaves);
      return {
        icon: 'badge', title: leaves <= 1 ? `Your ${game} badge has its color` : `Your ${game} badge has ${leaves} leaves`,
        body: `${plural(n(p.harvests), 'change')} of yours in this game’s app.`, href: '/me', link: 'your badges',
      };
    }
  }
  const icon: Icon = item.type.startsWith('batch_') ? 'batch' : item.type.startsWith('community_') ? 'community' : 'news';
  return { icon, title: s(p.title) ?? 'News from the village', body: s(p.body), href: s(p.href) };
}

/** "just now", "5m", "3h", or a date. Only ever runs in the browser. */
export function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
