'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowUpRight, Ban, CheckCircle2, CornerUpLeft, EyeOff, Flag, Gamepad2, Hammer, Landmark, MessageSquareOff,
  Plus, Rocket, Send, ShieldCheck, Sparkles, Undo2, Users, X, XCircle,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Piece } from '@/components/Piece';
import { useAccount, hasPowers } from '@/components/useVillager';
import { avatarOf } from '@/lib/avatar';
import { browserClient } from '@/lib/supabase/browser';

// The Staff room (docs/staff.md, Matt 2026-11-22): three panels like the Workshop. Left: tools, the site's
// numbers, what's waiting in each game, and links. Middle: the staff chat. Right: the site feed, everything
// that happened in every game (changes in the apps, moderator actions, reports, new games and Builders).
// The database decides who's staff (is_staff: a moderator of any game, or the Founder) and serves the feed
// and numbers (staff_feed, staff_stats in 20261205000000_staff_room.sql).

interface GameRow { id: string; title: string; status: string; mine: boolean; waiting: number; flags: number; notices: number }
interface Stats {
  villagers: number; new_this_week: number; active_this_week: number; games_live: number; games_building: number;
  published_this_week: number; games: GameRow[];
}
interface FeedRow {
  at: string; kind: string; game_id: string | null; who: string | null; who_name: string | null; title: string | null; detail: string | null;
  draft_id: string | null; card_id: string | null; block_key: string | null; message_id: number | null; ref_id: number | null;
}
interface Msg {
  id: number; author_id: string; body: string; reply_to: number | null; created_at: string; removed_at: string | null;
  author?: { display_name?: string | null; username?: string; picture?: string | null; avatar_url?: string | null } | null;
}

type Panel = 'tools' | 'chat' | 'feed';
type FeedFilter = 'all' | 'changes' | 'mod' | 'reports' | 'games';
const FILTER_OF: Record<string, FeedFilter> = {
  published: 'changes', removed: 'changes', restored: 'changes',
  declined: 'mod', hidden: 'mod', chat_hidden: 'mod', report_handled: 'mod',
  flag: 'reports', report: 'reports',
  game_started: 'games', game_launched: 'games', first_draft: 'games',
};
const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'Everything' }, { key: 'changes', label: 'Changes' }, { key: 'mod', label: 'Moderators' },
  { key: 'reports', label: 'Reports' }, { key: 'games', label: 'Games and Builders' },
];
const missingSql = (m?: string) => Boolean(m && /does not exist|schema cache|Could not find/i.test(m));

