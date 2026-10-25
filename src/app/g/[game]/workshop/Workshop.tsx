'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, EyeOff, Flag, MessageCircle, MoreHorizontal, Plus, RotateCcw, Search, Send,
  ShieldCheck, Sparkles, Trash2, TriangleAlert, X,
} from 'lucide-react';
import type { Block, Page } from '@/data/pages';
import { BlockIcon, NavSymbol } from '@/components/Icon';
import { EntryDetails, EntryIcon, type RouteOption } from '@/components/app/EntryPanel';
import { entryText } from '@/components/app/entries';
import { rank } from '@/lib/search';
import { SignInPrompt } from '@/components/SignInPrompt';
import { ScrollRow } from '@/components/ScrollRow';
import { Tip } from '@/components/Tip';
import { ScrollBox } from '@/components/ScrollBox';
import { useStored } from '@/components/useStored';
import { house } from '@/components/house';
import { HOW_IT_WORKS_PING, HowItWorksButton, MarketDayButton } from '@/components/HowItWorks';
import { Avatar } from '@/components/Avatar';
import { useVillager, type Villager } from '@/components/useVillager';
import { sortStandouts } from '@/lib/standouts';
import {
  REASONS, targetKey, useWorkshop,
  type ChatMessage, type LiveDraft, type ReportGroup, type ReportReason, type Target, type WorkshopData,
} from './useWorkshop';
import { EntryForm, ChangeList, type FormStart, type Posted } from './EntryForm';
import { sharePath } from '@/data/pages/links';
import { changesBetween } from './changes';
import { clearUnsent, readUnsent, saveUnsent, type Unsent } from './unsent';

/** A Block together with the Page it sits on. */
type Placed = Block & { page: Page };

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


