'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, EyeOff, FileText, Flag, Hammer, MessageCircle, PanelLeftOpen, Plus,
  RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, TriangleAlert, X,
} from 'lucide-react';
import type { Page } from '@/data/pages';
import { BlockIcon, NavSymbol } from '@/components/Icon';
import { EntryDetails, EntryIcon, type RouteOption } from '@/components/app/EntryPanel';
import { entryText } from '@/components/app/entries';
import { rank } from '@/lib/search';
import { SignInPrompt } from '@/components/SignInPrompt';
import { ScrollRow } from '@/components/ScrollRow';
import { Tip } from '@/components/Tip';
import { ScrollBox } from '@/components/ScrollBox';
import { useStored } from '@/components/useStored';
import { Piece } from '@/components/Piece';
import { HOW_IT_WORKS_PING, HowItWorksButton, MarketDayButton } from '@/components/HowItWorks';
import { Avatar } from '@/components/Avatar';
import { useVillager, type Villager } from '@/components/useVillager';
import { useViewAsSetting } from '@/components/viewAs';
import { sortStandouts } from '@/lib/standouts';
import {
  REASONS, targetKey, useWorkshop,
  type LiveDraft, type ReportGroup, type WorkshopData,
} from './useWorkshop';
import { ChatLinks, MessageText, Stream, ThreadPanel, useThreads, type Placed } from './chat/Chat';
import { ago, ReportForm, SmallButton, useAction } from './chat/bits';
import { blockThread, draftThread, entryThread, threadOf, type ThreadKey } from '@/lib/threads';
import { mentionsIn } from '@/lib/refs';
import { EntryForm, ChangeList, type FormStart, type Posted } from './EntryForm';
import { FieldSetup } from './FieldSetup';
import { EditorChat, EditSwap } from './EditorShell';
import { useBeside } from './split';
import { sharePath } from '@/data/pages/links';
import { changesBetween } from './changes';
import { clearUnsent, readUnsent, saveUnsent, type Unsent } from './unsent';

type Sort = 'standouts' | 'new' | 'needs' | 'shipped';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'standouts', label: 'Standouts' },
  { key: 'new', label: 'New' },
  { key: 'needs', label: 'Needs votes' },
  { key: 'shipped', label: 'Published' },
];

const STATUS: Record<string, string> = {
  checking: 'Being checked', open: 'Open for votes', approved: 'Approved', preview: 'In Preview', stable: 'Published', declined: 'Declined', removed: 'Removed',
};


