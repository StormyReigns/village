'use client';

import { useEffect, useRef, useState } from 'react';
import { BellDot, X } from 'lucide-react';
import { SignInPrompt } from '@/components/SignInPrompt';
import { useInbox } from '@/components/inbox/useInbox';
import { InboxRow } from '@/components/inbox/InboxRow';
import { GROUPS, groupOf, type Group } from '@/lib/inbox';

const PAGE = 40;
const pill = (on: boolean) => 'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (on ? 'bg-ink text-paper ring-ink' : 'bg-card ring-line hover:ring-ink');

/**
 * The whole inbox: everything new at the top, then earlier news, from every game. Filters by kind
 * (and by game, once there's news from more than one), "Keep as new" to come back to something,
 * and "Clear" with a moment to undo. Opening the page reads what's new, like opening the bell.
 */
export function InboxPage() {
  const [size, setSize] = useState(PAGE);
  const { me, items, ctx, more, plain, markRead, setRead, hide } = useInbox(size);
  const [group, setGroup] = useState<Group | 'all'>('all');
  const [game, setGame] = useState<string>('all');
  // What was new when it arrived here: it stays in "New" while the page is open.
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  // Marked "Keep as new" on purpose, so this page doesn't read them again.
  const kept = useRef<Set<number>>(new Set());
  const [cleared, setCleared] = useState<{ undo: () => void; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Reading the page reads what's new (and anything that arrives while it's open).
  useEffect(() => {
    if (!items) return;
    const unread = items.filter((x) => !x.readAt && !kept.current.has(x.id)).map((x) => x.id);
    if (!unread.length) return;
    setFresh((s) => new Set([...s, ...unread]));
    markRead(unread).catch(() => {});
  }, [items, markRead]);

  if (me === undefined || (me && !items)) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-card" />;
  if (!me) {
    return (
      <section className="surface mt-6 rounded-2xl p-8 text-center">
        <h1 className="font-display text-3xl">Your inbox</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">Sign in to get replies to your Drafts and questions, @mentions, and news of your titles and badges.</p>
        <div className="mt-5"><SignInPrompt>Sign in</SignInPrompt></div>
      </section>
    );
  }
  const list = items ?? [];

  // Only filters that have something behind them.
  const groups = GROUPS.filter((g) => list.some((x) => groupOf(x.type) === g.key));
  const games = [...new Set(list.map((x) => x.gameId).filter((g): g is string => Boolean(g)))];
  const shown = list.filter((x) => (group === 'all' || groupOf(x.type) === group) && (game === 'all' || x.gameId === game));
  const isNew = (id: number, readAt: string | null) => fresh.has(id) || !readAt;
  const newOnes = shown.filter((x) => isNew(x.id, x.readAt));
  const earlier = shown.filter((x) => !isNew(x.id, x.readAt));

  const clear = (id: number) => {
    if (cleared) clearTimeout(cleared.timer);
    const h = hide(id);
    const timer = setTimeout(() => { h.commit().catch(() => {}); setCleared(null); }, 5000);
    setCleared({ undo: () => { clearTimeout(timer); h.undo(); setCleared(null); }, timer });
  };
  const keepNew = (id: number) => {
    kept.current.add(id);
    setFresh((s) => { const n = new Set(s); n.delete(id); return n; });
    setRead(id, false).catch(() => {});
  };

  const actions = (id: number, unread: boolean) => (
    <span className="flex shrink-0 items-start gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
      {!unread && (
        <button onClick={() => keepNew(id)} aria-label="Keep as new" title="Keep as new: the bell keeps its dot until you look again"
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
          <BellDot size={15} aria-hidden="true" />
        </button>
      )}
      <button onClick={() => clear(id)} aria-label="Clear" title="Clear" className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
        <X size={15} aria-hidden="true" />
      </button>
    </span>
  );

  const section = (title: string, rows: typeof shown) => rows.length > 0 && (
    <section className="surface rounded-2xl p-2 sm:p-3">
      <h2 className="px-2.5 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wide text-muted">{title}</h2>
      <ul className="grid gap-0.5 text-sm">
        {rows.map((x) => (
          <InboxRow key={x.id} item={x} ctx={ctx} plain={plain} game={games.length > 1} fresh={fresh.has(x.id)}
            actions={actions(x.id, !x.readAt)} />
        ))}
      </ul>
    </section>
  );

  return (
    <div className="mt-4 grid gap-5">
      <header>
        <h1 className="font-display text-3xl">Inbox</h1>
        <p className="text-muted">News for you from every game: replies, mentions, your Drafts, and your titles and badges.</p>
      </header>

      {list.length > 0 && (
        <div className="chip-strip -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button aria-pressed={group === 'all'} onClick={() => setGroup('all')} className={pill(group === 'all')}>All</button>
          {groups.map((g) => (
            <button key={g.key} aria-pressed={group === g.key} onClick={() => setGroup(group === g.key ? 'all' : g.key)} className={pill(group === g.key)}>{g.label}</button>
          ))}
          {games.length > 1 && (
            <select value={game} onChange={(e) => setGame(e.target.value)} aria-label="Game"
              className="shrink-0 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink sm:ml-auto">
              <option value="all">Every game</option>
              {games.map((g) => <option key={g} value={g}>{ctx.games.get(g) ?? g}</option>)}
            </select>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <section className="surface rounded-2xl p-6 text-muted">
          Nothing yet. When someone replies to a Draft of yours, @mentions you in a Workshop, answers a question you asked, or
          your title moves up, it comes here.
        </section>
      ) : shown.length === 0 ? (
        <section className="surface rounded-2xl p-6 text-muted">Nothing here with these filters.</section>
      ) : (
        <>
          {section('New', newOnes)}
          {section(newOnes.length ? 'Earlier' : 'Everything', earlier)}
        </>
      )}

      {more && (
        <button onClick={() => setSize((n) => n + PAGE)} className="btn-quiet justify-self-center rounded-full px-5 py-2 text-sm font-bold">Show older</button>
      )}

      {cleared && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper shadow-soft">
          Cleared
          <button onClick={cleared.undo} className="rounded-full px-2 py-0.5 text-signal underline">Undo</button>
        </div>
      )}
    </div>
  );
}
