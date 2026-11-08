'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CircleHelp, Inbox as InboxIcon } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { useVillager } from './useVillager';
import { answerHref, missingTable, type AnswerPlace } from '@/lib/questions';

/** "just now", "5m", "3h", or a date. Only ever runs in the browser. */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Your inbox: news written for you by the database (20261108000000_questions.sql), shown
// behind a bell in the top bar with a dot while anything is unread. Each item has a type and a
// payload, so new kinds of news (a Draft of yours shipped, an @mention) slot in here.

interface Item { id: number; gameId: string | null; type: string; payload: Record<string, unknown>; readAt: string | null; createdAt: string }

type Row = Record<string, unknown>;
const toItem = (r: Row): Item => ({
  id: r.id as number, gameId: (r.game_id as string) ?? null, type: r.type as string,
  payload: (r.payload as Record<string, unknown>) ?? {}, readAt: (r.read_at as string) ?? null, createdAt: r.created_at as string,
});

/** A question's own words, read from the question (inbox items carry only its id). */
interface Asked { body: string; spoiler: boolean; reply: string | null }

/** What one inbox item says, and where tapping it goes. */
function describe(item: Item, asked: Map<string, Asked>): { title: string; body?: string; href?: string; link?: string } {
  const p = item.payload;
  if (item.type === 'question_answered') {
    const href = item.gameId ? answerHref(item.gameId, p as AnswerPlace) ?? undefined : undefined;
    // The question's words come from the question itself, so a removed one isn't shown.
    const q = asked.get(String(p.question));
    return {
      title: !q ? 'Your question was answered' : q.spoiler ? 'Your spoiler question was answered' : `“${q.body}”`,
      body: q?.reply ?? (p.reply as string) ?? undefined,
      href, link: p.entry ? `see ${String(p.entry)}` : 'see the answer',
    };
  }
  return { title: String(p.title ?? 'News from the village'), body: (p.body as string) ?? undefined, href: (p.href as string) ?? undefined };
}

/** The bell and its list. Signed-out visitors don't have an inbox, so they see nothing. */
export function InboxBell({ dark = false }: { dark?: boolean }) {
  const me = useVillager();
  const meId = me?.id ?? null;
  const [items, setItems] = useState<Item[] | null>(null);
  const [asked, setAsked] = useState<Map<string, Asked>>(new Map());
  const [open, setOpen] = useState(false);
  // Unread when the list was opened, so they stay marked while you read them.
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const db = browserClient();
    if (!db || !meId) { setItems(null); return; }
    const { data, error } = await db.from('inbox').select('id, game_id, type, payload, read_at, created_at')
      .eq('profile_id', meId).order('created_at', { ascending: false }).limit(30);
    // Before the inbox SQL is run there's no table: no bell yet.
    if (error) { if (missingTable(error)) setItems(null); return; }
    const list = ((data ?? []) as Row[]).map(toItem);
    setItems(list);
    const ids = [...new Set(list.filter((x) => x.type === 'question_answered').map((x) => String(x.payload.question)))];
    if (!ids.length) return;
    const q = await db.from('questions').select('id, body, spoiler, reply').in('id', ids);
    setAsked(new Map(((q.data ?? []) as Row[]).map((r) => [r.id as string, { body: r.body as string, spoiler: Boolean(r.spoiler), reply: (r.reply as string) ?? null }])));
  }, [meId]);

  useEffect(() => {
    const db = browserClient();
    if (!db || !meId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- signed out: no inbox
      setItems(null);
      return;
    }
    load().catch(() => {});
    const ch = db.channel(`inbox:${meId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbox', filter: `profile_id=eq.${meId}` }, () => { load().catch(() => {}); })
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [meId, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);

  if (!meId || !items) return null;
  const unread = items.filter((x) => !x.readAt);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || !unread.length) return;
    // Opening the list reads it: the dot goes, and what was new stays marked until it closes.
    setFresh(new Set(unread.map((x) => x.id)));
    const now = new Date().toISOString();
    setItems((list) => list?.map((x) => (x.readAt ? x : { ...x, readAt: now })) ?? list);
    await browserClient()?.from('inbox').update({ read_at: now }).eq('profile_id', meId).is('read_at', null);
  };

  return (
    <div ref={box} className="relative">
      <button onClick={toggle} aria-expanded={open} aria-label={unread.length ? `Inbox, ${unread.length} new` : 'Inbox'}
        className={'relative -my-1 grid size-11 shrink-0 place-items-center rounded-full ' + (dark ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-card-2 hover:text-ink')}>
        <Bell size={18} aria-hidden="true" />
        {unread.length > 0 && (
          <span aria-hidden="true" className={'absolute right-2.5 top-2.5 size-2.5 rounded-full bg-signal ring-2 ' + (dark ? 'ring-ink' : 'ring-card')} />
        )}
      </button>
      {open && (
        <div className="surface pop absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-2 text-sm text-ink">
          <p className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-xs font-bold uppercase tracking-wide text-muted"><InboxIcon size={13} aria-hidden="true" /> Inbox</p>
          {items.length === 0 ? (
            <p className="px-2 pb-2 text-muted">Nothing yet. When someone answers a question you asked, or said “me too” to, the reply comes here.</p>
          ) : (
            <ul className="grid max-h-[60vh] gap-1 overflow-y-auto">
              {items.map((item) => {
                const d = describe(item, asked);
                return (
                  <li key={item.id} className={'flex gap-2.5 rounded-xl px-2 py-2 ' + (fresh.has(item.id) ? 'bg-sun-soft' : '')}>
                    <CircleHelp size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold leading-snug">{d.title}</span>
                      {d.body && <span className="block">{d.body}</span>}
                      <span className="mt-0.5 block text-xs text-muted">
                        {ago(item.createdAt)}
                        {d.href && <> · <Link href={d.href} onClick={() => setOpen(false)} className="font-bold text-ink underline">{d.link ?? 'Open'}</Link></>}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