/** "3 min", "2 h", "Yesterday", "Nov 14": short, computed in the browser. */
function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'Yesterday';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function StaffRoom() {
  const me = useAccount();
  const [panel, setPanel] = useState<Panel>('chat');
  const [stats, setStats] = useState<Stats | null>(null);
  const [problem, setProblem] = useState<'sql' | 'denied' | null>(null);

  useEffect(() => {
    if (!hasPowers(me)) return;
    const db = browserClient();
    if (!db) return;
    const load = () => db.rpc('staff_stats').then(({ data, error }) => {
      if (error) { setProblem(missingSql(error.message) ? 'sql' : 'denied'); return; }
      setStats(data as Stats);
    });
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [me]);

  if (me === undefined) return <main className="mx-auto h-96 w-full max-w-screen-2xl animate-pulse px-4 pt-6" />;
  if (!hasPowers(me) || problem === 'denied') {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-10 text-center">
        <span className="mx-auto block w-fit"><Piece size={72} outline><ShieldCheck size={20} aria-hidden="true" /></Piece></span>
        <h1 className="mt-4 font-display text-2xl">The Staff room is for moderators</h1>
        <p className="mt-2 text-muted">{me ? 'It’s where moderators of every game coordinate.' : 'Sign in with a moderator’s account to come in.'}</p>
        {!me && <Link href="/signin?next=/staff" className="btn-primary mt-4 inline-flex rounded-full px-4 py-2 font-bold">Sign in</Link>}
      </main>
    );
  }
  if (problem === 'sql') {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-10 text-center">
        <h1 className="font-display text-2xl">Almost ready</h1>
        <p className="mt-2 text-muted">The Staff room needs a database update first (20261205000000_staff_room.sql).</p>
      </main>
    );
  }

  const games = new Map((stats?.games ?? []).map((g) => [g.id, g]));
  const tab = (key: Panel, label: string) => (
    <button key={key} onClick={() => setPanel(key)} aria-pressed={panel === key}
      className={'flex-1 rounded-full px-3 py-2 text-sm font-bold ' + (panel === key ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>{label}</button>
  );

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 pb-6 pt-4 sm:px-6">
      {/* On a phone, one panel at a time; the chat first. */}
      <div className="mb-3 flex gap-1 rounded-full bg-card p-1 ring-1 ring-line lg:hidden">
        {tab('tools', 'Tools')}{tab('chat', 'Staff chat')}{tab('feed', 'Site feed')}
      </div>
      <div className="grid gap-4 lg:h-[calc(100dvh-7rem)] lg:grid-cols-[17rem_minmax(0,1fr)_23rem]">
        <section aria-label="Tools and numbers" className={(panel === 'tools' ? 'block' : 'hidden') + ' min-h-0 overflow-y-auto lg:block'}>
          <Tools stats={stats} />
        </section>
        <section aria-label="Staff chat" className={(panel === 'chat' ? 'flex' : 'hidden') + ' h-[calc(100dvh-10rem)] min-h-0 flex-col rounded-2xl bg-card ring-1 ring-line lg:flex lg:h-auto'}>
          <StaffChat meId={me.id} siteMod={me.isFounder || me.modGames.includes(null)} />
        </section>
        <section aria-label="Site feed" className={(panel === 'feed' ? 'flex' : 'hidden') + ' h-[calc(100dvh-10rem)] min-h-0 flex-col rounded-2xl bg-card ring-1 ring-line lg:flex lg:h-auto'}>
          <SiteFeed games={games} />
        </section>
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ Left: tools, numbers, links

function Tools({ stats }: { stats: Stats | null }) {
  const tile = (label: string, n: number | undefined, sub?: string) => (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-line">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-2xl leading-tight">{n ?? '…'}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
  const mine = (stats?.games ?? []).filter((g) => g.mine);
  const busy = mine.filter((g) => g.waiting + g.flags + g.notices > 0);
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="px-1 font-display text-lg">Needs you</h2>
        {!stats ? <div className="mt-2 h-20 animate-pulse rounded-2xl bg-card" /> : busy.length === 0 ? (
          <p className="mt-1 rounded-2xl bg-card px-3 py-3 text-sm text-muted ring-1 ring-line">Nothing waiting in your games. Nice.</p>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {busy.map((g) => (
              <li key={g.id}>
                <Link href={`/g/${g.id}/workshop`} className="block rounded-2xl bg-card px-3 py-2 ring-1 ring-line hover:ring-ink">
                  <span className="block truncate font-bold">{g.title}</span>
                  <span className="flex flex-wrap gap-x-3 text-sm text-muted">
                    {g.waiting > 0 && <span><b className="text-ink">{g.waiting}</b> Draft{g.waiting === 1 ? '' : 's'} waiting</span>}
                    {g.flags > 0 && <span><b className="text-berry">{g.flags}</b> flagged</span>}
                    {g.notices > 0 && <span><b className="text-ink">{g.notices}</b> on the Notice Board</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="px-1 font-display text-lg">The village</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {tile('Villagers', stats?.villagers, stats ? `${stats.new_this_week} new this week` : undefined)}
          {tile('Active', stats?.active_this_week, 'this week')}
          {tile('Games', stats?.games_live, stats ? `${stats.games_building} being built` : undefined)}
          {tile('Published', stats?.published_this_week, 'this week')}
        </div>
      </div>

      <div>
        <h2 className="px-1 font-display text-lg">Go to</h2>
        <ul className="mt-2 grid gap-1">
          {(stats?.games ?? []).map((g) => (
            <li key={g.id} className="flex items-center gap-1 rounded-xl bg-card px-3 py-1.5 text-sm ring-1 ring-line">
              <span className="min-w-0 flex-1 truncate font-bold">{g.title}{g.status === 'draft' && <span className="ml-1 font-normal text-muted">· being built</span>}</span>
              <Link href={`/g/${g.id}/workshop`} aria-label={`${g.title} Workshop`} title="Workshop" className="grid size-8 place-items-center rounded-full hover:bg-card-2"><Hammer size={15} aria-hidden="true" /></Link>
              <Link href={`/g/${g.id}`} aria-label={`${g.title} app`} title="The app" className="grid size-8 place-items-center rounded-full hover:bg-card-2"><Gamepad2 size={15} aria-hidden="true" /></Link>
            </li>
          ))}
          <li><Link href="/start" className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold hover:bg-card"><Plus size={15} aria-hidden="true" /> Start a game</Link></li>
          <li><Link href="/town-hall" className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold hover:bg-card"><Landmark size={15} aria-hidden="true" /> Town Hall</Link></li>
        </ul>
        <p className="mt-2 px-1 text-xs text-muted">“See the site as” a villager or a visitor is in the Moderator menu at the top.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Middle: the staff chat

/** A message's words, with web addresses as links. */
function Words({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+|\/g\/[a-z0-9-]+[^\s<]*)/g);
  return <>{parts.map((p, i) => (/^(https?:\/\/|\/g\/)/.test(p)
    ? <a key={i} href={p} className="font-bold text-ink underline decoration-line underline-offset-2" target={p.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{p}</a>
    : <span key={i}>{p}</span>))}</>;
}

function StaffChat({ meId, siteMod }: { meId: string; siteMod: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Msg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const cols = 'id, author_id, body, reply_to, created_at, removed_at, author:profiles!staff_messages_author_id_fkey(display_name, username, picture, avatar_url)';

  const load = useCallback(async () => {
    const db = browserClient();
    if (!db) return;
    const { data, error: e } = await db.from('staff_messages').select(cols).order('created_at', { ascending: false }).limit(150);
    if (e) { setError(missingSql(e.message) ? 'The staff chat needs its database update.' : e.message); return; }
    setMsgs(((data ?? []) as unknown as Msg[]).reverse());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the chat from the database after mount
    load();
    const db = browserClient();
    if (!db) return;
    const ch = db.channel('staff-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_messages' }, () => { load(); })
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [load]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    const db = browserClient();
    if (!body || !db || sending) return;
    setSending(true);
    const { error: e } = await db.from('staff_messages').insert({ author_id: meId, body, reply_to: reply?.id ?? null });
    setSending(false);
    if (e) { setError(e.message); return; }
    setText(''); setReply(null); setError(null);
    load();
  };
  const takeBack = async (m: Msg) => {
    const db = browserClient();
    if (!db) return;
    const { error: e } = await db.rpc('staff_remove_message', { mid: m.id });
    if (e) setError(e.message); else load();
  };

  const byId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const nameOf = (m?: Msg) => m?.author?.display_name || m?.author?.username || 'A moderator';

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-lg leading-tight">Staff chat</h2>
        <p className="text-xs text-muted">Only moderators see this. Paste a link to point at anything on the site.</p>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {msgs.length === 0 && !error && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello to the other moderators.</p>}
        <ul className="grid gap-3">
          {msgs.map((m) => {
            const to = m.reply_to ? byId.get(m.reply_to) : undefined;
            return (
              <li key={m.id} className="group flex gap-2.5">
                <Avatar name={nameOf(m)} url={avatarOf(m.author)} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><b>{nameOf(m)}</b> <span className="text-xs text-muted">{ago(m.created_at)}</span></p>
                  {to && (
                    <p className="mt-0.5 truncate border-l-2 border-line pl-2 text-xs text-muted">
                      <CornerUpLeft size={11} className="mr-1 inline" aria-hidden="true" />{nameOf(to)}: {to.removed_at ? 'taken back' : to.body}
                    </p>
                  )}
                  {m.removed_at
                    ? <p className="text-sm italic text-muted">Taken back.</p>
                    : <p className="whitespace-pre-wrap break-words leading-relaxed"><Words text={m.body} /></p>}
                  {!m.removed_at && (
                    <span className="mt-0.5 flex gap-3 text-xs font-bold text-muted opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <button onClick={() => setReply(m)} className="hover:text-ink">Reply</button>
                      {(m.author_id === meId || siteMod) && <button onClick={() => takeBack(m)} className="hover:text-berry">Take back</button>}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        {error && <p className="mb-2 text-sm text-berry" role="alert">{error}</p>}
        {reply && (
          <p className="mb-2 flex items-center gap-2 rounded-xl bg-card-2 px-3 py-1.5 text-sm">
            <CornerUpLeft size={14} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">Replying to <b>{nameOf(reply)}</b>: {reply.body}</span>
            <button onClick={() => setReply(null)} aria-label="Stop replying" className="grid size-6 place-items-center rounded-full hover:bg-card"><X size={14} aria-hidden="true" /></button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message the other moderators" aria-label="Message the other moderators"
            className="min-h-11 flex-1 resize-none rounded-2xl bg-card-2 px-3 py-2 outline-none ring-1 ring-line focus:ring-2 focus:ring-signal" />
          <button onClick={send} disabled={!text.trim() || sending} aria-label="Send"
            className="btn-primary grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-40"><Send size={17} aria-hidden="true" /></button>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Right: the site feed

const LINE: Record<string, { icon: typeof Activity; verb: string; tone: string }> = {
  published: { icon: CheckCircle2, verb: 'published', tone: 'text-leaf' },
  removed: { icon: Ban, verb: 'removed', tone: 'text-berry' },
  restored: { icon: Undo2, verb: 'brought back', tone: 'text-leaf' },
  declined: { icon: XCircle, verb: 'declined', tone: 'text-muted' },
  hidden: { icon: EyeOff, verb: 'hid', tone: 'text-berry' },
  chat_hidden: { icon: MessageSquareOff, verb: 'hid a chat message', tone: 'text-berry' },
  report_handled: { icon: ShieldCheck, verb: 'handled a flag', tone: 'text-muted' },
  flag: { icon: Flag, verb: 'flagged', tone: 'text-berry' },
  report: { icon: Flag, verb: 'reported an entry', tone: 'text-sun' },
  game_started: { icon: Sparkles, verb: 'started a game:', tone: 'text-plum' },
  game_launched: { icon: Rocket, verb: 'launched', tone: 'text-plum' },
  first_draft: { icon: Users, verb: 'sent their first Draft:', tone: 'text-sky' },
};

/** Where a feed line goes: the Draft in its Workshop, the game, or its Workshop. */
function hrefOf(r: FeedRow) {
  if (!r.game_id) return undefined;
  if (r.kind === 'game_started' || r.kind === 'game_launched') return `/g/${r.game_id}`;
  if (r.draft_id) return `/g/${r.game_id}/workshop?draft=${r.draft_id}`;
  return `/g/${r.game_id}/workshop`;
}

function SiteFeed({ games }: { games: Map<string, GameRow> }) {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async (before?: string) => {
    const db = browserClient();
    if (!db) return [];
    const { data } = await db.rpc('staff_feed', { before: before ?? null, lim: 60 });
    return (data ?? []) as FeedRow[];
  }, []);

  useEffect(() => {
    let live = true;
    const load = () => fetchRows().then((r) => { if (live) { setRows((old) => [...r, ...old.filter((o) => o.at < (r[r.length - 1]?.at ?? ''))]); setMore(r.length >= 60); } });
    load();
    const t = setInterval(load, 30_000);
    return () => { live = false; clearInterval(t); };
  }, [fetchRows]);

  const older = async () => {
    const last = rows[rows.length - 1];
    if (!last || loading) return;
    setLoading(true);
    const r = await fetchRows(last.at);
    setLoading(false);
    setRows((old) => [...old, ...r]);
    setMore(r.length >= 60);
  };

  const shown = rows.filter((r) => filter === 'all' || FILTER_OF[r.kind] === filter);
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-lg leading-tight">Site feed</h2>
        <div className="chip-strip mt-2 flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
              className={'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ' + (filter === f.key ? 'bg-ink text-white ring-ink' : 'ring-line hover:ring-ink')}>{f.label}</button>
          ))}
        </div>
      </div>
      <ol className="thin-scroll min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">Nothing here yet.</li>}
        {shown.map((r, i) => {
          const l = LINE[r.kind] ?? { icon: Activity, verb: r.kind, tone: 'text-muted' };
          const Icon = l.icon;
          const href = hrefOf(r);
          const game = r.game_id ? games.get(r.game_id)?.title ?? r.game_id : null;
          const who = r.who_name ?? (r.kind === 'report' ? 'A visitor' : r.kind === 'game_launched' ? 'The village' : 'Someone');
          const what = r.kind === 'chat_hidden' || r.kind === 'flag' || r.kind === 'report_handled' || r.kind === 'report' ? null : r.title;
          const inner = (
            <>
              <Icon size={16} className={`mt-0.5 shrink-0 ${l.tone}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm leading-snug">
                <b>{who}</b> {l.verb}{what && <> <span className="font-bold">{what}</span></>}
                {r.kind === 'flag' && r.title && <span className="text-muted"> as {r.title}</span>}
                {r.kind === 'report_handled' && r.detail && <span className="text-muted"> ({r.detail})</span>}
                {(r.kind === 'chat_hidden' || r.kind === 'report') && r.title && <span className="block truncate text-muted">“{r.kind === 'report' ? (r.detail ?? (r.title === 'confirm' ? 'I can confirm' : 'Not quite')) : r.title}”</span>}
                {r.kind === 'declined' && r.detail && <span className="block truncate text-muted">{r.detail}</span>}
                <span className="block text-xs text-muted">{[game, ago(r.at)].filter(Boolean).join(' · ')}</span>
              </span>
              {href && <ArrowUpRight size={14} className="mt-1 shrink-0 text-muted" aria-hidden="true" />}
            </>
          );
          return (
            <li key={`${r.kind}-${r.at}-${i}`}>
              {href ? <Link href={href} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-card-2">{inner}</Link>
                : <div className="flex items-start gap-2.5 px-4 py-2.5">{inner}</div>}
            </li>
          );
        })}
        {more && rows.length > 0 && (
          <li className="px-4 py-3 text-center">
            <button onClick={older} disabled={loading} className="rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink disabled:opacity-50">{loading ? 'Loading…' : 'Older'}</button>
          </li>
        )}
      </ol>
    </>
  );
}
