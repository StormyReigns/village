'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Shapes, ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, CircleHelp, EyeOff, FileText, Flag, GripVertical, Hammer, MapPin, MessageCircle, PanelLeftOpen, PenLine, Plus, ClipboardPaste,
  RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, TriangleAlert, X, BookOpenText,
} from 'lucide-react';
import type { Entry, Page } from '@/data/pages';
import { BlockIcon, NavSymbol } from '@/components/Icon';
import { EntryDetails, EntryIcon, symbolFor, type RouteOption } from '@/components/app/EntryPanel';
import { entryText, initials } from '@/components/app/entries';
import { rank } from '@/lib/search';
import { byFields, choicesOf, hasFieldSetup, shownFields } from '@/lib/fields';
import { completeness } from '@/lib/completeness';
import { groupOrder } from '@/lib/items';
import { SignInPrompt } from '@/components/SignInPrompt';
import { ScrollRow } from '@/components/ScrollRow';
import { Tip } from '@/components/Tip';
import { ScrollBox } from '@/components/ScrollBox';
import { useStored } from '@/components/useStored';
import { GLITCH, Piece } from '@/components/Piece';
import { HOW_IT_WORKS_PING, HowItWorksButton, MarketDayButton } from '@/components/HowItWorks';
import { Avatar } from '@/components/Avatar';
import { useVillager, type Villager } from '@/components/useVillager';
import { useViewAsSetting } from '@/components/viewAs';
import { sortStandouts } from '@/lib/standouts';
import { thumbUrl, watchUrl } from '@/lib/videos';
import {
  REASONS, targetKey, useWorkshop,
  type LiveDraft, type ReportGroup, type WorkshopData,
} from './useWorkshop';
import { ChatLinks, MessageText, Stream, ThreadPanel, useThreads, type Placed } from './chat/Chat';
import { ago, ReportForm, showInList, SmallButton, useAction } from './chat/bits';
import { blockThread, draftThread, entryThread, threadOf, type ThreadKey } from '@/lib/threads';
import { mentionsIn } from '@/lib/refs';
import { EntryForm, ChangeList, type FormStart, type Posted } from './EntryForm';
import { FieldSetup } from './FieldSetup';
import { MapSetup } from './MapSetup';
import { PlannerSetup } from './PlannerSetup';
import { AddBlock, StructurePreview, structureOf, type StructureContent } from './AddBlock';
import { kindOf, setupChanges, setupOf, type SetupContent } from '@/lib/setup-draft';
import { ChangeType } from './ChangeType';
import { GameSettingsEditor } from './GameSettings';
import { gameSettingsOf, settingsChanges, type GameSettingsContent } from '@/lib/game-settings';
import { coverSrc } from '@/lib/cover';
import { TypePreview } from './AddBlock';
import { retypeProblem } from '@/lib/block-types';
import { mapPictureUrl } from '@/components/world/PictureMap';
import { useDragSort } from './useDragSort';
import { browserClient } from '@/lib/supabase/browser';
import { appChanged } from '@/app/actions';
import { blockTypeInfo } from '@/lib/block-types';
import { PasteSheet } from './PasteSheet';
import { WikiCheck } from '@/components/wiki/WikiCheck';
import { BatchCard } from './BatchCard';
import { useBatches } from './useBatches';
import { EditorChat, EditSwap } from './EditorShell';
import { Resizer } from './chat/Resizer';
import { useBeside } from './split';
import { sharePath } from '@/data/pages/links';
import { changesBetween } from './changes';
import { clearUnsent, readUnsent, saveUnsent, type Unsent } from './unsent';
import { QuestionsTab } from './Questions';
import { useQuestions } from '@/components/questions/useQuestions';
import { DiscordCard } from '@/components/discord/DiscordCard';
import { CommunityQueue } from '@/components/communities/CommunityQueue';

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
    if (add && placeOf(add)) return { blockId: add, name: params.get('name') ?? undefined };
    return null;
  })();
  const startPage = params.get('page') ?? (linked ? placeOf(linked.blockId)?.page.id : params.get('paste') ? placeOf(params.get('paste')!)?.page.id ?? null : null);
  const [chip, setChip] = useState<string>(startPage && pages.some((p) => p.id === startPage) ? startPage : 'all');
  const [sort, setSort] = useState<Sort>('standouts');
  const [form, setForm] = useState<FormStart | null>(linked);
  // A Block being set up: a Characters (Items, Guides) Block's fields, or a Places Block's map
  // (?pins=block, from "not on the map yet" in the app).
  const [setup, setSetup] = useState<string | null>(() => { const b = params.get('pins'); return b && placeOf(b)?.look === 'map' ? b : null; });
  // A setup Draft opened in its editor ("See it in Set up" on its card), to look at with its preview.
  const [trying, setTrying] = useState<LiveDraft | null>(null);
  // An empty Block whose type is being changed (ChangeType.tsx).
  const [retyping, setRetyping] = useState<string | null>(null);
  // The game's own settings (GameSettings.tsx): name, date, kind, look, cover, routes.
  const [gameSettings, setGameSettings] = useState(false);
  // Rows pasted from a spreadsheet into a Block (?paste=block, from the app's Download menu).
  const [pasting, setPasting] = useState<string | null>(() => { const b = params.get('paste'); return b && placeOf(b) ? b : null; });
  // A Block's wiki links: what to check, and the game's wiki (docs/blocks/wiki-links.md).
  const [wikiFor, setWikiFor] = useState<string | null>(null);
  // Adding a Block to a Page (Add Block), or a new Page with its first Block (the "+" after the tabs).
  const [adding, setAdding] = useState<{ newPage: boolean } | null>(null);
  // A batch to open in Drafts, once it's sent.
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  // The work column shows Drafts or what's in the app. Until you pick, it opens on Drafts
  // when something waits on you.
  // ?tab=questions (from the app's "Answer in the Workshop") opens the Questions tab; ?tab=app
  // (from the app home's "needs help" lines) opens In the app.
  const tabParam = (): 'questions' | 'app' | null => { const t = params.get('tab'); return t === 'questions' || t === 'app' ? t : null; };
  const [tab, setTab] = useState<'drafts' | 'app' | 'questions' | null>(linked ? 'app' : tabParam());
  // ?draft=… (from the app's "A fix is waiting" note) opens that Draft.
  const [detail, setDetail] = useState<string | null>(params.get('draft'));
  // ?msg=42 (a link to one chat message) jumps to it once the chat has loaded.
  const [pendingMsg, setPendingMsg] = useState<number | null>(Number(params.get('msg')) || null);
  const [jumpNote, setJumpNote] = useState('');
  const [posted, setPosted] = useState<Posted | null>(null);
  const [discarded, setDiscarded] = useState<Unsent | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Wide screens: the chat can fold to a thin strip, to give an editor more room. It isn't
  // remembered: where both fit, the Workshop always opens with the chat beside the work (Matt).
  const [chatFolded, setChatFolded] = useState(false);
  // Wide screens: how wide the chat is, dragged by the handle beside it (0 is the usual width).
  const [chatWidth, setChatWidth] = useStored('village:workshop:chat-width', 0);
  const columns = useRef<HTMLDivElement>(null);
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
    setForm({ blockId: u.blockId, entryId: u.entryId, question: u.question });
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
  const linkKey = `${params.get('fix') ?? ''}|${params.get('field') ?? ''}|${params.get('add') ?? ''}|${params.get('resume') ?? ''}|${params.get('draft') ?? ''}|${params.get('theory') ?? ''}|${params.get('msg') ?? ''}|${params.get('paste') ?? ''}`;
  const [followed, setFollowed] = useState(linkKey);
  if (linkKey !== followed) {
    setFollowed(linkKey);
    if (startPage && pages.some((p) => p.id === startPage)) setChip(startPage);
    if (linked) { setForm(linked); setTab('app'); }
    if (params.get('resume')) resumeUnsent();
    if (params.get('draft')) setDetail(params.get('draft'));
    if (Number(params.get('msg'))) setPendingMsg(Number(params.get('msg')));
    const paste = params.get('paste');
    if (paste && placeOf(paste)) { setPasting(paste); setChip(placeOf(paste)!.page.id); }
  }
  // ?tab= is followed on its own, only when a link brings it; once read it's dropped from the
  // address, so a later re-render can never snap the tab back.
  const tabP = params.get('tab');
  const [followedTab, setFollowedTab] = useState(tabP);
  if (tabP !== followedTab) {
    setFollowedTab(tabP);
    if (tabParam()) setTab(tabParam());
  }
  useEffect(() => {
    if (!tabP) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    window.history.replaceState({}, '', url); // a fresh state, so Next notices the change
  }, [tabP]);
  // ?page= is followed on its own: the Workshop also writes it (below), and that mustn't
  // reopen whatever a link once opened.
  const pageParam = params.get('page');
  const [followedPage, setFollowedPage] = useState(pageParam);
  if (pageParam !== followedPage) {
    setFollowedPage(pageParam);
    if (pageParam && pages.some((p) => p.id === pageParam)) setChip(pageParam);
  }
  // The chosen Page goes in the address, so "Open the app" (page.tsx) opens that Page, and a
  // refresh or a shared link comes back to it.
  useEffect(() => {
    const url = new URL(window.location.href);
    const want = pages.some((p) => p.id === chip) ? chip : null;
    if (url.searchParams.get('page') === want) return;
    if (want) url.searchParams.set('page', want);
    else url.searchParams.delete('page');
    window.history.replaceState({}, '', url); // a fresh state, so Next notices the change
  }, [chip, pages]);
  // The open folder stays in view: on a phone the strip slides along to it (only the strip,
  // never the page).
  const tabs = useRef<HTMLDivElement>(null);
  const tabsMoved = useRef(false);
  useEffect(() => {
    const strip = tabs.current?.parentElement;
    const tab = tabs.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!strip || !tab) return;
    const s = strip.getBoundingClientRect(), t = tab.getBoundingClientRect();
    const past = t.left - s.left - 16, beyond = t.right - s.right + 16;
    const to = past < 0 ? strip.scrollLeft + past : beyond > 0 ? strip.scrollLeft + beyond : null;
    if (to !== null) strip.scrollTo({ left: Math.max(0, to), behavior: tabsMoved.current ? 'smooth' : 'auto' });
    tabsMoved.current = true;
  }, [chip]);
  const me = useVillager();
  // A moderator seeing the site as someone else has a reminder pinned at the bottom; the
  // phone chat leaves room for it, so it never covers the message box.
  const viewingAs = useViewAsSetting() !== 'self';
  const live = useWorkshop(game.id, me, detail);
  const batchData = useBatches(game.id, me?.id ?? null, live.mod, live.loadDrafts);
  const questions = useQuestions(game.id, me?.id);
  const questionBody = useMemo(() => {
    const bodies = new Map(questions.questions.map((q) => [q.id, q.body]));
    return (id: string) => bodies.get(id);
  }, [questions.questions]);

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

  const closePaste = () => {
    setPasting(null);
    // Drop ?paste= so a refresh doesn't reopen it.
    const url = new URL(window.location.href);
    if (url.searchParams.has('paste')) { url.searchParams.delete('paste'); window.history.replaceState({}, '', url); }
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
  // The Page each Draft is on: its Block's, or for a suggested Block, the Page it's for. A suggested
  // Page has none yet, so it shows under Everything. Until it's published, a suggested Page or Block's
  // key is only a suggestion and may match a real Block's ("characters"), so it never counts as that.
  const pageOf = useMemo(() => {
    const m = new Map(blocks.map((b) => [b.id, b.page.id]));
    return {
      get: (key: string, d?: LiveDraft) => d?.action === 'add_block' ? structureOf(d.content)?.pageKey
        : d?.action === 'add_page' ? (d.status === 'stable' ? m.get(key) : undefined)
        : m.get(key),
    };
  }, [blocks]);
  const draftPage = (d: LiveDraft) => pageOf.get(d.blockKey, d);
  const onPage = (d: LiveDraft) => chip === 'all' || chip === 'notice' || draftPage(d) === chip;
  const isOpen = (d: LiveDraft) => d.status === 'open' || d.status === 'checking';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- draftPage reads pageOf
  const counts = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, drafts.filter((d) => isOpen(d) && draftPage(d) === p.id).length])), [pages, drafts, pageOf]);
  const visible = useMemo(() => {
    const list = drafts.filter((d) => chip === 'all' || draftPage(d) === chip);
    if (sort === 'new') return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'needs') return list.filter((d) => d.status === 'open').sort((a, b) => a.viewers - b.viewers);
    if (sort === 'shipped') return list.filter((d) => d.status === 'stable');
    return sortStandouts(list.filter(isOpen));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftPage reads pageOf
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

  // Moderators drag a Page's Blocks into order (AppContents). The Blocks shown swap places among the
  // places they already hold, so ones the Workshop doesn't list (Tier lists) and other Pages keep theirs.
  const router = useRouter();
  const reorderBlocks = async (pageId: string, ids: string[]) => {
    const db = browserClient();
    if (!db) return;
    const fail = (why: string) => { setJumpNote(`Couldn't save the new order: ${why}`); setTimeout(() => setJumpNote(''), 6000); router.refresh(); };
    const { data, error } = await db.from('game_blocks').select('block_key, position').eq('game_id', game.id).eq('page_key', pageId);
    if (error) return fail(error.message);
    const slots = (data ?? []).filter((r) => ids.includes(r.block_key as string)).map((r) => r.position as number).sort((a, b) => a - b);
    // Two Blocks sharing a place would have no order between them: nudge each one past the last.
    for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 1;
    if (slots.length !== ids.length) return fail('the Page changed. Try again.');
    const results = await Promise.all(ids.map((id, i) => db.from('game_blocks').update({ position: slots[i] }).eq('game_id', game.id).eq('block_key', id)));
    const bad = results.find((r) => r.error);
    if (bad?.error) return fail(bad.error.message);
    await appChanged(game.id);
    router.refresh();
  };
  const chat = useMemo(() => (current ? live.messages.filter((m) => m.blockKey === current.id) : live.messages), [live.messages, current]);

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
  // Batches pasted from sheets, on the chosen Page: open ones (and one just sent), and published
  // ones under "Shipped". Their rows show inside them, not as Drafts of their own.
  const shownBatches = batchData.batches.filter((b) => (chip === 'all' || placeOf(b.blockKey)?.page.id === chip)
    && (sort === 'shipped' ? b.status === 'stable' : b.status === 'open' || b.id === openBatch)
    && (!query || b.title.toLowerCase().includes(query.toLowerCase())));
  const view = tab ?? (live.state === 'loading' || waiting.length > 0 ? 'drafts' : 'app');
  const openQuestions = questions.state === 'ready' ? questions.questions.filter((q) => q.status === 'open' && (!current || q.pageKey === current.id)).length : 0;
  const workSubtitle = view === 'drafts' ? (waiting.length ? `Drafts · ${waiting.length} waiting on you` : 'Drafts')
    : view === 'questions' ? (openQuestions ? `Questions · ${openQuestions} open, oldest first` : 'Questions') : '';
  const tint = current ? `var(--${current.tint}-soft)` : 'var(--card)';

  // An editor opens in the work column, so on wide screens the chat stays beside it.
  const editBlock = form ? blocks.find((b) => b.id === form.blockId) : undefined;
  const setupBlock = setup ? blocks.find((b) => b.id === setup) : undefined;
  const pasteBlock = pasting ? blocks.find((b) => b.id === pasting) : undefined;
  const wikiBlock = wikiFor ? blocks.find((b) => b.id === wikiFor) : undefined;
  const retypeBlock = retyping ? blocks.find((b) => b.id === retyping) : undefined;
  const editing = adding ? 'add' : form && blocks.length > 0 ? 'form' : setupBlock ? 'setup' : pasteBlock ? 'paste' : wikiBlock ? 'wiki' : retypeBlock ? 'type' : gameSettings ? 'game' : null;
  const editLabel = editing === 'add' ? (adding?.newPage ? 'New Page' : 'Add a Block') : editing === 'form'
    ? (form?.entryId ? `Fix: ${editBlock?.entries.find((e) => e.id === form.entryId)?.name ?? 'an entry'}` : `New in ${editBlock?.title ?? 'the app'}`)
    : setupBlock ? (setupBlock.look === 'map' ? `Map: ${setupBlock.title}` : `Set up ${setupBlock.title}`) : pasteBlock ? `Paste into ${pasteBlock.title}` : wikiBlock ? `Wiki links: ${wikiBlock.title}` : retypeBlock ? `Change the type of ${retypeBlock.title}` : gameSettings ? 'Game settings' : '';
  const editKey = editing ? `${editing}:${form?.blockId}.${form?.entryId}:${setup}:${trying?.id}:${retyping}:${gameSettings}:${pasting}:${wikiFor}:${adding?.newPage}` : null;
  // The setup Draft being looked at, if it's for the Block open in Set up; closing goes back to its card.
  const tried = trying && trying.blockKey === setup ? setupOf(trying.content) : null;
  const closeSetup = () => { if (trying) { setTab('drafts'); setDetail(trying.id); } setSetup(null); setTrying(null); };
  // A setup sent as a Draft: show it in Drafts, on its Page.
  const setupSent = (id: string) => { const page = setupBlock?.page.id; setSetup(null); setTrying(null); if (page) setChip(page); setTab('drafts'); setDetail(id); };

  // Threads: what each is about, and the one open beside the chat.
  const threads = useThreads(blocks, drafts, live.messages);
  const editEntry = editing === 'form' && form?.entryId ? editBlock?.entries.find((e) => e.id === form.entryId) : undefined;
  const editThread = editEntry && editBlock ? entryThread(editBlock.id, editEntry) : editing === 'setup' && setupBlock ? blockThread(setupBlock.id) : editing === 'paste' && pasteBlock ? blockThread(pasteBlock.id) : null;
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
    setTimeout(() => showInList(document.getElementById(`msg-${id}`)), 400);
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
  // A widened chat gives way when the window is narrower, so the work column keeps its room:
  // 768px with an editor open (for its preview beside the form), 480px otherwise.
  const [windowWidth, setWindowWidth] = useState(0);
  useEffect(() => {
    const track = () => setWindowWidth(window.innerWidth);
    track();
    window.addEventListener('resize', track);
    return () => window.removeEventListener('resize', track);
  }, []);
  // The usual width is 26rem, 30rem on the widest screens; it gives way the same way.
  const usualChatWidth = windowWidth >= 1536 ? 480 : 416;
  const shownChatWidth = windowWidth
    ? Math.min(chatWidth || usualChatWidth, Math.max(260, windowWidth - 48 - (editing ? 768 : 480) - 32)) : chatWidth;
  // The chat folds to a thin bar on the left, and opens again from it. Wide screens show the
  // chat beside the work, open on each visit; phones show one at a time, so there folding the
  // chat is how you get back to the work.
  const wideNow = () => window.matchMedia('(min-width: 1024px)').matches;
  const foldChat = () => (wideNow() ? setChatFolded(true) : setPhoneTab('work'));
  const unfoldChat = () => (wideNow() ? setChatFolded(false) : setPhoneTab('chat'));
  const threadPanel = (extra: { onBack?: () => void; onFold?: () => void; bar?: React.ReactNode; className?: string }) => threadInfo && (
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
    <AnsweringQuestion.Provider value={questionBody}>
    <WorkshopGame.Provider value={{ gameId: game.id, pages }}>
    <TrySetup.Provider value={(d) => { setTrying(d); setSetup(d.blockKey); }}>
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
          {/* The game's own settings: name, date, look, cover, routes (docs/games.md, slice 4). */}
          <Tip text={`${game.shortTitle}'s name, date, look, cover and routes`} className="shrink-0">
            <button type="button" onClick={() => setGameSettings(true)} aria-label="Game settings"
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink">
              <SlidersHorizontal size={14} aria-hidden="true" /><span className="hidden sm:inline">Game settings</span>
            </button>
          </Tip>
          <HowItWorksButton compact className="inline-flex sm:hidden" />
        </div>
      </header>

      {/* The Pages, as folder tabs standing on one edge in the chosen Page's color: the chosen
          tab is the front folder, cut into that edge, with its symbol in a piece. Everything
          (all Pages at once) is its own solid ink folder, set apart from the rest. */}
      {/* The "+" for a new Page is pinned on the right, always in view; the tabs scroll behind it. */}
      <div className="relative -mx-4 mt-3 flex shrink-0 items-end px-4 pt-1 max-lg:in-data-[phone-chat]:[@media(max-height:560px)]:hidden">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-4 bottom-0 h-0.5"
          style={{ background: chip === 'all' ? 'var(--ink)' : chip === 'notice' ? 'var(--muted)' : `var(--${pages.find((p) => p.id === chip)?.tint ?? 'ink'})` }} />
        <div className="min-w-0 flex-1">
          <ScrollRow as="nav" label="Pages">
            <div ref={tabs} className="flex w-max min-w-full items-end gap-1">
              {/* A game with no Pages yet shows only the "+", to add the first. */}
              {pages.length > 0 && <>
                <FolderTab on={chip === 'all'} everything tint="ink" icon="LayoutGrid" label="Everything" count={drafts.filter(isOpen).length} onClick={() => setChip('all')} />
                <span aria-hidden="true" className="mx-1 mb-2.5 h-6 w-px shrink-0 bg-line" />
              </>}
              {pages.map((p) => (
                <FolderTab key={p.id} on={chip === p.id} tint={p.tint} icon={p.icon} label={p.title} count={counts[p.id]} onClick={() => setChip(p.id)} />
              ))}
              <span aria-hidden="true" className="mx-1 mb-2.5 h-6 w-px shrink-0 bg-line" />
              <FolderTab on={chip === 'notice'} tint="muted" icon="Megaphone" label="Notice Board" count={live.mod ? live.reports.length : 0} onClick={() => setChip('notice')} />
            </div>
          </ScrollRow>
        </div>
        <div className="shrink-0 pl-3">
          <NewPageTab first={pages.length === 0} on={editing === 'add' && Boolean(adding?.newPage)} onClick={() => setAdding({ newPage: true })} />
        </div>
      </div>

      {jumpNote && <p role="status" className="mt-3 rounded-2xl bg-card-2 px-4 py-2 text-sm ring-1 ring-line">{jumpNote}</p>}
      {live.state === 'offline' && (
        <p role="status" className="mt-3 rounded-2xl bg-berry-soft px-4 py-3 text-sm text-berry">Couldn&apos;t reach the village just now. Refresh the page to try again.</p>
      )}

      {/* Two columns that fill the screen on wide ones, each scrolling on its own: the chat, and
          the work (Drafts, what's in the app, or an open editor). On phones, one at a time. */}
      <div ref={columns} className="mt-3 flex min-h-0 flex-1 flex-row gap-2 lg:gap-4"
        style={shownChatWidth ? { ['--chat-w' as string]: `${shownChatWidth}px` } : undefined}>
        {/* The folded chat: on phones whenever the work is showing, on wide screens once folded.
            Its icons stay in view while a phone scrolls the work. */}
        <div className={(phoneTab === 'work' ? 'flex' : 'hidden') + ' shrink-0 ' + (chatFolded ? 'lg:flex' : 'lg:hidden')}>
          <Tip text="Open the chat" tint="sky">
            <button onClick={unfoldChat} aria-label={`Open the chat, ${chat.length} messages`}
              className="flex h-full w-9 flex-col items-center rounded-2xl bg-card py-3 ring-1 ring-line hover:ring-ink lg:w-12">
              <span className="sticky top-3 flex flex-col items-center gap-3">
                <PanelLeftOpen size={18} aria-hidden="true" />
                <MessageCircle size={18} className="text-sky" aria-hidden="true" />
                <span className="text-xs font-bold">{chat.length}</span>
                {unseenMentions > 0 && (
                  <span aria-label={`${unseenMentions} new mention${unseenMentions === 1 ? '' : 's'} of you`}
                    className="rounded-full bg-signal px-1 text-xs font-bold text-ink">@{unseenMentions}</span>
                )}
              </span>
            </button>
          </Tip>
        </div>
        {/* The stream, and beside it the open thread. Where both don't fit (below the widest
            screens, on phones, and whenever an editor needs the room for its preview) the
            thread takes the stream's place, with a way back. */}
        <div data-chat-col className={(phoneTab === 'chat' && !threadInfo ? 'flex' : 'hidden') + ' min-h-0 min-w-0 flex-1 flex-col gap-2 lg:w-[var(--chat-w,26rem)] lg:flex-none lg:shrink-0 2xl:w-[var(--chat-w,30rem)] '
          + (chatFolded ? 'lg:hidden' : threadInfo ? (editing ? 'lg:hidden' : 'lg:hidden 2xl:flex') : 'lg:flex')}>
          <Stream
            topic={current ? { key: current.id, label: current.title } : null}
            onAll={() => setChip('all')}
            onFold={foldChat}
            messages={chat}
            me={me}
            live={live}
            threads={threads}
            onOpen={openThread}
          />
        </div>
        {threadInfo && (
          <div data-chat-col className={(phoneTab === 'chat' ? 'flex' : 'hidden') + ' min-h-0 min-w-0 flex-1 flex-col gap-2 lg:w-[var(--chat-w,26rem)] lg:flex-none lg:shrink-0 2xl:w-[var(--chat-w,30rem)] ' + (chatFolded ? 'lg:hidden' : 'lg:flex')}>
            {threadPanel({ onBack: () => setThread(null), onFold: foldChat })}
          </div>
        )}
        {!chatFolded && (
          <Resizer value={shownChatWidth} onReset={() => setChatWidth(0)} onWidth={setChatWidth}
            measure={() => [...(columns.current?.querySelectorAll<HTMLElement>('[data-chat-col]') ?? [])].find((el) => el.offsetWidth)?.offsetWidth ?? 416}
            limits={() => {
              // The chat may grow until the work column would get too narrow: an open editor needs
              // 768px to keep its preview beside the form.
              const all = columns.current?.offsetWidth ?? 1200;
              const shown = [...(columns.current?.querySelectorAll<HTMLElement>('[data-chat-col]') ?? [])].filter((el) => el.offsetWidth).length || 1;
              return { min: 260, max: Math.max(260, Math.min(640, (all - (editing ? 768 : 480) - 16 * (shown + 1)) / shown)) };
            }} />
        )}

        <div className={(phoneTab === 'work' ? 'flex' : 'hidden') + ' min-w-0 flex-1 flex-col lg:flex lg:min-h-0'}>
          {editing ? (
            <EditorChat.Provider value={{ count: chatCount, open: () => setChatOver(editKey) }}>
              {editing === 'add' ? (
                <AddBlock key={editKey} gameId={game.id} pages={pages} routes={routes} mod={live.mod} signedIn={Boolean(me)} newPage={Boolean(adding?.newPage)}
                  startPage={current?.id ?? null} postDraft={live.postDraft} onClose={() => setAdding(null)}
                  onAdded={(pageId) => { setAdding(null); setChip(pageId); setTab('app'); }}
                  onSubmitted={(draftId, pageId) => { setAdding(null); setChip(pageId ?? 'all'); setTab('drafts'); setDetail(draftId); }} />
              ) : editing === 'form' ? (
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
              ) : editing === 'paste' ? (
                <PasteSheet gameId={game.id} block={pasteBlock!} routes={routes} me={me} data={batchData} onClose={closePaste}
                  onSent={(id) => { const page = pasteBlock!.page.id; closePaste(); setChip(page); setTab('drafts'); setOpenBatch(id); }} />
              ) : editing === 'game' ? (
                <GameSettingsEditor gameId={game.id} mod={live.mod} me={me} postDraft={live.postDraft}
                  onSubmitted={(id) => { setGameSettings(false); setChip('all'); setTab('drafts'); setDetail(id); }} onClose={() => setGameSettings(false)} />
              ) : editing === 'type' ? (
                <ChangeType gameId={game.id} block={retypeBlock!} blocks={blocks} mod={live.mod} signedIn={Boolean(me)} postDraft={live.postDraft}
                  onSubmitted={(id) => { const page = retypeBlock!.page.id; setRetyping(null); setChip(page); setTab('drafts'); setDetail(id); }} onClose={() => setRetyping(null)} />
              ) : editing === 'wiki' ? (
                <WikiCheck gameId={game.id} block={wikiBlock!} mod={live.mod} onClose={() => setWikiFor(null)}
                  onFix={(entryId, wiki) => setForm({ blockId: wikiBlock!.id, entryId, field: 'wiki', wiki })} />
              ) : setupBlock!.type === 'planner' ? (
                <PlannerSetup gameId={game.id} block={setupBlock!} blocks={blocks} canSave={live.mod} signedIn={Boolean(me)} postDraft={live.postDraft} onSubmitted={setupSent}
                  proposal={tried?.setup.plan && trying ? { plan: tried.setup.plan, author: trying.author.name } : undefined} onClose={closeSetup} />
              ) : setupBlock!.look === 'map' ? (
                <MapSetup gameId={game.id} block={setupBlock!} me={me} mod={live.mod} drafts={drafts} postDraft={live.postDraft} sendBatch={batchData.send}
                  onBatch={(id) => { const page = setupBlock!.page.id; setSetup(null); setChip(page); setTab('drafts'); setOpenBatch(id); }} onSubmitted={setupSent} onClose={closeSetup} />
              ) : (
                <FieldSetup gameId={game.id} block={setupBlock!} blocks={blocks} routes={routes} canSave={live.mod} signedIn={Boolean(me)} postDraft={live.postDraft} onSubmitted={setupSent}
                  proposal={tried?.setup.fields && trying ? { setup: tried.setup, author: trying.author.name } : undefined} onClose={closeSetup} />
              )}
            </EditorChat.Provider>
          ) : (
          // With a Page chosen, this column is that Page's color field, and its Drafts and
          // Blocks sit on it as white panels.
          <section aria-label="Work" style={current ? { background: tint } : undefined}
            className={'relative flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-2xl px-3 pb-4 sm:px-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain ' + (current ? '' : 'bg-card ring-1 ring-line')}>
            {chip === 'notice' ? (
              <>
                <h2 className="pt-4 font-display text-xl">Notice Board</h2>
                {live.mod && <DiscordCard gameId={game.id} gameName={game.shortTitle} />}
                {live.mod && <CommunityQueue gameId={game.id} />}
                {live.mod ? <ReportQueue live={live} blocks={blocks} /> : (
                  <Empty title="No reports waiting" body="When players tap “not quite” in the app without signing in, their report waits here until a villager confirms it." />
                )}
              </>
            ) : pages.length === 0 ? (
              // A brand-new game: nothing to vote on or fix yet, only the first Page to add.
              <div className="grid flex-1 place-items-center py-10">
                <div className="grid max-w-sm justify-items-center gap-3 text-center">
                  <Piece size={72} outline><Plus size={22} aria-hidden="true" /></Piece>
                  <h2 className="font-display text-2xl">No Pages yet</h2>
                  <p className="text-sm text-muted">A game&apos;s app is made of Pages, like Units or World, and each Page holds Blocks. Start with the first one.</p>
                  <button onClick={() => setAdding({ newPage: true })} className="btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold">
                    <Plus size={16} aria-hidden="true" /> Add your first Page
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Stays in reach while the column scrolls. */}
                <div className="z-10 -mx-3 px-3 pb-2 sm:-mx-4 sm:px-4 pt-4 lg:sticky lg:top-0" style={{ background: tint }}>
                  {/* The Page's name, and its tools on the right of the same row. */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {searching ? (
                      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-card-2 px-3 py-1.5 text-sm ring-2 ring-sky">
                        <Search size={15} className="text-muted" aria-hidden="true" />
                        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearching(false); } }}
                          placeholder={view === 'drafts' ? 'Find a Draft' : view === 'questions' ? 'Find a question' : current ? `Find something in ${current.title}` : 'Find anything in the app'} aria-label="Search"
                          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
                        <button type="button" onClick={() => { setQuery(''); setSearching(false); }} aria-label="Close search" className="grid size-6 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
                          <X size={14} aria-hidden="true" />
                        </button>
                      </label>
                    ) : (
                      <>
                        {current && <span className="hidden shrink-0 sm:block"><Piece size={48} color={`var(--${current.tint})`}><BlockIcon name={current.icon} size={15} strokeWidth={2.4} /></Piece></span>}
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate font-display text-lg leading-tight sm:text-xl" title={current?.title}>{current ? current.title : 'Everything'}</h2>
                          {workSubtitle && <p className="truncate text-xs font-bold text-muted">{workSubtitle}</p>}
                        </div>
                      </>
                    )}
                    {!searching && (
                      <>
                        <Tip text={view === 'drafts' ? 'Search these Drafts' : view === 'questions' ? 'Search these questions' : "Search this Page's entries"} tint="sky" className="shrink-0">
                          <button onClick={() => setSearching(true)} aria-label="Search"
                            className="grid size-8 place-items-center rounded-full bg-card ring-1 ring-line hover:ring-ink sm:size-9">
                            <Search size={16} aria-hidden="true" />
                          </button>
                        </Tip>
                      </>
                    )}
                    {/* Two views of one Page: the changes people have suggested (paper), and what's in
                        the app now, to fix or add to (hammer). On phones they step aside while
                        searching, so the search box gets the row. */}
                    <div role="tablist" aria-label="Show" className={'inline-flex shrink-0 rounded-full bg-card p-0.5 ring-1 ring-line' + (searching ? ' max-sm:hidden' : '')}>
                      <Tip text={waiting.length ? `Drafts: ${waiting.length} waiting on you` : 'Drafts: changes villagers have suggested'}>
                        <button role="tab" aria-selected={view === 'drafts'} onClick={() => setTab('drafts')} aria-label="Drafts"
                          className={'relative grid size-7 place-items-center rounded-full sm:size-8 ' + (view === 'drafts' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
                          <FileText size={16} aria-hidden="true" />
                          {waiting.length > 0 && (
                            <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-signal px-1 text-[10px] font-bold leading-4 text-ink ring-2 ring-card">{waiting.length}</span>
                          )}
                        </button>
                      </Tip>
                      <Tip text="In the app: what's there now, to fix or add to">
                        <button role="tab" aria-selected={view === 'app'} onClick={() => setTab('app')} aria-label="In the app"
                          className={'grid size-7 place-items-center rounded-full sm:size-8 ' + (view === 'app' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
                          <Hammer size={16} aria-hidden="true" />
                        </button>
                      </Tip>
                      <Tip text={openQuestions ? `Questions: ${openQuestions} players are waiting on` : 'Questions players have asked'}>
                        <button role="tab" aria-selected={view === 'questions'} onClick={() => setTab('questions')} aria-label="Questions"
                          className={'relative grid size-7 place-items-center rounded-full sm:size-8 ' + (view === 'questions' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
                          <CircleHelp size={16} aria-hidden="true" />
                          {openQuestions > 0 && (
                            <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-card px-1 text-[10px] font-bold leading-4 text-ink ring-1 ring-line">{openQuestions}</span>
                          )}
                        </button>
                      </Tip>
                    </div>
                    {/* New entries come from the "+ Add" on each Block; this adds a Block. */}
                    <Tip text={current ? `Add a Block to ${current.title}` : 'Add a Block to a Page'} tint="leaf" className={'shrink-0' + (searching ? ' max-sm:hidden' : '')}>
                      <button onClick={() => setAdding({ newPage: false })} aria-label="Add Block" className="btn-primary inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-bold sm:h-9 sm:px-3">
                        <Plus size={16} aria-hidden="true" /> <span className="hidden whitespace-nowrap sm:inline">Add Block</span>
                      </button>
                    </Tip>
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
                      <span className="flex-1">{posted.removal
                        ? <>Your request to remove <span className="font-bold">{posted.name}</span> is in. It waits for votes from other Builders, then a moderator decides.</>
                        : <>Your Draft for <span className="font-bold">{posted.name}</span> is in. It waits for votes from other Builders, then a moderator publishes it to the app on Market Day.</>}</span>
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
                      {shownBatches.length > 0 && (
                        <>
                          <Tip text="Rows pasted from a spreadsheet. Vote once for the whole batch; set aside any row that's off" className="mt-3 self-start">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted">Batches from sheets · {shownBatches.length}</p>
                          </Tip>
                          <ul className="mt-2 grid gap-3">
                            {shownBatches.map((b) => (
                              <BatchCard key={b.id} batch={b} place={placeOf(b.blockKey)} routes={routes} me={me} mod={live.mod} data={batchData} startOpen={b.id === openBatch} />
                            ))}
                          </ul>
                        </>
                      )}
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
                      ) : waiting.length > 0 || shownBatches.length > 0 ? (
                        <p className="mt-2 text-sm text-muted">Nothing else here{sort === 'shipped' ? ' published yet' : ''}.</p>
                      ) : (
                        <Empty title={sort === 'shipped' ? 'Nothing published yet' : 'No Drafts here yet'}
                          body={sort === 'shipped' ? 'Drafts land here once a moderator publishes them to the app.' : 'Spotted something missing or wrong? Find it under In the app, or start something new.'}
                          action={sort === 'shipped' ? undefined : <button onClick={() => setTab('app')} className="rounded-full bg-card px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">See what&apos;s in the app</button>} />
                      )}
                    </>
                  )
                ) : view === 'questions' ? (
                  <QuestionsTab data={questions} pages={pages} blocks={blocks} page={current} drafts={drafts} me={me} mod={live.mod} query={query}
                    reported={new Set(live.reports.flatMap((r) => ('questionId' in r.target ? [r.target.questionId] : [])))}
                    onAnswer={(a) => setForm({ blockId: a.blockId, entryId: a.entryId, question: a.question })} onOpenDraft={setDetail} />
                ) : (
                  <AppContents pages={current ? [current] : pages} drafts={drafts} query={query} onReorder={live.mod ? reorderBlocks : undefined} focus={form?.entryId ? `${form.blockId}.${form.entryId}` : undefined}
                    onFix={(blockId, entryId) => setForm({ blockId, entryId })} onAdd={(blockId) => setForm({ blockId })} onSetup={setSetup} onRetype={setRetyping} onPaste={setPasting} onWiki={setWikiFor}
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
            className: 'rounded-none ring-0',
          }) : (
            <Stream
              topic={current ? { key: current.id, label: current.title } : null}
              onAll={() => setChip('all')}
              bar={<EditSwap on="chat" count={chatCount} editLabel={`Back to ${editLabel}`} onEdit={() => setChatOver(null)} />}
              className="rounded-none ring-0"
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
    </TrySetup.Provider>
    </WorkshopGame.Provider>
    </AnsweringQuestion.Provider>
    </ChatLinks.Provider>
  );
}

/** A Page in the row across the top: its symbol in its color, in a piece when chosen, and how many Drafts wait there. */
/**
 * A Page's folder tab. The chosen one stands taller, in its Page's color, and covers the edge
 * under it, so it reads as the folder that's open; the rest sit back on the edge, quieter.
 * Everything, when chosen, is a solid ink folder with its symbol in a yellow piece.
 */
function FolderTab({ on, everything = false, tint, icon, label, count, onClick }: {
  on: boolean; everything?: boolean; tint: string; icon: string; label: string; count?: number; onClick: () => void;
}) {
  const color = `var(--${tint})`;
  const style: React.CSSProperties = on
    ? everything
      ? { background: 'var(--ink)', borderColor: 'var(--ink)' }
      : { background: `color-mix(in srgb, ${color} 12%, white)`, borderColor: color }
    : everything ? { borderColor: 'var(--ink)' } : {};
  return (
    <Tip text={count ? `${count} open Draft${count === 1 ? '' : 's'} waiting here` : 'Nothing waiting here right now'} tint={tint} className="shrink-0">
    <button onClick={onClick} aria-pressed={on} style={style}
      className={'relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-2xl border-x-2 border-t-2 pl-1.5 pr-3.5 text-sm '
        + (on
          ? `z-10 pb-1.5 pt-1.5 font-extrabold ${everything ? 'text-paper' : 'text-ink'}`
          : `mb-0.5 pb-1 pt-1 font-bold hover:bg-card hover:text-ink ${everything ? 'bg-card text-ink' : 'border-line bg-card/60 text-muted'}`)}>
      {on && everything ? (
        <Piece size={38} color="var(--signal)"><span className="text-ink"><BlockIcon name={icon} size={15} strokeWidth={2.4} /></span></Piece>
      ) : (
        <NavSymbol name={icon} color={color} on={on} size={38} />
      )}
      {label}
      {count ? <span className={'grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ' + (on && everything ? 'bg-signal text-ink' : 'bg-ink text-paper')}>{count}</span> : null}
    </button>
    </Tip>
  );
}

/** The "+" after the Page tabs: a new Page. An outline piece, the "not built yet" look. */
function NewPageTab({ first, on, onClick }: { first: boolean; on: boolean; onClick: () => void }) {
  return (
    <Tip text={first ? 'Add the first Page of this game\'s app' : 'Add a Page'} className="shrink-0">
      <button onClick={onClick} aria-label={first ? 'Add your first Page' : 'Add a Page'} aria-pressed={on}
        className={'mb-0.5 flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-2xl border-x-2 border-t-2 border-dashed pb-1 pl-1.5 pt-1 text-sm font-bold hover:bg-card hover:text-ink '
          + (on ? 'border-ink bg-card text-ink' : 'border-line text-muted') + (first ? ' pr-3.5' : ' pr-1.5')}>
        <Piece size={38} outline><Plus size={15} aria-hidden="true" /></Piece>
        {first && 'Add your first Page'}
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

/** Moderator buttons for a Draft: approve, decline with a reason, remove, or reopen; for a
 *  published removal, bring the entry back. `inApp`: the entry it's about is in the app now. */
function DraftModTools({ draft, live, inApp }: { draft: LiveDraft; live: WorkshopData; inApp: boolean }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const { run, busy, error } = useAction();
  const decide = (status: 'declined' | 'removed' | 'open', why?: string) =>
    run(() => live.moderate.decide(draft.id, status, why)).then((ok) => { if (ok) { setDeclining(false); setReason(''); } });
  const publish = () => run(() => live.moderate.publish(draft.id));
  const undecided = draft.status === 'open' || draft.status === 'checking';
  const removal = draft.action === 'remove';
  return (
    <div className="mt-3 rounded-2xl bg-sun-soft/60 p-2.5 ring-1 ring-sun/30">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-sun"><ShieldCheck size={14} aria-hidden="true" /> Moderator</span>
        {undecided ? (
          <>
            {removal
              ? <Tip text="Takes the entry out of the app now. Its versions are kept, so it can come back" tint="berry"><SmallButton tone="bad" disabled={busy} onClick={publish} icon={<Trash2 size={13} aria-hidden="true" />}>{busy ? 'Removing…' : 'Approve and remove'}</SmallButton></Tip>
              : draft.action === 'setup'
              ? <Tip text="Changes how the Block is set up in the app now. If its setup changed since this was sent, it says so instead" tint="leaf"><SmallButton tone="good" disabled={busy} onClick={publish} icon={<Check size={13} aria-hidden="true" />}>{busy ? 'Publishing…' : 'Approve and publish'}</SmallButton></Tip>
              : draft.action === 'add_page' || draft.action === 'add_block'
              ? <Tip text={draft.action === 'add_page' ? 'Adds the Page and its first Block to the app now' : 'Adds the Block to its Page now'} tint="leaf"><SmallButton tone="good" disabled={busy} onClick={publish} icon={<Check size={13} aria-hidden="true" />}>{busy ? 'Adding…' : 'Approve and add'}</SmallButton></Tip>
              : <Tip text="Puts it in the app now, as the entry's new version. Earlier versions are kept" tint="leaf"><SmallButton tone="good" disabled={busy} onClick={publish} icon={<Check size={13} aria-hidden="true" />}>{busy ? 'Publishing…' : 'Approve and publish'}</SmallButton></Tip>}
            <Tip text={removal ? 'Keep the entry, with a short reason everyone sees' : 'Say no, with a short reason everyone sees'}><SmallButton disabled={busy} onClick={() => setDeclining(!declining)} icon={<X size={13} aria-hidden="true" />}>Decline</SmallButton></Tip>
            {/* For a removal request "Remove" would read as approving it, so hiding spam is "Hide" there. */}
            <Tip text={removal ? 'Hide this request completely. For spam or abuse' : 'Hide it completely. For spam or abuse'} tint="berry"><SmallButton tone={removal ? undefined : 'bad'} disabled={busy} onClick={() => decide('removed')} icon={removal ? <EyeOff size={13} aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}>{removal ? 'Hide' : 'Remove'}</SmallButton></Tip>
          </>
        ) : draft.status === 'stable' && removal && inApp ? (
          <span className="text-xs text-muted">Brought back to the app.</span>
        ) : draft.status === 'stable' && removal ? (
          <>
            <span className="mr-1 text-xs text-muted">Removed from the app.</span>
            <Tip text="Puts the entry back in the app, as its newest version" tint="leaf"><SmallButton disabled={busy} onClick={() => run(() => live.moderate.restore(draft.id))} icon={<RotateCcw size={13} aria-hidden="true" />}>{busy ? 'Bringing back…' : 'Bring back'}</SmallButton></Tip>
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

/** The question a Draft answers, from the Workshop's questions (none before the SQL is run). */
const AnsweringQuestion = createContext<(id: string) => string | undefined>(() => undefined);
/** The game and its Pages, for a Draft that suggests a Page or Block (its preview reads them). */
const WorkshopGame = createContext<{ gameId: string; pages: Page[] }>({ gameId: '', pages: [] });
/** Opens a setup Draft in its editor, to see it with its preview. */
const TrySetup = createContext<(d: LiveDraft) => void>(() => {});

function DraftCard({ draft, place, routes, me, chatCount, onChat, live, startOpen = false }: {
  draft: LiveDraft; place?: Placed; routes: RouteOption[]; me: Villager | null | undefined;
  /** Messages in the thread this Draft belongs to (its entry's, or its own for a new entry). */
  chatCount: number; onChat: () => void;
  live: WorkshopData; startOpen?: boolean;
}) {
  const answering = useContext(AnsweringQuestion);
  const [open, setOpen] = useState(startOpen);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState('');
  // A suggested Page or Block has no entry, and its own card (20261122000000_page_block_drafts.sql).
  const structure = draft.action === 'add_page' || draft.action === 'add_block' ? structureOf(draft.content) : null;
  if (structure) return <StructureDraftCard draft={draft} structure={structure} me={me} chatCount={chatCount} onChat={onChat} live={live} startOpen={startOpen} />;
  // A game's settings have no entry or Block (20261204000000_game_settings.sql).
  const gameDraft = draft.action === 'game' ? gameSettingsOf(draft.content) : null;
  if (gameDraft) return <GameSettingsDraftCard draft={draft} settings={gameDraft} me={me} chatCount={chatCount} onChat={onChat} live={live} startOpen={startOpen} />;
  // A Block's setup has no entry either (20261127000000_setup_drafts.sql).
  const setupDraft = draft.action === 'setup' ? setupOf(draft.content) : null;
  if (setupDraft) return <SetupDraftCard draft={draft} setup={setupDraft} place={place} me={me} chatCount={chatCount} onChat={onChat} live={live} startOpen={startOpen} />;
  if (!place) return null;
  const block = place;
  const stable = draft.cardId ? block.entries.find((e) => e.ref?.card === draft.cardId) : undefined;
  // A removal request (20261120000000_remove_requests.sql) changes nothing: it takes the entry away.
  const removal = draft.action === 'remove';
  const changes = stable && draft.status !== 'stable' && !removal ? changesBetween(stable, draft.content, block, routes) : [];
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
  ) : removal ? (
    <>
      <Tip text="It shouldn't be an entry in the app" tint="berry"><VoteButton on={draft.myVote === 1} onClick={() => cast(draft.myVote === 1 ? 0 : 1)} icon={<Check size={15} aria-hidden="true" />}>Yes, remove it</VoteButton></Tip>
      <Tip text="It belongs in the app" tint="leaf"><VoteButton on={draft.myVote === -1} onClick={() => cast(draft.myVote === -1 ? 0 : -1)} icon={<X size={15} aria-hidden="true" />}>Keep it</VoteButton></Tip>
    </>
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
            {removal
              ? <Tip text="Asks to take this entry out of the app" tint="berry"><span className="rounded-full bg-berry-soft px-2 py-0.5 text-xs font-bold text-berry">remove</span></Tip>
              : draft.cardId
              ? <Tip text="Changes an entry that's already in the app" tint="sky"><span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs font-bold text-sky">fix</span></Tip>
              : <Tip text="A new entry for the app" tint="leaf"><span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-bold text-leaf">new</span></Tip>}
            {draft.theory && <Tip text="Not confirmed yet. Shown with a Theory label in the app" tint="sun"><span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold text-sun">Theory</span></Tip>}
            {needsVote && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-ink ring-1 ring-ink">Needs your vote</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Avatar name={draft.author.name} url={draft.author.avatarUrl} size={18} />
            {block.page.title === block.title ? block.title : `${block.page.title} · ${block.title}`} · {draft.author.name} · {ago(draft.createdAt)} · {STATUS[draft.status] ?? draft.status}
          </span>
          {draft.questionId && (
            <span className="mt-1 flex items-start gap-1.5 text-sm">
              <CircleHelp size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <span><span className="font-bold">Answers:</span> {answering(draft.questionId) ?? 'a question'}{draft.reply && <span className="text-muted"> · reply: “{draft.reply}”</span>}</span>
            </span>
          )}
        </span>
      </button>
      {removal && draft.source && (
        <p className="mt-2 rounded-2xl bg-card-2 px-3 py-2 text-sm ring-1 ring-line"><span className="font-bold">Why:</span> {draft.source}</p>
      )}
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
          {draft.cardId && !stable && draft.status !== 'stable' && <p className="text-sm text-muted">{removal ? 'This entry is no longer in the app.' : 'The entry this fixes is no longer in the app.'}</p>}
          {removal && <p className="text-xs font-bold uppercase tracking-wide text-muted">{draft.status === 'stable' ? 'What was removed' : 'What would be removed'}</p>}
          <div className="rounded-2xl bg-card-2 p-3 ring-1 ring-line"><EntryDetails entry={draft.content} block={block} route="all" routes={routes} color={`var(--${block.page.tint})`} /></div>
          {draft.source && !removal && <p className="text-sm text-muted"><span className="font-bold text-ink">Source:</span> {draft.source}</p>}
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
      {live.mod && <DraftModTools draft={draft} live={live} inApp={Boolean(stable)} />}
    </li>
  );
}

/**
 * A Draft that suggests a new Page (with its first Block) or a Block: what it adds, the same preview
 * its author saw, up and down votes (whether the app should have it is a matter of opinion), and a
 * moderator's Approve and add.
 */
/**
 * A Draft that changes the app's shape rather than an entry: a new Page or Block, or a Block's setup.
 * Up and down votes (whether the app should have it is an opinion), its thread, reports, and the
 * moderator's buttons. `children` is what it does, shown when it's opened.
 */
function ProposalCard({ draft, me, chatCount, onChat, live, startOpen, piece, badge, badgeTip, sub, children }: ProposalProps & {
  piece: React.ReactNode; badge: string; badgeTip: string; sub: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState('');
  const mine = me?.id === draft.author.id && !me.practice;
  const reported = live.myReports.has(targetKey({ draftId: draft.id }));
  const total = draft.ups + draft.downs;
  const leaning = total === 0 ? 'no votes yet' : draft.ups >= draft.downs ? 'leaning yes' : 'leaning no';
  const cast = async (v: 0 | 1 | -1) => setError((await live.vote(draft.id, v)) ?? '');
  const expand = () => { if (!open) live.view(draft.id); setOpen(!open); };
  const needsVote = Boolean(me && !mine && !draft.myVote && (draft.status === 'open' || draft.status === 'checking'));

  return (
    <li className={'rise rounded-3xl bg-card p-3 ' + (needsVote ? 'ring-1 ring-ink/40 ' : 'ring-1 ring-line ') + (draft.status === 'removed' ? 'opacity-60' : '')}>
      <button onClick={expand} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        {piece}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg leading-tight">{draft.title}</span>
            <Tip text={badgeTip} tint="plum">
              <span className="rounded-full bg-plum-soft px-2 py-0.5 text-xs font-bold text-plum">{badge}</span>
            </Tip>
            {needsVote && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-ink ring-1 ring-ink">Needs your vote</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Avatar name={draft.author.name} url={draft.author.avatarUrl} size={18} />
            {sub} · {draft.author.name} · {ago(draft.createdAt)} · {STATUS[draft.status] ?? draft.status}
          </span>
        </span>
      </button>
      {draft.status === 'declined' && draft.declineReason && (
        <p className="mt-2 rounded-2xl bg-card-2 px-3 py-2 text-sm ring-1 ring-line"><span className="font-bold">Declined:</span> {draft.declineReason}</p>
      )}
      {open && <div className="mt-3 grid gap-2">{children}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {me === null ? <SignInPrompt>Sign in to vote</SignInPrompt> : !me ? null : mine ? (
          <span className="text-sm text-muted">Your Draft · {total >= 5 ? `${draft.ups} up · ${draft.downs} down` : leaning}</span>
        ) : (
          <>
            <Tip text="The app should have this"><VoteButton on={draft.myVote === 1} onClick={() => cast(draft.myVote === 1 ? 0 : 1)} icon={<ArrowUp size={15} aria-hidden="true" />} label="Vote up" /></Tip>
            <span className="text-sm text-muted">{total >= 5 ? `${draft.ups} up · ${draft.downs} down` : leaning}</span>
            <Tip text="Not needed, or not like this"><VoteButton on={draft.myVote === -1} onClick={() => cast(draft.myVote === -1 ? 0 : -1)} icon={<ArrowDown size={15} aria-hidden="true" />} label="Vote down" /></Tip>
          </>
        )}
        <span className="ml-auto flex items-center gap-1">
          {me && !mine && (reported
            ? <span className="px-2 text-xs font-bold text-muted">Reported</span>
            : <Tip text="Report spam or rudeness" tint="berry">
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
      {error && <p role="status" className="mt-2 text-sm text-berry">{error}</p>}
      {reporting && !reported && <ReportForm target={{ draftId: draft.id }} live={live} onDone={() => setReporting(false)} />}
      {live.mod && <DraftModTools draft={draft} live={live} inApp={false} />}
    </li>
  );
}

type ProposalProps = { draft: LiveDraft; me: Villager | null | undefined; chatCount: number; onChat: () => void; live: WorkshopData; startOpen: boolean };

function StructureDraftCard({ structure, ...props }: ProposalProps & { structure: StructureContent }) {
  const { gameId, pages } = useContext(WorkshopGame);
  const { draft } = props;
  const b = structure.block;
  const info = blockTypeInfo(b.type);
  const target = structure.pageKey ? pages.find((p) => p.id === structure.pageKey) : undefined;
  const tint = structure.page?.tint ?? target?.tint ?? 'leaf';
  const newPage = draft.action === 'add_page';
  const where = newPage ? `a new Page, ${structure.page?.title ?? ''}` : target ? `the ${target.title} Page` : 'a Page that\'s no longer in the app';
  return (
    <ProposalCard {...props} sub={info?.name ?? b.type}
      piece={<Piece size={40} color={`var(--${tint})`}><BlockIcon name={newPage ? structure.page?.icon ?? b.icon : b.icon} size={15} strokeWidth={2.4} /></Piece>}
      badge={newPage ? 'new Page' : 'new Block'} badgeTip={newPage ? 'Suggests a new Page for the app, with its first Block' : 'Suggests a new Block for a Page'}>
      <p className="text-sm">
        Adds a <span className="font-bold">{info?.name ?? b.type}</span> Block called <span className="font-bold">{b.title}</span> to {where}.
        {b.intro && <span className="text-muted"> “{b.intro}”</span>}
      </p>
      <div className="rounded-2xl p-3" style={{ background: `var(--${tint}-soft)` }}>
        <StructurePreview content={structure} pages={pages} gameId={gameId} />
      </div>
    </ProposalCard>
  );
}

/** A game's settings as a Draft (20261204000000): what they change, in words, and a new cover if there is one. */
function GameSettingsDraftCard({ settings, ...props }: ProposalProps & { settings: GameSettingsContent }) {
  const changes = settingsChanges(settings.before, settings.game);
  return (
    <ProposalCard {...props} sub="Game settings"
      piece={<Piece size={40} color="var(--ink)"><SlidersHorizontal size={15} strokeWidth={2.4} className="text-white" aria-hidden="true" /></Piece>}
      badge="game" badgeTip="Suggests the game's own settings: its name, date, look, cover or routes">
      <ul className="grid gap-1 text-sm">
        {changes.map((c, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />{c}</li>)}
      </ul>
      {settings.game.cover && (
        // eslint-disable-next-line @next/next/no-img-element -- a Builder's upload, shown as it is
        <img src={coverSrc(settings.game.cover)} alt="The suggested cover" className="aspect-[16/9] max-h-56 w-fit max-w-full rounded-xl object-cover ring-1 ring-line" />
      )}
    </ProposalCard>
  );
}

/** A Block's setup as a Draft (20261127000000): what it changes, in words, and a way to see it with its preview. */
function SetupDraftCard({ setup, place, ...props }: ProposalProps & { setup: SetupContent; place?: Placed }) {
  const { gameId, pages } = useContext(WorkshopGame);
  const tryIt = useContext(TrySetup);
  const { draft } = props;
  const kind = kindOf(setup.setup);
  const name = (key: string) => pages.flatMap((p) => p.blocks).find((b) => b.id === key)?.title ?? key;
  // What it changes from the setup it started from, so it still reads right once it's decided.
  const was = place && { type: setup.before.type ?? place.type, fields: setup.before.fields ?? undefined, stats: setup.before.stats ?? undefined, planSetup: setup.before.plan ?? undefined, map: setup.before.map ?? undefined };
  const changes = was ? setupChanges(was, setup.setup, name) : [];
  // Publishing refuses once the Block's setup has moved on from where this started; say so up front.
  const part = (b: { fields?: unknown; stats?: unknown; plan?: unknown; map?: unknown; type?: unknown }) =>
    JSON.stringify(kind === 'fields' ? [b.fields ?? null, b.stats ?? null] : kind === 'plan' ? b.plan ?? null : kind === 'type' ? b.type ?? null : b.map ?? null);
  const stale = Boolean(place) && (draft.status === 'open' || draft.status === 'checking')
    && part({ fields: place?.fields, stats: place?.stats, plan: place?.planSetup, map: place?.map, type: place?.type }) !== part(setup.before);
  const tint = place?.page.tint ?? 'slate';
  return (
    <ProposalCard {...props} sub={place ? (place.page.title === place.title ? place.title : `${place.page.title} · ${place.title}`) : 'A Block that\'s no longer in the app'}
      piece={<Piece size={40} color={`var(--${tint})`}><BlockIcon name={place?.icon ?? 'SlidersHorizontal'} size={15} strokeWidth={2.4} /></Piece>}
      badge={kind === 'map' ? 'map' : kind === 'type' ? 'type' : 'setup'}
      badgeTip={kind === 'map' ? 'Suggests a map picture for this Block' : kind === 'type' ? 'Suggests another type for this Block, while nothing is in it' : 'Suggests how this Block is set up: its fields, or what it picks from'}>
      {changes.length ? (
        <ul className="grid gap-1 text-sm">
          {changes.map((c, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: `var(--${tint})` }} />{c}</li>)}
        </ul>
      ) : <p className="text-sm text-muted">Nothing changes from the setup it started from.</p>}
      {kind === 'map' && setup.setup.map?.picture && (
        // eslint-disable-next-line @next/next/no-img-element -- a community upload of any size, shown as it is
        <img src={mapPictureUrl(setup.setup.map.picture)} alt={`The suggested map for ${place?.title ?? 'this Block'}`} className="max-h-64 w-fit max-w-full rounded-xl ring-1 ring-line" />
      )}
      {kind === 'type' && setup.setup.type && place && (
        <div className="rounded-2xl p-3" style={{ background: `var(--${tint}-soft)` }}>
          <TypePreview gameId={gameId} type={setup.setup.type} tint={tint} title={place.title} icon={place.icon} />
        </div>
      )}
      {stale && <p className="rounded-xl bg-sun-soft px-3 py-2 text-sm"><span className="font-bold">The setup changed since this was sent,</span> so it can&apos;t be published as it is. Its author can open Set up and send it again.</p>}
      {kind !== 'map' && kind !== 'type' && place && (
        <button type="button" onClick={() => tryIt(draft)} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink">
          <SlidersHorizontal size={14} aria-hidden="true" /> See it in Set up
        </button>
      )}
    </ProposalCard>
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
    return <Empty title="No reports waiting" body="When a villager reports a message, a Draft, a question or a video, it waits here. Only moderators see reports." />;
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
  const questionPage = r.question ? blocks.find((b) => b.page.id === r.question!.pageKey)?.page : undefined;
  const videoBlock = r.video ? blocks.find((b) => b.id === r.video!.blockKey) : undefined;
  const videoEntry = videoBlock?.entries.find((e) => e.id === r.video!.slug);
  const reasonEntry = r.tierReason ? blocks.find((b) => b.id === r.tierReason!.blockKey)?.entries.find((e) => e.id === r.tierReason!.slug) : undefined;
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
      ) : r.question ? (
        <p className="mt-2 rounded-2xl bg-card p-2.5 text-sm ring-1 ring-line">
          <span className="font-bold">Question:</span> {r.question.body}
          <span className="text-muted">{questionPage ? ` · ${questionPage.title}` : ''}{r.question.spoiler ? ' · spoiler' : ''}{r.question.status === 'removed' ? ' · removed' : ''}</span>
        </p>
      ) : r.video ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-2xl bg-card p-2.5 text-sm ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
          <img src={thumbUrl(r.video.youtubeId)} alt="" className="aspect-video w-24 shrink-0 rounded-lg object-cover" />
          <p className="min-w-0">
            <span className="font-bold">Video</span>
            <span className="text-muted">{videoEntry ? ` on ${videoEntry.name}` : ''}{r.video.status === 'removed' ? ' · taken down' : ''}</span>{' '}
            <a href={watchUrl(r.video.youtubeId, r.video.start)} target="_blank" rel="noopener noreferrer" className="font-bold underline">Watch on YouTube</a>
          </p>
        </div>
      ) : r.tierReason ? (
        <p className="mt-2 rounded-2xl bg-card p-2.5 text-sm ring-1 ring-line">
          <span className="font-bold">Tier list reason{reasonEntry ? ` for ${reasonEntry.name}` : ''}:</span>{' '}
          {r.tierReason.text ?? <span className="text-muted">taken down</span>}
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
        ) : 'videoId' in r.target ? r.video?.status !== 'removed' && (
          <SmallButton tone="bad" disabled={busy} onClick={() => run(() => live.moderate.removeVideo((r.target as { videoId: string }).videoId))}
            icon={<Trash2 size={13} aria-hidden="true" />}>Take video down</SmallButton>
        ) : 'tierReasonId' in r.target ? r.tierReason?.text != null && (
          <SmallButton tone="bad" disabled={busy} onClick={() => run(() => live.moderate.removeTierReason((r.target as { tierReasonId: string }).tierReasonId))}
            icon={<Trash2 size={13} aria-hidden="true" />}>Remove reason</SmallButton>
        ) : 'questionId' in r.target ? r.question?.status !== 'removed' && (
          <SmallButton tone="bad" disabled={busy} onClick={() => run(() => live.moderate.removeQuestion((r.target as { questionId: string }).questionId))}
            icon={<Trash2 size={13} aria-hidden="true" />}>Remove question</SmallButton>
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

/** A to Z, with numbers in order ("Chapter 2" before "Chapter 10"), ignoring case and accents. */
const AZ = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * A long list split by its Block's first tag (Sword, Gauntlet, Black Magic…), in the tag's own list order
 * and then A to Z, with entries that have none last. Null where it wouldn't help: a short list, or one group.
 */
function groupsOf(b: Page['blocks'][number], list: Entry[]) {
  // The tag the app groups and filters this Block by (its filter), as the Items Block does; else its first.
  const tags = byFields(b) ? shownFields(b).filter((f) => f.kind === 'tag') : [];
  const tag = tags.find((t) => t.key === b.filters?.[0]) ?? tags[0] ?? (b.filters?.[0] ? { key: b.filters[0], label: b.filters[0] } : undefined);
  if (!tag || list.length <= 12) return null;
  const by = new Map<string, Entry[]>();
  for (const e of list) {
    const v = e.categories[tag.key]?.trim() ?? '';
    by.set(v, [...(by.get(v) ?? []), e]);
  }
  const named = [...by.keys()].filter(Boolean);
  if (named.length < 2) return null;
  // The tag's own list of choices sets the order; without one, letter ranks go best first (groupOrder), else A to Z.
  const order = choicesOf('choices' in tag ? tag : undefined).map((x) => x.name);
  const az = groupOrder(named.sort(AZ.compare));
  const at = (v: string) => (order.includes(v) ? order.indexOf(v) : order.length + az.indexOf(v));
  named.sort((x, y) => at(x) - at(y));
  return [...named, ...(by.has('') ? [''] : [])].map((v) => ({
    label: v || `No ${tag.label.toLowerCase()}`, symbol: v ? b.symbols?.[v] : undefined, entries: by.get(v)!,
  }));
}

/** An entry's piece in a Workshop list: solid once it's filled in, a split outline while it still needs
 *  something (the brand's "solid = built, split outline = not built yet"). */
function RowPiece({ entry, block, color, done }: { entry: Entry; block: Page['blocks'][number]; color: string; done: boolean }) {
  const symbol = symbolFor(entry, block);
  const inner = done && entry.icon ? null : symbol ? <BlockIcon name={symbol} size={8} strokeWidth={2.6} /> : initials(entry.name) || <BlockIcon name={block.icon} size={8} />;
  return <Piece size={38} color={color} outline={!done} image={done ? entry.icon : undefined}>{inner}</Piece>;
}

/**
 * "In the app": what's on the selected Page right now, Block by Block, so villagers can
 * pick something to fix or add to without leaving the Workshop.
 */
function AppContents({ pages, drafts, query, focus, onFix, onAdd, onDrafts, onSetup, onRetype, onPaste, onWiki, onReorder }: {
  pages: Page[]; drafts: LiveDraft[]; query: string; focus?: string;
  /** Moderators: saves a new order for a Page's Blocks, dragged by the grip at each Block's top left. */
  onReorder?: (pageId: string, blockIds: string[]) => void;
  onFix: (blockId: string, entryId: string) => void; onAdd: (blockId: string) => void; onDrafts: (cardId: string) => void;
  /** Characters and Items Blocks: open their field setup. Places Blocks: their map. */
  onSetup: (blockId: string) => void;
  /** An empty Block: change its type (ChangeType.tsx). */
  onRetype: (blockId: string) => void;
  /** Paste rows from a spreadsheet (docs/blocks/spreadsheets.md). */
  onPaste: (blockId: string) => void;
  /** Characters, Items and Collections: their wiki links (docs/blocks/wiki-links.md). */
  onWiki: (blockId: string) => void;
}) {
  const [folded, setFolded] = useStored<string[]>('village:workshop:folded-blocks', []);
  // Every Block in the game, for whether a Tier list or Planner uses one (then its type stays).
  const allBlocks = useMemo(() => pages.flatMap((p) => p.blocks), [pages]);
  const fold = (id: string) => setFolded(folded.includes(id) ? folded.filter((x) => x !== id) : [...folded, id]);
  const open = useMemo(() => {
    const n = new Map<string, number>();
    for (const d of drafts) if (d.cardId && (d.status === 'open' || d.status === 'checking')) n.set(d.cardId, (n.get(d.cardId) ?? 0) + 1);
    return n;
  }, [drafts]);
  const many = pages.length > 1;
  // Blocks showing only the entries that still need something ("Needs help").
  const [needsOnly, setNeedsOnly] = useState<string[]>([]);
  const toggleNeeds = (id: string) => setNeedsOnly(needsOnly.includes(id) ? needsOnly.filter((x) => x !== id) : [...needsOnly, id]);
  // One Page open, a moderator, and not searching: its Blocks can be dragged into order.
  const single = pages.length === 1 ? pages[0] : null;
  const arrange = Boolean(single && onReorder && !query && single.blocks.length > 1);
  const sort = useDragSort(single ? single.blocks.map((b) => b.id) : [], (ids) => { if (single) onReorder?.(single.id, ids); });
  const inOrder = (p: Page) => (arrange ? sort.ids.map((id) => p.blocks.find((b) => b.id === id)!).filter(Boolean) : p.blocks);
  const grip = (b: Page['blocks'][number]) => arrange && (
    <Tip text="Drag to move this Block up or down the Page" className="shrink-0">
      <button type="button" aria-label={`Move ${b.title}: drag, or use the up and down arrow keys`} {...sort.handle(b.id)}
        className="-ml-1 grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
        <GripVertical size={16} aria-hidden="true" />
      </button>
    </Tip>
  );
  const lifted = (b: Page['blocks'][number]) => (arrange && sort.dragging === b.id ? ' relative z-10 shadow-soft ring-2 ring-ink' : '');
  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-5">
      {query && !pages.some((p) => p.blocks.some((b) => rank(b.entries, query, entryText).length > 0)) && (
        <p className="rounded-2xl bg-card-2 px-3 py-3 text-sm text-muted">Nothing matches “{query}”. Try another word, or add it as something new.</p>
      )}
      {pages.map((p) => (
        <div key={p.id} className="grid grid-cols-[minmax(0,1fr)] gap-5">
          {many && <h3 className="flex items-center gap-2 font-display text-lg"><BlockIcon name={p.icon} size={16} /> {p.title}</h3>}
          {inOrder(p).map((b) => {
            // A to Z, so an entry is easy to find to fix (Matt); while searching, best matches first.
            const list = query ? rank(b.entries, query, entryText) : [...b.entries].sort((x, y) => AZ.compare(x.name, y.name));
            if (query && !list.length) return null;
            const isFolded = folded.includes(b.id) && !query;
            // What each entry still needs: split outlines where help is wanted, and a progress line.
            const c = completeness(b);
            const needy = c.total - c.done;
            const onlyNeedy = needy > 0 && needsOnly.includes(b.id) && !query;
            const shown = onlyNeedy ? list.filter((e) => c.missing.get(e.id)?.length) : list;
            const groups = query ? null : groupsOf(b, shown);
            // A Planner has players' plans, not entries: only its Set up here.
            if (b.type === 'planner') return query ? null : (
              <section key={b.id} ref={arrange ? sort.itemRef(b.id) : undefined} className={'min-w-0 rounded-2xl bg-card p-3' + lifted(b)}
                style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--${p.tint}) 22%, var(--line))` }}>
                <div className="flex items-center gap-2">
                  {grip(b)}
                  <BlockIcon name={b.icon} size={17} className="shrink-0" style={{ color: `var(--${p.tint})` }} />
                  <h4 className="min-w-0 flex-1 truncate font-bold">{b.title}</h4>
                  <Tip text={`Choose what players build ${b.title} from, how many fit, and the gear slots`} tint={p.tint} className="shrink-0">
                    <button onClick={() => onSetup(b.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                      <SlidersHorizontal size={13} aria-hidden="true" /> Set up
                    </button>
                  </Tip>
                </div>
                <p className="mt-2 text-sm text-muted">Players plan their own party here. Their plans are private, so there&apos;s nothing to add or fix: Set up chooses what they pick from.</p>
              </section>
            );
            return (
              // A Block of the app: a white panel with a hairline in its Page's color.
              <section key={b.id} ref={arrange ? sort.itemRef(b.id) : undefined} className={'min-w-0 rounded-2xl bg-card p-3' + lifted(b)}
                style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--${p.tint}) 22%, var(--line))` }}>
                <div className="flex items-center gap-2">
                  {grip(b)}
                  <button onClick={() => fold(b.id)} aria-expanded={!isFolded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <BlockIcon name={b.icon} size={17} className="shrink-0" style={{ color: `var(--${p.tint})` }} />
                    <h4 className="truncate font-bold">{b.title}</h4>
                    <ChevronDown size={15} className={'shrink-0 text-muted transition ' + (isFolded ? '-rotate-90' : '')} aria-hidden="true" />
                  </button>
                  {/* Nothing in it yet: it can still become another type (Ocarina's Items was a Collection). */}
                  {!retypeProblem(b, allBlocks) && (
                    <Tip text={`Make ${b.title} another type of Block, while nothing is in it`} tint={p.tint} className="shrink-0">
                      <button onClick={() => onRetype(b.id)} aria-label={`Change the type of ${b.title}`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                        <Shapes size={13} aria-hidden="true" /><span className="hidden sm:inline">Type</span>
                      </button>
                    </Tip>
                  )}
                  {hasFieldSetup(b) && (
                    <Tip text={b.type === 'items' ? `Choose what ${b.title} tiles and full views show, with a preview` : b.type === 'classes' ? `Choose the fields ${b.title} cards show, with a sample class`
                      : b.type === 'checklist' ? `Choose what each row of ${b.title} shows, with a preview` : b.type === 'timeline' ? `Choose what each part of ${b.title} shows, with a preview`
                      : `Choose the fields ${b.title} cards show, with a preview`} tint={p.tint} className="shrink-0">
                      <button onClick={() => onSetup(b.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                        <SlidersHorizontal size={13} aria-hidden="true" /> Set up
                      </button>
                    </Tip>
                  )}
                  {b.type === 'collection' && b.look === 'map' && (
                    <Tip text={`The map picture, and a pin for each place in ${b.title}`} tint={p.tint} className="shrink-0">
                      <button onClick={() => onSetup(b.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                        <MapPin size={13} aria-hidden="true" /> Map
                      </button>
                    </Tip>
                  )}
                  {(b.type === 'characters' || b.type === 'items' || b.type === 'classes' || b.type === 'collection') && (
                    <Tip text={`Which of ${b.title} link to the game's wiki, and which need a look`} tint={p.tint} className="shrink-0">
                      <button onClick={() => onWiki(b.id)} aria-label={`Wiki links for ${b.title}`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                        <BookOpenText size={13} aria-hidden="true" /><span className="hidden sm:inline">Wiki</span>
                      </button>
                    </Tip>
                  )}
                  {b.type !== 'guide' && b.type !== 'tierlist' && (
                    <Tip text={`Paste rows from Excel or Google Sheets into ${b.title}`} tint={p.tint} className="shrink-0">
                      <button onClick={() => onPaste(b.id)} aria-label={`Paste rows into ${b.title}`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                        <ClipboardPaste size={13} aria-hidden="true" /><span className="hidden sm:inline">Paste</span>
                      </button>
                    </Tip>
                  )}
                  <Tip text={`Add something new to ${b.title}`} tint={p.tint} className="shrink-0">
                    <button onClick={() => onAdd(b.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-leaf">
                      <Plus size={13} aria-hidden="true" /> Add
                    </button>
                  </Tip>
                </div>
                {/* How much is filled in: a bar in the Page's color, and a way to see only what needs help. */}
                {c.total > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                    <span aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded-full bg-card-2 ring-1 ring-line">
                      <span className="block h-full rounded-full" style={{ width: `${Math.round((c.done / c.total) * 100)}%`, background: `var(--${p.tint})` }} />
                    </span>
                    <span className="font-bold">{c.done} of {c.total} filled in</span>
                    {needy === 0 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-leaf"><Check size={13} aria-hidden="true" /> All done</span>
                    ) : !query && (
                      <Tip text={onlyNeedy ? `Show everything in ${b.title}` : `Show only what still needs something, with what's missing`} tint="plum">
                        <button onClick={() => toggleNeeds(b.id)} aria-pressed={onlyNeedy}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold ring-1"
                          style={onlyNeedy ? { background: GLITCH.violet, color: '#fff', boxShadow: 'none' } : { color: GLITCH.violet, ['--tw-ring-color' as string]: `color-mix(in srgb, ${GLITCH.violet} 45%, transparent)` }}>
                          <Piece size={14} outline ink={onlyNeedy ? '#fff' : 'var(--ink)'} />
                          {onlyNeedy ? 'Showing what needs help' : `${needy} need${needy === 1 ? 's' : ''} help`}
                        </button>
                      </Tip>
                    )}
                  </div>
                )}
                {isFolded ? null : list.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Nothing here yet. Add the first one.</p>
                ) : (
                  <ScrollBox as="ul" className="mt-2 grid max-h-80 grid-cols-[minmax(0,1fr)] gap-0.5 pb-6 pr-1">
                    {(groups ?? [{ label: '', symbol: undefined, entries: shown }]).flatMap((g) => [
                      // A group's name, kept in view while its entries scroll past.
                      ...(groups ? [(
                        <li key={`group:${g.label}`} className="sticky top-0 z-[1] -mx-0.5 flex items-center gap-1.5 bg-card px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted">
                          {g.symbol && <BlockIcon name={g.symbol} size={13} style={{ color: `var(--${p.tint})` }} />}
                          <span className="truncate">{g.label}</span>
                          <span className="font-normal normal-case tracking-normal">{g.entries.length}</span>
                        </li>
                      )] : []),
                      ...g.entries.map((e) => {
                        const n = e.ref ? open.get(e.ref.card) ?? 0 : 0;
                        const on = focus === `${b.id}.${e.id}`;
                        const miss = c.missing.get(e.id) ?? [];
                        const done = miss.length === 0;
                        return (
                          <li key={e.id}>
                            <button onClick={() => onFix(b.id, e.id)} aria-label={`Fix ${e.name}${done ? '' : `: needs ${miss.join(', ')}`}`}
                              className={'group flex w-full items-center gap-2.5 rounded-2xl px-2 py-1 text-left hover:bg-card-2 ' + (on ? 'bg-card-2 ring-2 ring-ink' : '')}>
                              <RowPiece entry={e} block={b} color={`var(--${p.tint})`} done={done} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold">{e.name}</span>
                                {done
                                  ? <span className="block truncate text-xs text-muted">{e.stat ?? (groups ? undefined : Object.values(e.categories)[0]) ?? e.description}</span>
                                  : <span className="block truncate text-xs font-bold" style={{ color: GLITCH.violet }}>Needs {miss.join(' · ')}</span>}
                              </span>
                              {n > 0 && (
                                <span role="button" tabIndex={0} onClick={(ev) => { ev.stopPropagation(); onDrafts(e.ref!.card); }}
                                  onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); onDrafts(e.ref!.card); } }}
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-ink ring-1 ring-ink hover:bg-card-2">{n} open Draft{n > 1 ? 's' : ''}</span>
                              )}
                              {/* The whole row fixes it; a pencil shows on the one you point at. */}
                              <PenLine size={14} aria-hidden="true" className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
                            </button>
                          </li>
                        );
                      }),
                    ])}
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