/** "just now", "5m", "3h", or a date. Only ever runs in the browser. */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  const [allDrafts, setAllDrafts] = useState(false);
  // ?draft=… (from the app's "A fix is waiting" note) opens that Draft.
  const [detail, setDetail] = useState<string | null>(params.get('draft'));
  const [posted, setPosted] = useState<Posted | null>(null);
  const [discarded, setDiscarded] = useState<Unsent | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [itemsHidden, setItemsHidden] = useStored('village:workshop:hide-open-items', false);
  const [introDone, setIntroDone] = useStored('village:workshop:intro-seen', false);
  const [phoneTab, setPhoneTab] = useState<'work' | 'chat'>('work');
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
    setAllDrafts(false);
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
    setUnsent(readUnsent(game.id));
    if (new URLSearchParams(window.location.search).get('resume')) resumeUnsent();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the Workshop opens
  }, [game.id]);

  // Next keeps a visited Workshop alive in the background, so coming back through a new
  // "Suggest a fix" link doesn't start it fresh. Follow each new link as it arrives.
  const linkKey = `${params.get('fix') ?? ''}|${params.get('field') ?? ''}|${params.get('add') ?? ''}|${params.get('page') ?? ''}|${params.get('resume') ?? ''}|${params.get('draft') ?? ''}|${params.get('theory') ?? ''}`;
  const [followed, setFollowed] = useState(linkKey);
  if (linkKey !== followed) {
    setFollowed(linkKey);
    if (startPage && pages.some((p) => p.id === startPage)) setChip(startPage);
    if (linked) { setForm(linked); setAllDrafts(false); }
    if (params.get('resume')) resumeUnsent();
    if (params.get('draft')) setDetail(params.get('draft'));
  }
  const me = useVillager();
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

  // Open items: what's waiting on people, most urgent first.
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
      hint: 'Tap Fix next to anything below, or start something new.',
      done: Boolean(myId && drafts.some((d) => d.author.id === myId)), go: startNew,
    },
    {
      key: 'chat', title: 'Say hi, or ask the village',
      hint: "Stuck on something, or found something? Chat's the place.",
      done: Boolean(myId && live.messages.some((m) => m.author.id === myId)),
      go: () => { setPhoneTab('chat'); setTimeout(() => document.getElementById('chat-input')?.focus(), 60); },
    },
  ];
  const basicsDone = steps.every((x) => x.done);
  const shown = detail ? drafts.find((d) => d.id === detail) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-5 sm:px-6">
      {/* The Workshop's name and guides. The ink bar above (page.tsx) has the way out and your account. */}
      <header className="flex flex-wrap items-center gap-3">
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
      <ScrollRow as="nav" label="Pages" className="-mx-4 mt-3 flex gap-2 px-4 pb-2 pt-1">
        <BlockChip on={chip === 'all'} tint="ink" icon="LayoutGrid" label="Everything" count={drafts.filter(isOpen).length} onClick={() => setChip('all')} />
        {pages.map((p) => (
          <BlockChip key={p.id} on={chip === p.id} tint={p.tint} icon={p.icon} label={p.title} count={counts[p.id]} onClick={() => setChip(p.id)} />
        ))}
        <BlockChip on={chip === 'notice'} tint="muted" icon="Megaphone" label="Notice Board" count={live.mod ? live.reports.length : 0} onClick={() => setChip('notice')} />
      </ScrollRow>

      {live.state === 'offline' && (
        <p role="status" className="mt-3 rounded-2xl bg-berry-soft px-4 py-3 text-sm text-berry">Couldn&apos;t reach the village just now. Refresh the page to try again.</p>
      )}

      <div role="tablist" aria-label="Show" className="mt-2 flex rounded-full bg-card p-1 ring-1 ring-line lg:hidden">
        {([['work', 'Build'], ['chat', `Chat · ${chat.length}`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={phoneTab === k} onClick={() => setPhoneTab(k)}
            className={'flex-1 rounded-full px-3 py-2 text-sm font-bold ' + (phoneTab === k ? 'gloss bg-ink text-paper' : 'text-muted')}>{label}</button>
        ))}
      </div>

      <div className="mt-3 grid flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={(phoneTab === 'chat' ? 'flex' : 'hidden') + ' min-w-0 flex-col lg:flex'}>
        <Chat
          topic={current ? { key: current.id, label: current.title } : null}
          notice={chip === 'notice'}
          onAll={() => setChip('all')}
          messages={chat}
          me={me}
          live={live}
        />
        </div>

        {/* Ongoing work: open items, then the Page's Blocks */}
        <section aria-label="Work" className={(phoneTab === 'work' ? 'flex' : 'hidden') + ' min-h-[28rem] min-w-0 flex-col rounded-2xl bg-card p-4 ring-1 ring-line lg:flex'}>
          {chip === 'notice' ? (
            <>
              <h2 className="font-display text-xl">Notice Board</h2>
              {live.mod ? <ReportQueue live={live} blocks={blocks} /> : (
                <Empty title="No reports waiting" body="When players tap “not quite” in the app without signing in, their report waits here until a villager confirms it." />
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {searching ? (
                  <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-card-2 px-3 py-1.5 text-sm ring-2 ring-sky">
                    <Search size={15} className="text-muted" aria-hidden="true" />
                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearching(false); } }}
                      placeholder={current ? `Find something in ${current.title}` : 'Find anything in the app'} aria-label="Search"
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
                    <button type="button" onClick={() => { setQuery(''); setSearching(false); }} aria-label="Close search" className="grid size-6 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </label>
                ) : (
                  <>
                    <h2 className="min-w-0 flex-1 truncate font-display text-xl" title={current?.title}>{current ? current.title : 'Everything'}</h2>
                    <Tip text="Search this Page's entries" tint="sky" className="shrink-0">
                      <button onClick={() => setSearching(true)} aria-label="Search"
                        className="grid size-9 place-items-center rounded-full bg-card-2 ring-1 ring-line hover:ring-ink">
                        <Search size={16} aria-hidden="true" />
                      </button>
                    </Tip>
                  </>
                )}
                <Tip text={allDrafts ? "Back to this Page's Blocks" : 'Every Draft in one list, with sorting'} className="shrink-0">
                  <button onClick={() => setAllDrafts(!allDrafts)} aria-pressed={allDrafts}
                    className={'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (allDrafts ? 'bg-ink text-paper ring-ink' : 'bg-card-2 ring-line hover:ring-ink')}>
                    {allDrafts ? 'Blocks' : 'Drafts'}
                  </button>
                </Tip>
                <Tip text="Add something new to the app" tint="leaf" className="shrink-0">
                  <button onClick={startNew} className="btn-primary inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold">
                    <Plus size={16} aria-hidden="true" /> New
                  </button>
                </Tip>
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

              {/* Open items: a swipeable row of blocks */}
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  {itemsHidden && items.length > 0 ? (
                    <button onClick={() => setItemsHidden(false)} aria-label={`Show ${items.length} open items`}
                      className="glow-pulse inline-flex items-center gap-1.5 rounded-full bg-sun-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-sun">
                      <span className="size-1.5 rounded-full bg-sun" aria-hidden="true" /> Open items · {items.length}
                    </button>
                  ) : (
                    <Tip text="Drafts waiting on someone: your vote, your own, or ready to publish">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">Open items · {items.length}</p>
                    </Tip>
                  )}
                  {items.length > 0 && (
                    <button onClick={() => setItemsHidden(!itemsHidden)} aria-expanded={!itemsHidden}
                      title={itemsHidden ? undefined : 'The label glows while anything is waiting'}
                      className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-muted hover:bg-card-2 hover:text-ink">
                      {itemsHidden ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
                      {itemsHidden ? 'Show' : 'Hide'}
                    </button>
                  )}
                </div>
                {live.state === 'loading' ? (
                  <div className="mt-4 flex gap-3 overflow-hidden" aria-hidden="true">{[0, 1].map((n) => <div key={n} className="h-28 w-52 shrink-0 animate-pulse rounded-[1.1rem] bg-card-2" />)}</div>
                ) : items.length === 0 ? (
                  <p className="mt-2 rounded-2xl bg-card-2 px-3 py-3 text-sm text-muted">Nothing waiting{current ? ` on ${current.title}` : ''}. Pick something below to improve, or add something new.</p>
                ) : itemsHidden ? null : (
                  <ScrollRow as="ul" className="swipe -mx-4 flex gap-3 px-4 pb-3 pt-4">
                    {items.map(({ d, kind }) => (
                      <li key={d.id} className="shrink-0">
                        <OpenItem d={d} kind={kind} visitor={me === null} practice={Boolean(me?.practice && d.author.id === me.id)} place={placeOf(d.blockKey)} onOpen={() => setDetail(d.id)}
                          onVote={kind === 'vote' && me ? (v) => { live.vote(d.id, v); } : undefined} />
                      </li>
                    ))}
                  </ScrollRow>
                )}
              </div>

              {allDrafts ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">All Drafts</p>
                    <label className="ml-auto">
                      <span className="sr-only">Sort Drafts</span>
                      <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full bg-card-2 px-3 py-1.5 text-sm font-bold ring-1 ring-line">
                        {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </label>
                  </div>
                  {visible.filter((d) => !query || d.title.toLowerCase().includes(query.toLowerCase())).length === 0 ? (
                    <Empty title={sort === 'shipped' ? 'Nothing published yet' : 'No Drafts here yet'}
                      body={sort === 'shipped' ? 'Drafts land here once a moderator publishes them to the app.' : 'Spotted something missing or wrong? Start one, or tap "Suggest a fix" on anything in the app.'} />
                  ) : (
                    <ul className="mt-3 grid gap-3">
                      {visible.filter((d) => !query || d.title.toLowerCase().includes(query.toLowerCase())).map((d) => (
                        <DraftCard key={d.id} draft={d} place={placeOf(d.blockKey)} routes={routes} me={me}
                          messages={live.messages.filter((m) => m.draftId === d.id)} live={live} />
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <AppContents pages={current ? [current] : pages} drafts={drafts} query={query} focus={form?.entryId ? `${form.blockId}.${form.entryId}` : undefined}
                  onFix={(blockId, entryId) => setForm({ blockId, entryId })} onAdd={(blockId) => setForm({ blockId })}
                  onDrafts={(cardId) => { const d = drafts.find((x) => x.cardId === cardId && isOpen(x)); if (d) setDetail(d.id); }} />
              )}
            </>
          )}
        </section>
      </div>

      {form && blocks.length > 0 && (
        <EntryForm gameId={game.id} pages={pages} routes={routes} start={form} restore={restore} me={me} postDraft={live.postDraft}
          onClose={closeForm}
          onPosted={(p) => {
            closeForm();
            setChip(p.pageId);
            setAllDrafts(false);
            setPosted(p);
          }}
          onDiscard={() => {
            // Keep a copy for Undo; it's gone for good once the note is closed.
            const copy = readUnsent(game.id);
            clearUnsent(game.id);
            closeForm();
            if (copy) setDiscarded(copy);
          }} />
      )}

      {shown && (
        <Sheet label={shown.title} onClose={() => setDetail(null)}>
          <ul>
            <DraftCard draft={shown} place={placeOf(shown.blockKey)} routes={routes} me={me} startOpen
              messages={live.messages.filter((m) => m.draftId === shown.id)} live={live} />
          </ul>
        </Sheet>
      )}
    </main>
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

const ITEM: Record<'ready' | 'yours' | 'vote' | 'voted', { label: string; tint: string }> = {
  ready: { label: 'Ready to publish', tint: 'sun' },
  yours: { label: 'Your Draft', tint: 'leaf' },
  vote: { label: 'Needs your vote', tint: 'sky' },
  voted: { label: 'You voted', tint: 'teal' },
};

const ITEM_TIP: Record<keyof typeof ITEM, string> = {
  ready: 'Has 5 or more votes, mostly yes. A moderator can publish it',
  yours: 'Your Draft. Other villagers vote on it, then a moderator decides',
  vote: 'Other villagers are checking this. Does it match your game? Vote right here, or open it for the details',
  voted: "You've voted. It's waiting on others",
};

/** One open item: a Draft as a village block you can tap to see and vote on. */
function OpenItem({ d, kind, visitor, practice, place, onOpen, onVote }: {
  d: LiveDraft; kind: keyof typeof ITEM; visitor?: boolean; practice?: boolean; place?: Placed; onOpen: () => void;
  /** Vote straight from the card, without opening it. */
  onVote?: (v: 1 | -1) => void;
}) {
  const votes = d.ups + d.downs;
  const status = (d.status === 'stable' ? 'Published' : d.status === 'declined' ? 'Declined' : votes >= 5 ? `${votes} votes` : `${votes} of 5 votes`)
    + (d.practiceVote ? ' (1 practice)' : '');
  return (
    // The card is a house from its Page's street: the same color and roof as that Page's block.
    <Tip text={visitor && kind === 'vote' ? 'Sign in to vote on this' : ITEM_TIP[kind]} tint={place?.page.tint ?? 'ink'}>
    <div {...(place ? house(place.page.title, place.page.tint) : house(d.id, 'muted'))} className="vblock flex w-52 flex-col gap-2 px-3 pb-3 pt-3.5">
    <button onClick={onOpen} className="flex flex-col gap-2 text-left">
      <span className="flex items-center gap-1.5">
        <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: `color-mix(in srgb, var(--${ITEM[kind].tint}) 80%, black)` }}>
          {practice ? 'Your Draft · practice' : visitor && kind === 'vote' ? 'Open for votes' : ITEM[kind].label}
        </span>
        {place && <span className="truncate text-[11px] font-bold">{place.page.title}</span>}
      </span>
      <span className="flex items-center gap-2 text-ink">
        {place ? <EntryIcon entry={d.content} block={place} size="sm" /> : null}
        <span className="min-w-0">
          <span className="block truncate font-bold leading-tight">{d.title}</span>
          <span className="block truncate text-xs text-muted">{d.cardId ? 'Fix' : 'New'} · {place?.title ?? 'Removed Block'}</span>
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-xs font-bold">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80">
          <span className="block h-full rounded-full bg-current" style={{ width: `${Math.min(100, (votes / 5) * 100)}%` }} />
        </span>
        {status}
      </span>
      {(practice || d.practiceVote) && <span className="text-[11px] leading-tight">Practice votes are saved on this device. Only you see them.</span>}
    </button>
    {onVote && (
      <span className="flex gap-1.5">
        <button type="button" onClick={() => onVote(1)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-leaf hover:bg-white">
          {d.kind === 'fact' ? <><Check size={13} aria-hidden="true" /> Matches</> : <><ArrowUp size={13} aria-hidden="true" /> Yes</>}
        </button>
        <button type="button" onClick={() => onVote(-1)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-berry hover:bg-white">
          {d.kind === 'fact' ? <><TriangleAlert size={13} aria-hidden="true" /> Seems wrong</> : <><ArrowDown size={13} aria-hidden="true" /> No</>}
        </button>
      </span>
    )}
    </div>
    </Tip>
  );
}

/** A Draft opened from an open item: a sheet on phones, a centered panel on computers. */
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

/** Runs an action that returns an error in plain words (or null), tracking busy and error. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    setError(err ?? '');
    return !err;
  };
  return { run, busy, error };
}

function SmallButton({ onClick, icon, children, tone = 'plain', disabled }: {
  onClick: () => void; icon?: React.ReactNode; children: React.ReactNode; tone?: 'plain' | 'good' | 'bad'; disabled?: boolean;
}) {
  const tones = { plain: 'bg-card ring-line hover:ring-ink', good: 'bg-leaf-soft text-leaf ring-leaf/40 hover:ring-leaf', bad: 'bg-berry-soft text-berry ring-berry/40 hover:ring-berry' };
  return (
    <button onClick={onClick} disabled={disabled} className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 disabled:opacity-50 ' + tones[tone]}>
      {icon}{children}
    </button>
  );
}

/** "Report" for villagers: pick a reason, add a note if you like. Goes to the moderators. */
function ReportForm({ target, live, onDone }: { target: Target; live: WorkshopData; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const { run, busy, error } = useAction();
  if (sent) return <p role="status" className="mt-2 rounded-2xl bg-leaf-soft px-3 py-2 text-sm text-leaf">Thanks. A moderator will take a look.</p>;
  return (
    <form className="mt-2 grid gap-2 rounded-2xl bg-card-2 p-3 ring-1 ring-line"
      onSubmit={async (e) => { e.preventDefault(); if (reason && await run(() => live.report(target, reason, note))) { setSent(true); setTimeout(onDone, 2500); } }}>
      <p className="text-sm font-bold">What&apos;s wrong with it?</p>
      <div role="radiogroup" aria-label="Reason" className="flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button key={r.key} type="button" role="radio" aria-checked={reason === r.key} onClick={() => setReason(r.key)}
            className={'rounded-full px-3 py-1 text-sm font-bold ring-1 ' + (reason === r.key ? 'bg-berry text-paper ring-berry' : 'bg-card ring-line hover:ring-berry')}>
            {r.label}
          </button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Anything moderators should know (optional)"
        className="rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky" />
      <div className="flex items-center gap-2">
        <button disabled={!reason || busy} className="rounded-full bg-berry px-4 py-1.5 text-sm font-bold text-paper disabled:opacity-50">Send report</button>
        <button type="button" onClick={onDone} className="rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:text-ink">Cancel</button>
      </div>
      {error && <p role="status" className="text-sm text-berry">{error}</p>}
    </form>
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

function DraftCard({ draft, place, routes, me, messages, live, startOpen = false }: {
  draft: LiveDraft; place?: Placed; routes: RouteOption[]; me: Villager | null | undefined; messages: ChatMessage[]; live: WorkshopData; startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [discuss, setDiscuss] = useState(false);
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
    <li className={'rise rounded-3xl bg-card-2 p-3 ring-1 ring-line ' + (draft.status === 'removed' ? 'opacity-60' : '')}>
      <button onClick={expand} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf"><BlockIcon name={block.icon} size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg leading-tight">{draft.title}</span>
            {draft.cardId
              ? <Tip text="Changes an entry that's already in the app" tint="sky"><span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs font-bold text-sky">fix</span></Tip>
              : <Tip text="A new entry for the app" tint="leaf"><span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-bold text-leaf">new</span></Tip>}
            {draft.theory && <Tip text="Not confirmed yet. Shown with a Theory label in the app" tint="sun"><span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold text-sun">Theory</span></Tip>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Avatar name={draft.author.name} url={draft.author.avatarUrl} size={18} />
            {block.page.title === block.title ? block.title : `${block.page.title} · ${block.title}`} · {draft.author.name} · {ago(draft.createdAt)} · {STATUS[draft.status] ?? draft.status}
          </span>
        </span>
      </button>
      {draft.status === 'declined' && draft.declineReason && (
        <p className="mt-2 rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-line"><span className="font-bold">Declined:</span> {draft.declineReason}</p>
      )}
      {open && (
        <div className="mt-3 grid gap-2">
          {changes.length > 0 && (
            <div className="rounded-2xl bg-card p-3 ring-1 ring-line">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">What changes</p>
              <ChangeList changes={changes} />
            </div>
          )}
          {draft.cardId && !stable && draft.status !== 'stable' && <p className="text-sm text-muted">The entry this fixes is no longer in the app.</p>}
          <div className="rounded-2xl bg-card p-3 ring-1 ring-line"><EntryDetails entry={draft.content} block={block} route="all" routes={routes} /></div>
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
          <Tip text="Talk about this Draft with other villagers" tint="sky">
            <button onClick={() => setDiscuss(!discuss)} aria-expanded={discuss} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:bg-card hover:text-ink">
              <MessageCircle size={15} aria-hidden="true" /> Discuss · {messages.filter((m) => !m.removed).length}
            </button>
          </Tip>
        </span>
      </div>
      {(practiceVote || draft.practiceVote) && <p className="mt-2 text-xs text-muted">Your own Draft: votes here are practice. They&apos;re saved on this device, show in every view, and only you see them.</p>}
      {error && <p role="status" className="mt-2 text-sm text-berry">{error}</p>}
      {reporting && !reported && <ReportForm target={{ draftId: draft.id }} live={live} onDone={() => setReporting(false)} />}
      {live.mod && <DraftModTools draft={draft} live={live} />}
      {discuss && (
        <div className="mt-3 grid gap-2 rounded-2xl bg-card p-3 ring-1 ring-line">
          {messages.length === 0
            ? <p className="text-sm text-muted">No one has talked about this Draft yet.</p>
            : <ul className="grid gap-3">{messages.map((m) => <Message key={m.id} m={m} me={me} live={live} />)}</ul>}
          <Composer me={me} placeholder="Reply about this Draft" onSend={(body, spoiler) => live.send(body, { blockKey: block.page.id, draftId: draft.id, spoiler })} />
        </div>
      )}
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

function Message({ m, tag, me, live }: { m: ChatMessage; tag?: string | null; me: Villager | null | undefined; live: WorkshopData }) {
  const [shown, setShown] = useState(false);
  const [tools, setTools] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { run, busy, error } = useAction();
  const own = me?.id === m.author.id && !me.practice;
  const reported = live.myReports.has(targetKey({ messageId: m.id }));
  const canReport = Boolean(me) && !own;
  const hasTools = canReport || live.mod;
  return (
    <li className={'group flex gap-2.5 ' + (m.removed ? 'opacity-50' : '')}>
      <Avatar name={m.author.name} url={m.author.avatarUrl} size={32} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-bold">{m.author.name}</span>
          <span className="text-xs text-muted">{ago(m.createdAt)}</span>
          {tag && <span className="rounded-full bg-card-2 px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-line">{tag}</span>}
          {m.removed && <span className="rounded-full bg-berry-soft px-2 py-0.5 text-xs font-bold text-berry">Removed · only moderators see it</span>}
          {hasTools && (
            <button onClick={() => { setTools(!tools); setReporting(false); }} aria-expanded={tools} aria-label="Message options"
              className={'ml-auto grid size-6 place-items-center self-center rounded-full text-muted hover:bg-card-2 hover:text-ink ' + (tools ? '' : 'sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100')}>
              <MoreHorizontal size={15} aria-hidden="true" />
            </button>
          )}
        </p>
        {m.spoiler && !shown ? (
          <button onClick={() => setShown(true)} className="mt-0.5 inline-flex items-center gap-1.5 rounded-xl bg-ink/80 px-3 py-1 text-sm font-bold text-paper">
            <EyeOff size={14} aria-hidden="true" /> Spoiler · tap to show
          </button>
        ) : (
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        )}
        {tools && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {canReport && (reported
              ? <span className="px-1 text-xs font-bold text-muted">You reported this</span>
              : <SmallButton onClick={() => setReporting(!reporting)} icon={<Flag size={13} aria-hidden="true" />}>Report</SmallButton>)}
            {live.mod && (
              <>
                <SmallButton disabled={busy} onClick={() => run(() => live.moderate.markSpoiler(m.id, !m.spoiler))} icon={<EyeOff size={13} aria-hidden="true" />}>
                  {m.spoiler ? 'Unmark spoiler' : 'Mark as spoiler'}
                </SmallButton>
                <SmallButton tone={m.removed ? 'plain' : 'bad'} disabled={busy} onClick={() => run(() => live.moderate.removeMessage(m.id, !m.removed))}
                  icon={m.removed ? <RotateCcw size={13} aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}>
                  {m.removed ? 'Restore' : 'Remove'}
                </SmallButton>
              </>
            )}
          </div>
        )}
        {error && <p role="status" className="mt-1 text-sm text-berry">{error}</p>}
        {reporting && !reported && <ReportForm target={{ messageId: m.id }} live={live} onDone={() => { setReporting(false); setTools(false); }} />}
      </div>
    </li>
  );
}

/** The message box: a text field, a spoiler switch and Send. Visitors get a sign-in button. */
function Composer({ me, placeholder, onSend }: { me: Villager | null | undefined; placeholder: string; onSend: (body: string, spoiler: boolean) => Promise<string | null> }) {
  const [text, setText] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (me === null) return <div className="mt-auto pt-2"><SignInPrompt>Sign in to chat</SignInPrompt></div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const err = await onSend(body, spoiler);
    setBusy(false);
    setError(err ?? '');
    if (!err) { setText(''); setSpoiler(false); }
  };

  return (
    <div className="mt-auto">
      <form onSubmit={submit} className="flex items-center gap-1.5 rounded-full bg-card-2 p-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
        <input id="chat-input" value={text} onChange={(e) => { setText(e.target.value); if (error) setError(''); }} maxLength={4000} disabled={me === undefined}
          className="min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted" placeholder={placeholder} aria-label={placeholder} />
        <Tip text="Spoiler: hide this message behind a tap" className="shrink-0">
          <button type="button" onClick={() => setSpoiler(!spoiler)} aria-pressed={spoiler}
            className={'grid size-9 place-items-center rounded-full ' + (spoiler ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
            <EyeOff size={16} aria-hidden="true" /><span className="sr-only">Spoiler</span>
          </button>
        </Tip>
        <button disabled={busy || !text.trim()} className="btn-primary grid size-9 place-items-center rounded-full disabled:opacity-50" aria-label="Send">
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
      {spoiler && <p className="mt-1 px-3 text-xs text-muted">Hidden behind a tap until someone chooses to read it.</p>}
      {error && <p role="status" className="mt-1 px-3 text-sm text-berry">{error}</p>}
    </div>
  );
}

function Chat({ topic: block, notice, onAll, messages, me, live }: {
  topic: { key: string; label: string } | null; notice: boolean; onAll: () => void; messages: ChatMessage[];
  me: Villager | null | undefined; live: WorkshopData;
}) {
  const list = useRef<HTMLUListElement>(null);
  const titles = useMemo(() => new Map(live.drafts.map((d) => [d.id, d.title])), [live.drafts]);
  const lastId = messages.at(-1)?.id;

  // Keep the newest message in view.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const tagFor = (m: ChatMessage) => (m.draftId && titles.has(m.draftId) ? `on “${titles.get(m.draftId)}”` : null);

  return (
    <section aria-label="Chat" className="flex min-h-[28rem] min-w-0 flex-col rounded-2xl bg-card p-4 ring-1 ring-line lg:max-h-[calc(100vh-11rem)]">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl">Chat</h2>
        {(block || notice) && (
          <span className="text-sm text-muted">
            about {block?.label ?? 'the Notice Board'} · <button onClick={onAll} className="font-bold text-leaf underline underline-offset-2">show all</button>
          </span>
        )}
      </div>
      {live.state === 'loading' ? (
        <div className="m-auto py-10 text-sm text-muted">Opening the workshop doors…</div>
      ) : messages.length === 0 ? (
        <div className="m-auto grid max-w-sm justify-items-center gap-2 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-sky-soft text-sky"><MessageCircle aria-hidden="true" /></span>
          <h3 className="font-display text-xl">{block ? `Nothing about ${block.label} yet` : 'The village is quiet'}</h3>
          <p className="text-sm text-muted">Say what you&apos;ve found or what you&apos;re stuck on. Messages show up for everyone here right away.</p>
        </div>
      ) : (
        <ul ref={list} aria-live="polite" className="my-3 grid flex-1 content-start gap-4 overflow-y-auto pr-1">
          {messages.map((m) => <Message key={m.id} m={m} tag={tagFor(m)} me={me} live={live} />)}
          {messages.length < 4 && (
            <li className="mt-2 rounded-2xl bg-card-2 px-3 py-2.5 text-sm text-muted">
              It&apos;s quiet in here. Ask where something is, share something you found, or just say hi. Everyone here sees it right away.
            </li>
          )}
        </ul>
      )}
      <Composer me={me} placeholder={block ? `Message about ${block.label}` : 'Write a message'}
        onSend={(body, spoiler) => live.send(body, { blockKey: block?.key ?? null, spoiler })} />
    </section>
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
            <p className="whitespace-pre-wrap break-words text-sm">{r.message.body}</p>
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
function AppContents({ pages, drafts, query, focus, onFix, onAdd, onDrafts }: {
  pages: Page[]; drafts: LiveDraft[]; query: string; focus?: string;
  onFix: (blockId: string, entryId: string) => void; onAdd: (blockId: string) => void; onDrafts: (cardId: string) => void;
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
              <section key={b.id} {...house(p.title, p.tint, { lean: false })} className="vblock vblock-quiet min-w-0 p-3 pt-3.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => fold(b.id)} aria-expanded={!isFolded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--tint) 14%, white)', color: 'var(--tint)' }}><BlockIcon name={b.icon} size={15} /></span>
                    <h4 className="truncate font-bold">{b.title}</h4>
                    <span className="text-xs text-muted">{b.entries.length}</span>
                    <ChevronDown size={15} className={'shrink-0 text-muted transition ' + (isFolded ? '-rotate-90' : '')} aria-hidden="true" />
                  </button>
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
                            className={'flex w-full items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left hover:bg-card ' + (on ? 'bg-card ring-2 ring-leaf' : '')}>
                            <EntryIcon entry={e} block={b} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">{e.name}</span>
                              <span className="block truncate text-xs text-muted">{e.stat ?? Object.values(e.categories)[0] ?? e.description}</span>
                            </span>
                            {n > 0 && (
                              <span role="button" tabIndex={0} onClick={(ev) => { ev.stopPropagation(); onDrafts(e.ref!.card); }}
                                onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); onDrafts(e.ref!.card); } }}
                                className="shrink-0 rounded-full bg-sky px-2 py-0.5 text-[11px] font-bold text-white hover:opacity-90">{n} open Draft{n > 1 ? 's' : ''}</span>
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