export function Workshop({ game, pages, routes }: {
  game: { id: string; shortTitle: string; title: string }; pages: Page[]; routes: RouteOption[];
}) {
  const params = useSearchParams();
  const blocks: Placed[] = useMemo(() => pages.flatMap((p) => p.blocks.map((b) => ({ ...b, page: p }))), [pages]);
  const placeOf = (blockKey: string) => blocks.find((b) => b.id === blockKey);

  // Arriving from the app: "Suggest a fix" (?fix=block.entry) or "Add" (?add=block).
  const linked = (() => {
    const fix = params.get('fix')?.split('.');
    if (fix && placeOf(fix[0])) return { blockId: fix[0], entryId: fix[1], field: params.get('field') ?? undefined, theory: params.get('theory') === '1' };
    const add = params.get('add');
    if (add && placeOf(add)) return { blockId: add };
    return null;
  })();
  const startPage = params.get('page') ?? (linked ? placeOf(linked.blockId)?.page.id : null);
  const [chip, setChip] = useState<string>(startPage && pages.some((p) => p.id === startPage) ? startPage : 'all');
  const [sort, setSort] = useState<Sort>('standouts');
  const [form, setForm] = useState<FormStart | null>(linked);
  // A Characters Block whose fields are being set up.
  const [setup, setSetup] = useState<string | null>(null);
  // The work column shows Drafts or what's in the app. Until you pick, it opens on Drafts
  // when something waits on you.
  const [tab, setTab] = useState<'drafts' | 'app' | null>(linked ? 'app' : null);
  // ?draft=… (from the app's "A fix is waiting" note) opens that Draft.
  const [detail, setDetail] = useState<string | null>(params.get('draft'));
  // ?msg=42 (a link to one chat message) jumps to it once the chat has loaded.
  const [pendingMsg, setPendingMsg] = useState<number | null>(Number(params.get('msg')) || null);
  const [jumpNote, setJumpNote] = useState('');
  const [posted, setPosted] = useState<Posted | null>(null);
  const [discarded, setDiscarded] = useState<Unsent | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Wide screens: the chat can fold to a thin strip, to give an editor more room.
  const [chatFolded, setChatFolded] = useStored('village:workshop:chat-folded', false);
  const [introDone, setIntroDone] = useStored('village:workshop:intro-seen', false);
  const [phoneTab, setPhoneTab] = useState<'work' | 'chat'>('work');
  // Smaller screens: the chat opened over an editor, as a side trip from it. It belongs to
  // that one edit, so closing the editor puts it away too.
  const [chatOver, setChatOver] = useState<string | null>(null);
  // The thread open beside the chat (src/lib/threads.ts). An editor opens its own thing's
  // thread, and closing the editor puts that one away again.
  const [thread, setThread] = useState<ThreadKey | null>(null);
  const [threadFromEdit, setThreadFromEdit] = useState(false);
  const beside = useBeside();
  const introRef = useRef<HTMLDivElement>(null);

  // Closing the "New here?" note sends it flying into the "How it works" button, so it's
  // clear where to find it again.
  const dismissIntro = () => {
    const note = introRef.current;
    const target = [...document.querySelectorAll<HTMLElement>('[data-howitworks]')].find((el) => el.offsetParent !== null);
    let finished = false;
    const done = () => { if (finished) return; finished = true; setIntroDone(true); window.dispatchEvent(new Event(HOW_IT_WORKS_PING)); };
    if (!note || !target || !note.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    const a = note.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    note.style.position = 'relative';
    note.style.zIndex = '60';
    note.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(0.4)`, opacity: 0.95, borderRadius: '999px', offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.05)`, opacity: 0, borderRadius: '999px' },
    ], { duration: 600, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)' }).onfinish = done;
    // Close it even where animations don't run (a background tab, some battery savers).
    setTimeout(done, 750);
  };
  // A Draft written but not sent (say, before signing in) waits on this device.
  const [unsent, setUnsent] = useState<Unsent | null>(null);
  const [restore, setRestore] = useState<Unsent | null>(null);
  const resumeUnsent = () => {
    const u = readUnsent(game.id);
    if (!u || !blocks.some((b) => b.id === u.blockId)) return;
    setRestore(u);
    setForm({ blockId: u.blockId, entryId: u.entryId });
    setChip(blocks.find((b) => b.id === u.blockId)!.page.id);
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
    setUnsent(readUnsent(game.id));
    if (new URLSearchParams(window.location.search).get('resume')) resumeUnsent();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the Workshop opens
  }, [game.id]);

  // Next keeps a visited Workshop alive in the background, so coming back through a new
  // "Suggest a fix" link doesn't start it fresh. Follow each new link as it arrives.
  const linkKey = `${params.get('fix') ?? ''}|${params.get('field') ?? ''}|${params.get('add') ?? ''}|${params.get('page') ?? ''}|${params.get('resume') ?? ''}|${params.get('draft') ?? ''}|${params.get('theory') ?? ''}|${params.get('msg') ?? ''}`;
  const [followed, setFollowed] = useState(linkKey);
  if (linkKey !== followed) {
    setFollowed(linkKey);
    if (startPage && pages.some((p) => p.id === startPage)) setChip(startPage);
    if (linked) { setForm(linked); setTab('app'); }
    if (params.get('resume')) resumeUnsent();
    if (params.get('draft')) setDetail(params.get('draft'));
    if (Number(params.get('msg'))) setPendingMsg(Number(params.get('msg')));
  }
  const me = useVillager();
  // A moderator seeing the site as someone else has a reminder pinned at the bottom; the
  // phone chat leaves room for it, so it never covers the message box.
  const viewingAs = useViewAsSetting() !== 'self';
  const live = useWorkshop(game.id, me);

  /** The app address of the entry a Draft fixed, for "Back to …". */
  const backTo = (p: Posted) => {
    const place = placeOf(p.blockId);
    const entry = place?.entries.find((e) => e.id === p.entryId);
    return place && entry ? sharePath(game.id, place.page, place, entry) : null;
  };
  const undoDiscard = () => {
    if (!discarded) return;
    saveUnsent(game.id, discarded);
    setDiscarded(null);
    resumeUnsent();
  };

  const closeForm = () => {
    setForm(null);
    setRestore(null);
    setUnsent(readUnsent(game.id));
    // Drop ?fix= and ?add= so a refresh doesn't reopen the form.
    const url = new URL(window.location.href);
    url.searchParams.delete('fix');
    url.searchParams.delete('field');
    url.searchParams.delete('theory');
    url.searchParams.delete('add');
    url.searchParams.delete('resume');
    window.history.replaceState({}, '', url); // a fresh state, so Next notices the change
  };

  const drafts = live.drafts;
  const pageOf = useMemo(() => new Map(blocks.map((b) => [b.id, b.page.id])), [blocks]);
  const onPage = (d: LiveDraft) => chip === 'all' || chip === 'notice' || pageOf.get(d.blockKey) === chip;
  const isOpen = (d: LiveDraft) => d.status === 'open' || d.status === 'checking';
  const counts = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, drafts.filter((d) => isOpen(d) && pageOf.get(d.blockKey) === p.id).length])), [pages, drafts, pageOf]);
  const visible = useMemo(() => {
    const list = drafts.filter((d) => chip === 'all' || pageOf.get(d.blockKey) === chip);
    if (sort === 'new') return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'needs') return list.filter((d) => d.status === 'open').sort((a, b) => a.viewers - b.viewers);
    if (sort === 'shipped') return list.filter((d) => d.status === 'stable');
    return sortStandouts(list.filter(isOpen));
  }, [drafts, chip, sort, pageOf]);

  // Every Draft here, most urgent for you first: ready to publish (moderators), your own,
  // then ones needing your vote.
  const items = useMemo(() => {
    const mine = (d: LiveDraft) => Boolean(me && !me.practice && d.author.id === me.id);
    const open = drafts.filter((d) => isOpen(d) && onPage(d));
    const ready = live.mod ? open.filter((d) => d.ups + d.downs >= 5 && d.ups > d.downs) : [];
    const needs = open.filter((d) => !mine(d) && d.myVote === 0 && !ready.includes(d))
      .sort((a, b) => (a.ups + a.downs) - (b.ups + b.downs) || a.createdAt.localeCompare(b.createdAt));
    const yours = drafts.filter((d) => mine(d) && onPage(d) && d.status !== 'removed')
      .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    const voted = open.filter((d) => !mine(d) && d.myVote !== 0 && !ready.includes(d));
    return [
      ...ready.map((d) => ({ d, kind: 'ready' as const })),
      ...yours.filter(isOpen).map((d) => ({ d, kind: 'yours' as const })),
      ...needs.map((d) => ({ d, kind: 'vote' as const })),
      ...voted.map((d) => ({ d, kind: 'voted' as const })),
      ...yours.filter((d) => !isOpen(d)).map((d) => ({ d, kind: 'yours' as const })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPage reads chip and pageOf
  }, [drafts, me, live.mod, chip, pageOf]);

  const current = pages.find((p) => p.id === chip);
  const chat = useMemo(() => (current ? live.messages.filter((m) => m.blockKey === current.id) : live.messages), [live.messages, current]);
  const startNew = () => setForm({ blockId: current?.blocks[0]?.id ?? blocks[0]?.id });

  // First steps for a new Builder. Each is one tap to start, and ticks itself off once done.
  const myId = me && !me.practice ? me.id : null;
  const firstVote = items.find((x) => x.kind === 'vote')?.d;
  const steps = [
    {
      key: 'vote', title: 'Vote on something waiting',
      hint: firstVote ? `Like “${firstVote.title}”. Does it match your game?` : 'Nothing is waiting right now. Check back later.',
      done: Boolean(myId && drafts.some((d) => d.myVote !== 0)), go: () => { if (firstVote) setDetail(firstVote.id); },
    },
    {
      key: 'fix', title: 'Fix or add something you know',
      hint: 'Pick anything in the app to fix, or start something new.',
      done: Boolean(myId && drafts.some((d) => d.author.id === myId)), go: () => setTab('app'),
    },
    {
      key: 'chat', title: 'Say hi, or ask the village',
      hint: "Stuck on something, or found something? Chat's the place.",
      done: Boolean(myId && live.messages.some((m) => m.author.id === myId)),
      go: () => { setPhoneTab('chat'); setChatFolded(false); setTimeout(() => document.getElementById('chat-input')?.focus(), 60); },
    },
  ];
  const basicsDone = steps.every((x) => x.done);
  const shown = detail ? drafts.find((d) => d.id === detail) : undefined;

  // What waits on you: ready to publish, your own open Drafts, and ones needing your vote.
  const waiting = items.filter((x) => x.kind === 'ready' || x.kind === 'vote' || (x.kind === 'yours' && isOpen(x.d)));
  const waitingIds = new Set(waiting.map((x) => x.d.id));
  const matches = (d: LiveDraft) => !query || d.title.toLowerCase().includes(query.toLowerCase());
  const rest = visible.filter((d) => !waitingIds.has(d.id) && matches(d));
  const view = tab ?? (live.state === 'loading' || waiting.length > 0 ? 'drafts' : 'app');
  const workSubtitle = view === 'drafts' ? (waiting.length ? `Drafts · ${waiting.length} waiting on you` : 'Drafts') : 'In the app';
  const tint = current ? `var(--${current.tint}-soft)` : 'var(--card)';

  // An editor opens in the work column, so on wide screens the chat stays beside it.
  const editBlock = form ? blocks.find((b) => b.id === form.blockId) : undefined;
  const setupBlock = setup ? blocks.find((b) => b.id === setup) : undefined;
  const editing = form && blocks.length > 0 ? 'form' : setupBlock ? 'setup' : null;
  const editLabel = editing === 'form'
    ? (form?.entryId ? `Fix: ${editBlock?.entries.find((e) => e.id === form.entryId)?.name ?? 'an entry'}` : `New in ${editBlock?.title ?? 'the app'}`)
    : setupBlock ? `Set up ${setupBlock.title}` : '';
  const editKey = editing ? `${editing}:${form?.blockId}.${form?.entryId}:${setup}` : null;

  // Threads: what each is about, and the one open beside the chat.
  const threads = useThreads(blocks, drafts, live.messages);
  const editEntry = editing === 'form' && form?.entryId ? editBlock?.entries.find((e) => e.id === form.entryId) : undefined;
  const editThread = editEntry && editBlock ? entryThread(editBlock.id, editEntry) : editing === 'setup' && setupBlock ? blockThread(setupBlock.id) : null;
  const [followedEdit, setFollowedEdit] = useState<ThreadKey | null>(null);
  if (editThread !== followedEdit) {
    setFollowedEdit(editThread);
    if (editThread) { setThread(editThread); setThreadFromEdit(true); }
    else if (threadFromEdit) { setThread(null); setThreadFromEdit(false); }
  }
  /** Opens a thread. Over an editor on a phone, it stays in the chat that's over the edit. */
  const openThread = (key: ThreadKey, overEdit = false) => {
    setThread(threads.resolve(key));
    setThreadFromEdit(false);
    setDetail(null);
    setChatFolded(false);
    if (!overEdit) setPhoneTab('chat');
  };
  const threadInfo = thread ? threads.info(thread) : null;
  const threadMessages = thread ? threads.inThread(thread) : [];

  /**
   * Shows one message: opens the chat (and its thread, if it's in one), scrolls to it and
   * flashes it. Fetches it first if it's older than the newest 300.
   */
  const jump = async (id: number) => {
    const m = live.messages.find((x) => x.id === id) ?? await live.loadMessage(id);
    if (!m) { setJumpNote('That message is no longer here.'); setTimeout(() => setJumpNote(''), 4000); return; }
    const key = threadOf(m, threads.byId);
    if (key) openThread(key);
    else { setThread(null); setDetail(null); setChatFolded(false); setPhoneTab('chat'); }
    setTimeout(() => {
      const el = document.getElementById(`msg-${id}`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.animate?.([{ backgroundColor: 'color-mix(in srgb, var(--signal) 40%, transparent)' }, { backgroundColor: 'transparent' }], { duration: 1800 });
    }, 400);
  };
  useEffect(() => {
    if (!pendingMsg || live.state !== 'ready') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- following a link once the chat has loaded
    setPendingMsg(null);
    jump(pendingMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jump reads the latest chat
  }, [pendingMsg, live.state]);
  // Mentions of you since you last had the chat open (on this device): a small "@" badge on the
  // way into the chat, until you look.
  const [mentionsSeen, setMentionsSeen] = useStored(`village:${game.id}:mentions-seen`, '');
  const unseenMentions = myId ? live.messages.filter((m) => m.author.id !== myId && m.createdAt > mentionsSeen && mentionsIn(m.body).includes(myId)).length : 0;
  const chatShowing = phoneTab === 'chat' || (beside && !chatFolded);
  useEffect(() => {
    if (chatShowing && unseenMentions) setMentionsSeen(new Date().toISOString());
  }, [chatShowing, unseenMentions, setMentionsSeen]);
  const mentionBadge = unseenMentions > 0 && (
    <span aria-label={`${unseenMentions} new mention${unseenMentions === 1 ? '' : 's'} of you`}
      className="ml-1 rounded-full bg-signal px-1.5 text-xs font-bold text-ink">@{unseenMentions}</span>
  );
  // Phones show the chat or the work, one at a time. The switch between them sits at the top
  // right of whichever is showing, in the same spot, so the chat gets the whole height.
  const phoneSwitch = (
    <div role="tablist" aria-label="Build or chat" className="inline-flex shrink-0 rounded-full bg-card-2 p-0.5 ring-1 ring-line lg:hidden">
      {([['work', 'Build'], ['chat', `Chat · ${chat.length}`]] as const).map(([k, label]) => (
        <button key={k} role="tab" aria-selected={phoneTab === k} onClick={() => setPhoneTab(k)}
          className={'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold ' + (phoneTab === k ? 'bg-ink text-paper' : 'text-muted')}>{label}{k === 'chat' && mentionBadge}</button>
      ))}
    </div>
  );
  const threadPanel = (extra: { onBack?: () => void; switcher?: React.ReactNode; bar?: React.ReactNode; className?: string }) => threadInfo && (
    <ThreadPanel info={threadInfo} messages={threadMessages} me={me} live={live} gameId={game.id} onDraft={setDetail}
      onEdit={threadInfo.key === editThread || !threadInfo.block ? undefined
        : threadInfo.kind === 'setup' ? () => setSetup(threadInfo.block!.id)
        : threadInfo.kind === 'entry' && threadInfo.entry ? () => setForm({ blockId: threadInfo.block!.id, entryId: threadInfo.entry!.id })
        : undefined}
      {...extra} />
  );
  const chatCount = threadInfo ? threadMessages.filter((m) => !m.removed).length : chat.length;

  return (
    <ChatLinks.Provider value={{ gameId: game.id, threads, open: openThread, routes, me: myId, jump }}>
    {/* On phones the Chat tab fills the screen like the wide layout: messages scroll inside it
        and the message box stays at the bottom (page.tsx sizes the screen from data-phone-chat). */}
    <main data-phone-chat={phoneTab === 'chat' || undefined}
      className={'mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 pb-6 pt-5 sm:px-6 lg:min-h-0 lg:pb-4 lg:pt-4 max-lg:data-[phone-chat]:min-h-0 '
        + (viewingAs ? 'max-lg:data-[phone-chat]:pb-20' : 'max-lg:data-[phone-chat]:pb-3')}>
      {/* The Workshop's name and guides. The ink bar above (page.tsx) has the way out and your account. */}
      {/* On a short phone screen (the keyboard is up) the chat needs the room: the title and the
          Page chips step aside while the Chat tab is open. */}
      <header className="flex flex-wrap items-center gap-3 max-lg:in-data-[phone-chat]:[@media(max-height:560px)]:hidden">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Workshop</p>
          <h1 className="font-display text-2xl leading-tight">{game.shortTitle}</h1>
        </div>
        <MarketDayButton className="hidden bg-sun-soft text-sun sm:inline-flex" />
        <HowItWorksButton className="hidden sm:inline-flex" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <HowItWorksButton compact className="inline-flex sm:hidden" />
        </div>
      </header>

      {/* The Pages: a symbol each, the chosen one in a piece */}
      <ScrollRow as="nav" label="Pages" className="-mx-4 mt-3 flex shrink-0 gap-2 px-4 pb-2 pt-1 max-lg:in-data-[phone-chat]:[@media(max-height:560px)]:hidden">
        <BlockChip on={chip === 'all'} tint="ink" icon="LayoutGrid" label="Everything" count={drafts.filter(isOpen).length} onClick={() => setChip('all')} />
        {pages.map((p) => (
          <BlockChip key={p.id} on={chip === p.id} tint={p.tint} icon={p.icon} label={p.title} count={counts[p.id]} onClick={() => setChip(p.id)} />
        ))}
        <BlockChip on={chip === 'notice'} tint="muted" icon="Megaphone" label="Notice Board" count={live.mod ? live.reports.length : 0} onClick={() => setChip('notice')} />
      </ScrollRow>

      {jumpNote && <p role="status" className="mt-3 rounded-2xl bg-card-2 px-4 py-2 text-sm ring-1 ring-line">{jumpNote}</p>}
      {live.state === 'offline' && (
        <p role="status" className="mt-3 rounded-2xl bg-berry-soft px-4 py-3 text-sm text-berry">Couldn&apos;t reach the village just now. Refresh the page to try again.</p>
      )}

      {/* Two columns that fill the screen on wide ones, each scrolling on its own: the chat, and
          the work (Drafts, what's in the app, or an open editor). On phones, one at a time. */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {chatFolded && (
          <div className="hidden shrink-0 lg:flex">
          <Tip text="Open the chat" tint="sky">
            <button onClick={() => setChatFolded(false)} aria-label={`Open the chat, ${chat.length} messages`}
              className="flex h-full w-12 flex-col items-center gap-3 rounded-2xl bg-card py-3 ring-1 ring-line hover:ring-ink">
              <PanelLeftOpen size={18} aria-hidden="true" />
              <MessageCircle size={18} className="text-sky" aria-hidden="true" />
              <span className="text-xs font-bold">{chat.length}</span>
              {mentionBadge}
            </button>
          </Tip>
          </div>
        )}
        {/* The stream, and beside it the open thread. Where both don't fit (below the widest
            screens, on phones, and whenever an editor needs the room for its preview) the
            thread takes the stream's place, with a way back. */}
        <div className={(phoneTab === 'chat' && !threadInfo ? 'flex' : 'hidden') + ' min-h-0 min-w-0 flex-1 flex-col gap-2 lg:w-80 lg:flex-none lg:shrink-0 2xl:w-96 '
          + (chatFolded ? 'lg:hidden' : threadInfo ? (editing ? 'lg:hidden' : 'lg:hidden 2xl:flex') : 'lg:flex')}>
          <Stream
            topic={current ? { key: current.id, label: current.title } : null}
            onAll={() => setChip('all')}
            onFold={() => setChatFolded(true)}
            switcher={phoneSwitch}
            messages={chat}
            me={me}
            live={live}
            threads={threads}
            onOpen={openThread}
          />
        </div>
        {threadInfo && (
          <div className={(phoneTab === 'chat' ? 'flex' : 'hidden') + ' min-h-0 min-w-0 flex-1 flex-col gap-2 lg:w-80 lg:flex-none lg:shrink-0 2xl:w-96 ' + (chatFolded ? 'lg:hidden' : 'lg:flex')}>
            {threadPanel({ onBack: () => setThread(null), switcher: phoneSwitch })}
          </div>
        )}

        <div className={(phoneTab === 'work' ? 'flex' : 'hidden') + ' min-w-0 flex-1 flex-col lg:flex lg:min-h-0'}>
          {editing ? (
            <EditorChat.Provider value={{ count: chatCount, open: () => setChatOver(editKey) }}>
              {editing === 'form' ? (
                <EntryForm gameId={game.id} pages={pages} routes={routes} start={form!} restore={restore} me={me} postDraft={live.postDraft}
                  onClose={closeForm}
                  onPosted={(p) => {
                    closeForm();
                    setChip(p.pageId);
                    setPosted(p);
                  }}
                  onDiscard={() => {
                    // Keep a copy for Undo; it's gone for good once the note is closed.
                    const copy = readUnsent(game.id);
                    clearUnsent(game.id);
                    closeForm();
                    if (copy) setDiscarded(copy);
                  }} />
              ) : (
                <FieldSetup gameId={game.id} block={setupBlock!} routes={routes} canSave={live.mod} onClose={() => setSetup(null)} />
              )}
            </EditorChat.Provider>
          ) : (
          // With a Page chosen, this column is that Page's color field, and its Drafts and
          // Blocks sit on it as white panels.
          <section aria-label="Work" style={current ? { background: tint } : undefined}
            className={'relative flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-2xl px-4 pb-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain ' + (current ? '' : 'bg-card ring-1 ring-line')}>
            {chip === 'notice' ? (
              <>
                <h2 className="pt-4 font-display text-xl">Notice Board</h2>
                {live.mod ? <ReportQueue live={live} blocks={blocks} /> : (
                  <Empty title="No reports waiting" body="When players tap “not quite” in the app without signing in, their report waits here until a villager confirms it." />
                )}
              </>
            ) : (
              <>
                {/* Stays in reach while the column scrolls. */}
                <div className="z-10 -mx-4 px-4 pb-2 pt-4 lg:sticky lg:top-0" style={{ background: tint }}>
                  {/* Phones: the Build / Chat switch at the top right, and the tools on the line below,
                      beside what's showing. Wide screens keep it all on one row. */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    {searching ? (
                      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-card-2 px-3 py-1.5 text-sm ring-2 ring-sky">
                        <Search size={15} className="text-muted" aria-hidden="true" />
                        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearching(false); } }}
                          placeholder={view === 'drafts' ? 'Find a Draft' : current ? `Find something in ${current.title}` : 'Find anything in the app'} aria-label="Search"
                          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
                        <button type="button" onClick={() => { setQuery(''); setSearching(false); }} aria-label="Close search" className="grid size-6 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
                          <X size={14} aria-hidden="true" />
                        </button>
                      </label>
                    ) : (
                      <>
                        {current && <span className="hidden shrink-0 sm:block"><Piece size={48} color={`var(--${current.tint})`}><BlockIcon name={current.icon} size={15} strokeWidth={2.4} /></Piece></span>}
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate font-display text-xl leading-tight" title={current?.title}>{current ? current.title : 'Everything'}</h2>
                          <p className="hidden truncate text-xs font-bold text-muted lg:block">{workSubtitle}</p>
                        </div>
                      </>
                    )}
                    {phoneSwitch}
                    <div className="flex basis-full items-center justify-end gap-2 lg:contents">
                    {!searching && (
                      <>
                        <p className="min-w-0 flex-1 truncate text-xs font-bold text-muted lg:hidden">{workSubtitle}</p>
                        <Tip text={view === 'drafts' ? 'Search these Drafts' : "Search this Page's entries"} tint="sky" className="shrink-0">
                          <button onClick={() => setSearching(true)} aria-label="Search"
                            className="grid size-9 place-items-center rounded-full bg-card ring-1 ring-line hover:ring-ink">
                            <Search size={16} aria-hidden="true" />
                          </button>
                        </Tip>
                      </>
                    )}
                    {/* Two views of one Page: the changes people have suggested (paper), and what's in
                        the app now, to fix or add to (hammer). */}
                    <div role="tablist" aria-label="Show" className="inline-flex shrink-0 rounded-full bg-card p-0.5 ring-1 ring-line">
                      <Tip text={waiting.length ? `Drafts: ${waiting.length} waiting on you` : 'Drafts: changes villagers have suggested'}>
                        <button role="tab" aria-selected={view === 'drafts'} onClick={() => setTab('drafts')} aria-label="Drafts"
                          className={'relative grid size-8 place-items-center rounded-full ' + (view === 'drafts' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
                          <FileText size={16} aria-hidden="true" />
                          {waiting.length > 0 && (
                            <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-signal px-1 text-[10px] font-bold leading-4 text-ink ring-2 ring-card">{waiting.length}</span>
                          )}
                        </button>
                      </Tip>
                      <Tip text="In the app: what's there now, to fix or add to">
                        <button role="tab" aria-selected={view === 'app'} onClick={() => setTab('app')} aria-label="In the app"
                          className={'grid size-8 place-items-center rounded-full ' + (view === 'app' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
                          <Hammer size={16} aria-hidden="true" />
                        </button>
                      </Tip>
                    </div>
                    <Tip text="Add something new to the app" tint="leaf" className="shrink-0">
                      <button onClick={startNew} aria-label="New" className="btn-primary inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-bold sm:px-3">
                        <Plus size={16} aria-hidden="true" /> <span className="hidden sm:inline">New</span>
                      </button>
                    </Tip>
                    </div>
                  </div>

                </div>

                {!introDone && (
                  <div ref={introRef} className="mt-3 rounded-2xl bg-sky-soft px-3 py-2.5 text-sm">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1">
                        <span className="font-bold text-sky">{basicsDone ? 'You’ve got the basics.' : 'Start here.'}</span>{' '}
                        {basicsDone ? 'Welcome to the village! Close this whenever you like.' : 'Anyone can help. Villagers check each change, and on Market Day it goes into the app.'}
                      </p>
                      <button onClick={dismissIntro} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <ol className="mt-2 grid gap-1.5">
                      {steps.map((x, i) => (
                        <li key={x.key}>
                          <button onClick={x.go} className="flex w-full items-center gap-2.5 rounded-xl bg-card px-2.5 py-2 text-left ring-1 ring-line hover:ring-sky">
                            <span className={'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ' + (x.done ? 'bg-leaf text-white' : 'bg-sky-soft text-sky')}>
                              {x.done ? <Check size={13} aria-hidden="true" /> : i + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={'block font-bold leading-tight ' + (x.done ? 'text-muted line-through' : '')}>{x.title}</span>
                              <span className="block text-xs text-muted">{x.hint}</span>
                            </span>
                            {!x.done && <ArrowRight size={15} className="shrink-0 text-muted" aria-hidden="true" />}
                          </button>
                        </li>
                      ))}
                    </ol>
                    <HowItWorksButton className="mt-2 inline-flex !py-0.5 text-xs" />
                  </div>
                )}

                {/* Stays until you close it, with a way back to the entry and to your Draft. */}
                {posted && (
                  <div role="status" className="rise mt-3 grid gap-2 rounded-2xl bg-leaf-soft px-3 py-2.5 text-sm text-leaf">
                    <p className="flex items-start gap-2">
                      <Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="flex-1">Your Draft for <span className="font-bold">{posted.name}</span> is in. It waits for votes from other Builders, then a moderator publishes it to the app on Market Day.</span>
                      <button onClick={() => setPosted(null)} aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-card"><X size={14} aria-hidden="true" /></button>
                    </p>
                    <div className="flex flex-wrap gap-2 pl-6">
                      {posted.draftId && (
                        <button onClick={() => setDetail(posted.draftId!)} className="btn-primary rounded-full px-3 py-1 text-xs font-bold">See my Draft</button>
                      )}
                      {backTo(posted) && (
                        <a href={backTo(posted)!} className="rounded-full bg-card px-3 py-1 text-xs font-bold text-leaf ring-1 ring-leaf/40">Back to {posted.name}</a>
                      )}
                    </div>
                  </div>
                )}

                {discarded && (
                  <p role="status" className="rise mt-3 flex items-center gap-2 rounded-2xl bg-card-2 px-3 py-2 text-sm ring-1 ring-line">
                    <span className="flex-1">Discarded{discarded.content.name.trim() ? ` “${discarded.content.name.trim()}”` : ''}.</span>
                    <button onClick={undoDiscard} className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">Undo</button>
                    <button onClick={() => setDiscarded(null)} aria-label="Dismiss" className="grid size-6 place-items-center rounded-full text-muted hover:bg-card"><X size={14} aria-hidden="true" /></button>
                  </p>
                )}

                {unsent && !form && (
                  <div role="status" className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-sun-soft px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-bold">Unsent Draft:</span> {unsent.content.name.trim() || 'Untitled'}
                      <span className="text-muted"> · {placeOf(unsent.blockId)?.title ?? 'a Block'}</span>
                    </span>
                    <button onClick={resumeUnsent} className="btn-primary rounded-full px-3 py-1 text-xs font-bold">Continue</button>
                    <button onClick={() => { clearUnsent(game.id); setUnsent(null); }} className="rounded-full px-2 py-1 text-xs font-bold text-muted hover:text-ink">Discard</button>
                  </div>
                )}
                {view === 'drafts' ? (
                  live.state === 'loading' ? (
                    <div className="mt-3 grid gap-3" aria-hidden="true">{[0, 1].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-card" />)}</div>
                  ) : (
                    <>
                      {waiting.some((x) => matches(x.d)) && (
                        <>
                          <Tip text={me ? 'Your vote, your own Drafts, or ready to publish' : 'Sign in to vote on these'} className="mt-3 self-start">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted">{me ? 'Waiting on you' : 'Open for votes'} · {waiting.length}</p>
                          </Tip>
                          <ul className="mt-2 grid gap-3">
                            {waiting.filter((x) => matches(x.d)).map(({ d }) => (
                              <DraftCard key={d.id} draft={d} place={placeOf(d.blockKey)} routes={routes} me={me}
                                chatCount={threads.counts.get(draftThread(d)) ?? 0} onChat={() => openThread(draftThread(d))} live={live} />
                            ))}
                          </ul>
                        </>
                      )}
                      <div className="mt-5 flex items-center gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">{waiting.length ? 'Everything else' : 'All Drafts'}</p>
                        <label className="ml-auto">
                          <span className="sr-only">Sort Drafts</span>
                          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line">
                            {SORTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                          </select>
                        </label>
                      </div>
                      {rest.length > 0 ? (
                        <ul className="mt-3 grid gap-3">
                          {rest.map((d) => (
                            <DraftCard key={d.id} draft={d} place={placeOf(d.blockKey)} routes={routes} me={me}
                              chatCount={threads.counts.get(draftThread(d)) ?? 0} onChat={() => openThread(draftThread(d))} live={live} />
                          ))}
                        </ul>
                      ) : waiting.length > 0 ? (
                        <p className="mt-2 text-sm text-muted">Nothing else here{sort === 'shipped' ? ' published yet' : ''}.</p>
                      ) : (
                        <Empty title={sort === 'shipped' ? 'Nothing published yet' : 'No Drafts here yet'}
                          body={sort === 'shipped' ? 'Drafts land here once a moderator publishes them to the app.' : 'Spotted something missing or wrong? Find it under In the app, or start something new.'}
                          action={sort === 'shipped' ? undefined : <button onClick={() => setTab('app')} className="rounded-full bg-card px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">See what&apos;s in the app</button>} />
                      )}
                    </>
                  )
                ) : (
                  <AppContents pages={current ? [current] : pages} drafts={drafts} query={query} focus={form?.entryId ? `${form.blockId}.${form.entryId}` : undefined}
                    onFix={(blockId, entryId) => setForm({ blockId, entryId })} onAdd={(blockId) => setForm({ blockId })} onSetup={setSetup}
                    onDrafts={(cardId) => { const d = drafts.find((x) => x.cardId === cardId && isOpen(x)); if (d) setDetail(d.id); }} />
                )}
              </>
            )}
          </section>
          )}
        </div>
      </div>

      {/* On smaller screens the chat opens over the editor, with the same switch in the same
          place, so it feels like flipping between the two rather than leaving the edit. */}
      {editing && !beside && chatOver === editKey && (
        <div role="dialog" aria-modal="true" aria-label="Chat" className="rise fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-card"
          onKeyDown={(e) => { if (e.key === 'Escape') setChatOver(null); }}>
          {threadInfo ? threadPanel({
            onBack: () => setThread(null),
            bar: <EditSwap on="chat" count={chatCount} editLabel={`Back to ${editLabel}`} onEdit={() => setChatOver(null)} />,
            className: 'rounded-none px-4 pb-4 pt-2.5 ring-0',
          }) : (
            <Stream
              topic={current ? { key: current.id, label: current.title } : null}
              onAll={() => setChip('all')}
              bar={<EditSwap on="chat" count={chatCount} editLabel={`Back to ${editLabel}`} onEdit={() => setChatOver(null)} />}
              className="rounded-none px-4 pb-4 pt-2.5 ring-0"
              messages={chat}
              me={me}
              live={live}
              threads={threads}
              onOpen={(k) => openThread(k, true)}
            />
          )}
        </div>
      )}

      {shown && (
        <Sheet label={shown.title} onClose={() => setDetail(null)}>
          <ul>
            <DraftCard draft={shown} place={placeOf(shown.blockKey)} routes={routes} me={me} startOpen
              chatCount={threads.counts.get(draftThread(shown)) ?? 0} onChat={() => openThread(draftThread(shown))} live={live} />
          </ul>
        </Sheet>
      )}
    </main>
    </ChatLinks.Provider>
  );
}

/** A Page in the row across the top: its symbol in its color, in a piece when chosen, and how many Drafts wait there. */
function BlockChip({ on, tint, icon, label, count, onClick }: {
  on: boolean; tint: string; icon: string; label: string; count?: number; onClick: () => void;
}) {
  return (
    <Tip text={count ? `${count} open Draft${count === 1 ? '' : 's'} waiting here` : 'Nothing waiting here right now'} tint={tint} className="shrink-0">
    <button onClick={onClick} aria-pressed={on}
      style={on ? { background: `color-mix(in srgb, var(--${tint}) 10%, white)`, boxShadow: `inset 0 0 0 1.5px var(--${tint})` } : undefined}
      className={'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1.5 pr-3.5 text-sm ' + (on ? 'font-extrabold' : 'bg-card font-bold ring-1 ring-line hover:ring-ink')}>
      <NavSymbol name={icon} color={`var(--${tint})`} on={on} size={38} />
      {label}
      {count ? <span className="grid min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-paper">{count}</span> : null}
    </button>
    </Tip>
  );
}

/** A Draft opened on its own: a sheet on phones, a centered panel on computers. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="rise max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-card p-4 shadow-soft outline-none sm:rounded-[2rem] sm:p-5">
        <div className="mb-2 flex justify-end">
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-card-2 ring-1 ring-line"><X size={18} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="m-auto grid max-w-xs justify-items-center gap-3 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-leaf-soft text-leaf"><Sparkles aria-hidden="true" /></span>
      <h3 className="font-display text-xl">{title}</h3>
      <p className="text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

/** Moderator buttons for a Draft: approve, decline with a reason, remove, or reopen. */
function DraftModTools({ draft, live }: { draft: LiveDraft; live: WorkshopData }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const { run, busy, error } = useAction();
  const decide = (status: 'declined' | 'removed' | 'open', why?: string) =>
    run(() => live.moderate.decide(draft.id, status, why)).then((ok) => { if (ok) { setDeclining(false); setReason(''); } });
  const publish = () => run(() => live.moderate.publish(draft.id));
  const undecided = draft.status === 'open' || draft.status === 'checking';
  return (
    <div className="mt-3 rounded-2xl bg-sun-soft/60 p-2.5 ring-1 ring-sun/30">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-sun"><ShieldCheck size={14} aria-hidden="true" /> Moderator</span>
        {undecided ? (
          <>
            <Tip text="Puts it in the app now, as the entry's new version. Earlier versions are kept" tint="leaf"><SmallButton tone="good" disabled={busy} onClick={publish} icon={<Check size={13} aria-hidden="true" />}>{busy ? 'Publishing…' : 'Approve and publish'}</SmallButton></Tip>
            <Tip text="Say no, with a short reason everyone sees"><SmallButton disabled={busy} onClick={() => setDeclining(!declining)} icon={<X size={13} aria-hidden="true" />}>Decline</SmallButton></Tip>
            <Tip text="Hide it completely. For spam or abuse" tint="berry"><SmallButton tone="bad" disabled={busy} onClick={() => decide('removed')} icon={<Trash2 size={13} aria-hidden="true" />}>Remove</SmallButton></Tip>
          </>
        ) : draft.status === 'stable' ? (
          <span className="text-xs text-muted">Published to the app.</span>
        ) : (
          <SmallButton disabled={busy} onClick={() => decide('open')} icon={<RotateCcw size={13} aria-hidden="true" />}>
            {draft.status === 'removed' ? 'Restore' : 'Reopen for votes'}
          </SmallButton>
        )}
      </div>
      {declining && (
        <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); decide('declined', reason); }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus placeholder="Why? The author and everyone will see this."
            className="min-w-0 flex-1 rounded-full bg-card px-3 py-1.5 text-sm ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky" />
          <button disabled={busy || !reason.trim()} className="rounded-full bg-ink px-3 py-1.5 text-sm font-bold text-paper disabled:opacity-50">Decline</button>
        </form>
      )}
      {error && <p role="status" className="mt-1.5 text-sm text-berry">{error}</p>}
    </div>
  );
}

function DraftCard({ draft, place, routes, me, chatCount, onChat, live, startOpen = false }: {
  draft: LiveDraft; place?: Placed; routes: RouteOption[]; me: Villager | null | undefined;
  /** Messages in the thread this Draft belongs to (its entry's, or its own for a new entry). */
  chatCount: number; onChat: () => void;
  live: WorkshopData; startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState('');
  if (!place) return null;
  const block = place;
  const stable = draft.cardId ? block.entries.find((e) => e.ref?.card === draft.cardId) : undefined;
  const changes = stable && draft.status !== 'stable' ? changesBetween(stable, draft.content, block, routes) : [];
  const mine = me?.id === draft.author.id && !me.practice;
  const practiceVote = Boolean(me?.practice && me.id === draft.author.id);
  const reported = live.myReports.has(targetKey({ draftId: draft.id }));
  const total = draft.ups + draft.downs;
  const leaning = total === 0 ? 'no votes yet' : draft.ups >= draft.downs ? 'leaning yes' : 'leaning no';
  const cast = async (v: 0 | 1 | -1) => setError((await live.vote(draft.id, v)) ?? '');
  const expand = () => { if (!open) live.view(draft.id); setOpen(!open); };
  // Yellow marks a Draft that's waiting on your vote ("act on this").
  const needsVote = Boolean(me && !mine && !draft.myVote && (draft.status === 'open' || draft.status === 'checking'));

  const voting = !me ? null : mine ? (
    <span className="text-sm text-muted">Your Draft · {total >= 5 ? `${draft.ups} yes · ${draft.downs} no` : leaning}{draft.practiceVote ? ' (includes your practice vote)' : ''}</span>
  ) : draft.kind === 'fact' ? (
    <>
      <Tip text="You've seen this in your own game, and it's right" tint="leaf"><VoteButton on={draft.myVote === 1} onClick={() => cast(draft.myVote === 1 ? 0 : 1)} icon={<Check size={15} aria-hidden="true" />}>I can confirm</VoteButton></Tip>
      <Tip text="Something here doesn't match your game" tint="berry"><VoteButton on={draft.myVote === -1} onClick={() => cast(draft.myVote === -1 ? 0 : -1)} icon={<TriangleAlert size={15} aria-hidden="true" />}>Seems wrong</VoteButton></Tip>
    </>
  ) : (
    <>
      <VoteButton on={draft.myVote === 1} onClick={() => cast(draft.myVote === 1 ? 0 : 1)} icon={<ArrowUp size={15} aria-hidden="true" />} label="Vote up" />
      <span className="text-sm text-muted">{total >= 5 ? `${draft.ups} up · ${draft.downs} down` : leaning}</span>
      <VoteButton on={draft.myVote === -1} onClick={() => cast(draft.myVote === -1 ? 0 : -1)} icon={<ArrowDown size={15} aria-hidden="true" />} label="Vote down" />
    </>
  );

  return (
    <li className={'rise rounded-3xl bg-card p-3 ' + (needsVote ? 'ring-1 ring-ink/40 ' : 'ring-1 ring-line ') + (draft.status === 'removed' ? 'opacity-60' : '')}>
      <button onClick={expand} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <EntryIcon entry={draft.content} block={block} size="sm" color={`var(--${block.page.tint})`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg leading-tight">{draft.title}</span>
            {draft.cardId
              ? <Tip text="Changes an entry that's already in the app" tint="sky"><span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs font-bold text-sky">fix</span></Tip>
              : <Tip text="A new entry for the app" tint="leaf"><span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-bold text-leaf">new</span></Tip>}
            {draft.theory && <Tip text="Not confirmed yet. Shown with a Theory label in the app" tint="sun"><span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold text-sun">Theory</span></Tip>}
            {needsVote && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-ink ring-1 ring-ink">Needs your vote</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Avatar name={draft.author.name} url={draft.author.avatarUrl} size={18} />
            {block.page.title === block.title ? block.title : `${block.page.title} · ${block.title}`} · {draft.author.name} · {ago(draft.createdAt)} · {STATUS[draft.status] ?? draft.status}
          </span>
        </span>
      </button>
      {draft.status === 'declined' && draft.declineReason && (
        <p className="mt-2 rounded-2xl bg-card-2 px-3 py-2 text-sm ring-1 ring-line"><span className="font-bold">Declined:</span> {draft.declineReason}</p>
      )}
      {open && (
        <div className="mt-3 grid gap-2">
          {changes.length > 0 && (
            <div className="rounded-2xl bg-card-2 p-3 ring-1 ring-line">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">What changes</p>
              <ChangeList changes={changes} />
            </div>
          )}
          {draft.cardId && !stable && draft.status !== 'stable' && <p className="text-sm text-muted">The entry this fixes is no longer in the app.</p>}
          <div className="rounded-2xl bg-card-2 p-3 ring-1 ring-line"><EntryDetails entry={draft.content} block={block} route="all" routes={routes} color={`var(--${block.page.tint})`} /></div>
          {draft.source && <p className="text-sm text-muted"><span className="font-bold text-ink">Source:</span> {draft.source}</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {me === null ? <SignInPrompt>Sign in to vote</SignInPrompt> : voting}
        <span className="ml-auto flex items-center gap-1">
          {me && !mine && (reported
            ? <span className="px-2 text-xs font-bold text-muted">Reported</span>
            : <Tip text="Report spam, rudeness or a hidden spoiler" tint="berry">
                <button onClick={() => setReporting(!reporting)} aria-expanded={reporting}
                  className="grid size-8 place-items-center rounded-full text-muted hover:bg-card hover:text-berry">
                  <Flag size={15} aria-hidden="true" /><span className="sr-only">Report</span>
                </button>
              </Tip>)}
          <Tip text={`Talk about ${draft.title} with other villagers, in its thread`} tint="sky">
            <button onClick={onChat} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:bg-card hover:text-ink">
              <MessageCircle size={15} aria-hidden="true" /> Chat · {chatCount}
            </button>
          </Tip>
        </span>
      </div>
      {(practiceVote || draft.practiceVote) && <p className="mt-2 text-xs text-muted">Your own Draft: votes here are practice. They&apos;re saved on this device, show in every view, and only you see them.</p>}
      {error && <p role="status" className="mt-2 text-sm text-berry">{error}</p>}
      {reporting && !reported && <ReportForm target={{ draftId: draft.id }} live={live} onDone={() => setReporting(false)} />}
      {live.mod && <DraftModTools draft={draft} live={live} />}
    </li>
  );
}

function VoteButton({ on, onClick, icon, label, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; label?: string; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={label}
      className={'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (on ? 'bg-leaf text-paper ring-leaf' : 'bg-card ring-line hover:ring-leaf')}>
      {icon}{children}
    </button>
  );
}

/** Moderators' Notice Board: open reports, one card per reported thing. */
function ReportQueue({ live, blocks }: { live: WorkshopData; blocks: Placed[] }) {
  if (live.reports.length === 0) {
    return <Empty title="No reports waiting" body="When a villager reports a message or a Draft, it waits here. Only moderators see reports." />;
  }
  return (
    <ul className="mt-3 grid gap-3">
      {live.reports.map((r) => <ReportCard key={r.key} r={r} live={live} blocks={blocks} />)}
    </ul>
  );
}

function ReportCard({ r, live, blocks }: { r: ReportGroup; live: WorkshopData; blocks: Placed[] }) {
  const { run, busy, error } = useAction();
  const reasons = r.reasons.map((k) => REASONS.find((x) => x.key === k)?.label ?? k);
  const block = r.draft ? blocks.find((b) => b.id === r.draft!.blockKey) : undefined;
  return (
    <li className="rise rounded-3xl bg-card-2 p-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-berry-soft px-2 py-0.5 text-xs font-bold text-berry">
          <Flag size={12} aria-hidden="true" /> {r.count} {r.count === 1 ? 'report' : 'reports'}
        </span>
        {reasons.map((x) => <span key={x} className="rounded-full bg-card px-2 py-0.5 text-xs font-bold ring-1 ring-line">{x}</span>)}
        <span className="ml-auto text-xs text-muted">{ago(r.firstAt)}</span>
      </div>
      {r.message ? (
        <div className="mt-2 flex gap-2.5 rounded-2xl bg-card p-2.5 ring-1 ring-line">
          <Avatar name={r.message.author.name} url={r.message.author.avatarUrl} size={28} />
          <div className="min-w-0">
            <p className="text-sm font-bold">{r.message.author.name}{r.message.spoiler && <span className="ml-2 text-xs text-muted">marked spoiler</span>}</p>
            <p className="whitespace-pre-wrap break-words text-sm"><MessageText body={r.message.body} /></p>
          </div>
        </div>
      ) : r.draft ? (
        <p className="mt-2 rounded-2xl bg-card p-2.5 text-sm ring-1 ring-line">
          <span className="font-bold">Draft:</span> {r.draft.title}{block && <span className="text-muted"> · {block.page.title === block.title ? block.title : `${block.page.title} · ${block.title}`}</span>}
        </p>
      ) : null}
      {r.notes.length > 0 && (
        <ul className="mt-2 grid gap-1 text-sm text-muted">
          {r.notes.map((n, i) => <li key={i}>“{n.note}” · {n.by}</li>)}
        </ul>
      )}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {'messageId' in r.target ? (
          <>
            {!r.message?.removed && (
              <SmallButton tone="bad" disabled={busy} onClick={() => run(() => live.moderate.removeMessage((r.target as { messageId: number }).messageId, true))}
                icon={<Trash2 size={13} aria-hidden="true" />}>Remove message</SmallButton>
            )}
            {!r.message?.spoiler && (
              <SmallButton disabled={busy} onClick={() => run(() => live.moderate.markSpoiler((r.target as { messageId: number }).messageId, true))}
                icon={<EyeOff size={13} aria-hidden="true" />}>Mark as spoiler</SmallButton>
            )}
          </>
        ) : r.draft?.status !== 'removed' && (
          <SmallButton tone="bad" disabled={busy} onClick={() => run(() => live.moderate.decide((r.target as { draftId: string }).draftId, 'removed'))}
            icon={<Trash2 size={13} aria-hidden="true" />}>Remove Draft</SmallButton>
        )}
        <SmallButton disabled={busy} onClick={() => run(() => live.moderate.dismissReports(r.target))} icon={<Check size={13} aria-hidden="true" />}>
          It&apos;s fine, dismiss
        </SmallButton>
      </div>
      {error && <p role="status" className="mt-1.5 text-sm text-berry">{error}</p>}
    </li>
  );
}

/**
 * "In the app": what's on the selected Page right now, Block by Block, so villagers can
 * pick something to fix or add to without leaving the Workshop.
 */
function AppContents({ pages, drafts, query, focus, onFix, onAdd, onDrafts, onSetup }: {
  pages: Page[]; drafts: LiveDraft[]; query: string; focus?: string;
  onFix: (blockId: string, entryId: string) => void; onAdd: (blockId: string) => void; onDrafts: (cardId: string) => void;
  /** Characters Blocks: open their field setup. */
  onSetup: (blockId: string) => void;
}) {
  const [folded, setFolded] = useStored<string[]>('village:workshop:folded-blocks', []);
  const fold = (id: string) => setFolded(folded.includes(id) ? folded.filter((x) => x !== id) : [...folded, id]);
  const open = useMemo(() => {
    const n = new Map<string, number>();
    for (const d of drafts) if (d.cardId && (d.status === 'open' || d.status === 'checking')) n.set(d.cardId, (n.get(d.cardId) ?? 0) + 1);
    return n;
  }, [drafts]);
  const many = pages.length > 1;
  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-5">
      {query && !pages.some((p) => p.blocks.some((b) => rank(b.entries, query, entryText).length > 0)) && (
        <p className="rounded-2xl bg-card-2 px-3 py-3 text-sm text-muted">Nothing matches “{query}”. Try another word, or add it as something new.</p>
      )}
      {pages.map((p) => (
        <div key={p.id} className="grid grid-cols-[minmax(0,1fr)] gap-5">
          {many && <h3 className="flex items-center gap-2 font-display text-lg"><BlockIcon name={p.icon} size={16} /> {p.title}</h3>}
          {p.blocks.map((b) => {
            const list = rank(b.entries, query, entryText);
            if (query && !list.length) return null;
            const isFolded = folded.includes(b.id) && !query;
            return (
              // A Block of the app: a white panel with a hairline in its Page's color.
              <section key={b.id} className="min-w-0 rounded-2xl bg-card p-3"
                style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--${p.tint}) 22%, var(--line))` }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => fold(b.id)} aria-expanded={!isFolded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <BlockIcon name={b.icon} size={17} className="shrink-0" style={{ color: `var(--${p.tint})` }} />
                    <h4 className="truncate font-bold">{b.title}</h4>
                    <span className="text-xs text-muted">{b.entries.length}</span>
                    <ChevronDown size={15} className={'shrink-0 text-muted transition ' + (isFolded ? '-rotate-90' : '')} aria-hidden="true" />
                  </button>
                  {b.type === 'characters' && (
                    <Tip text={`Choose the fields ${b.title} cards show, with a preview`} tint={p.tint} className="shrink-0">
                      <button onClick={() => onSetup(b.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                        <SlidersHorizontal size={13} aria-hidden="true" /> Set up
                      </button>
                    </Tip>
                  )}
                  <Tip text={`Add something new to ${b.title}`} tint={p.tint} className="shrink-0">
                    <button onClick={() => onAdd(b.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-leaf">
                      <Plus size={13} aria-hidden="true" /> Add
                    </button>
                  </Tip>
                </div>
                {isFolded ? null : list.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Nothing here yet. Add the first one.</p>
                ) : (
                  <ScrollBox as="ul" className="mt-2 grid max-h-80 grid-cols-[minmax(0,1fr)] gap-1 pb-6 pr-1">
                    {list.map((e) => {
                      const n = e.ref ? open.get(e.ref.card) ?? 0 : 0;
                      const on = focus === `${b.id}.${e.id}`;
                      return (
                        <li key={e.id}>
                          <button onClick={() => onFix(b.id, e.id)}
                            className={'flex w-full items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left hover:bg-card-2 ' + (on ? 'bg-card-2 ring-2 ring-ink' : '')}>
                            <EntryIcon entry={e} block={b} size="sm" color={`var(--${p.tint})`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">{e.name}</span>
                              <span className="block truncate text-xs text-muted">{e.stat ?? Object.values(e.categories)[0] ?? e.description}</span>
                            </span>
                            {n > 0 && (
                              <span role="button" tabIndex={0} onClick={(ev) => { ev.stopPropagation(); onDrafts(e.ref!.card); }}
                                onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); onDrafts(e.ref!.card); } }}
                                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-ink ring-1 ring-ink hover:bg-card-2">{n} open Draft{n > 1 ? 's' : ''}</span>
                            )}
                            <span className="shrink-0 text-xs font-bold text-leaf">Fix</span>
                          </button>
                        </li>
                      );
                    })}
                  </ScrollBox>
                )}
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}
