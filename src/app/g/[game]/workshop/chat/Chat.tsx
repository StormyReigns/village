'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CornerUpLeft, Link2, EyeOff, FileText, Flag, ImagePlus, MessageCircle, MoreHorizontal, PanelLeftClose, PanelRight, PenLine, Play, ExternalLink, RotateCcw, Send, SmilePlus, Sparkles, Trash2, X } from 'lucide-react';
import type { Block, Entry, EntryContent, Page } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { EntryIcon, type RouteOption } from '@/components/app/EntryPanel';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Avatar } from '@/components/Avatar';
import { Tip } from '@/components/Tip';
import type { Villager } from '@/components/useVillager';
import { sharePath } from '@/data/pages/links';
import { blockThread, buildStream, draftThread, entryThread, resolveThread, threadOf, type ThreadKey } from '@/lib/threads';
import { encodeRefs, insertPick, mentionsIn, mentionToken, plainRefs, refsIn as refs, refToken, splitRefs, typedMark } from '@/lib/refs';
import { findLinks, linksIn, messageLink, messagePath, VILLAGE_HOSTS, villagePath, youTube } from '@/lib/links';
import { resolveItem } from '@/data/pages/links';
import { rank, type Searchable } from '@/lib/search';
import { findReactions, QUICK } from '@/lib/reactions';
import { browserClient } from '@/lib/supabase/browser';
import { imageUrl, targetKey, uploadChatImage, type Attachment, type ChatMessage, type LiveDraft, type Reaction, type WorkshopData } from '../useWorkshop';
import { changesBetween } from '../changes';
import { ChangeList } from '../EntryForm';
import { ago, clock, fullTime, ReportForm, SmallButton, useAction } from './bits';

// The Workshop's chat (docs/chat.md): one stream for the whole game, and a thread for each
// thing being built. A thread shows in the stream as a card at its newest message, with a
// reply box, and opens as its own panel beside the stream (or over it, where there's no room).

/** A Block together with the Page it sits on. */
export type Placed = Block & { page: Page };

/** What a thread is about, for its card and its panel. */
export interface ThreadInfo {
  key: ThreadKey;
  title: string;
  /** "Units and classes · Characters" */
  where: string;
  kind: 'entry' | 'new' | 'setup' | 'unknown';
  block?: Placed;
  entry?: Entry;
  /** The Drafts that belong to it, oldest first. */
  drafts: LiveDraft[];
  /** Keys its messages may be stored under (a new entry's Draft keeps its own until published). */
  storedKeys: ThreadKey[];
}

// The chat's wallpaper (agreed 2026-11-01): faint houses and genre shapes behind the messages,
// so the chat reads as a place rather than a blank list. The list reaches the box's edges, with
// a thin scrollbar right at the edge, to give the messages all the width.
const WALL_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><g fill='none' stroke='#15171c' stroke-opacity='.07' stroke-width='1.5' stroke-linejoin='round'>"
  + "<path d='M8 25l9-8 9 8v10H8z'/><circle cx='52' cy='17' r='5'/><path d='M51 45l7 7-7 7-7-7z'/><path d='M19 50l6 10H13z'/></g></svg>";
const WALL: React.CSSProperties = {
  backgroundColor: 'var(--paper)',
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(WALL_SVG)}")`,
  scrollbarWidth: 'thin',
  scrollbarColor: 'color-mix(in srgb, var(--ink) 25%, transparent) transparent',
};
/**
 * A thread is a smaller room inside the main chat: a slightly darker frame, and the same
 * wallpaper a shade darker with its shapes drawn smaller and closer together.
 */
const THREAD_FRAME = 'color-mix(in srgb, var(--ink) 5%, var(--card))';
const THREAD_WALL: React.CSSProperties = {
  ...WALL,
  backgroundColor: 'color-mix(in srgb, var(--ink) 7%, var(--paper))',
  backgroundSize: '48px 48px',
};
/** The message list: edge to edge in the chat box (which has 1rem of padding), on the wallpaper. */
const WALL_LIST = '-mx-4 my-3 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-4 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3';

const whereOf = (b?: Placed) => (!b ? '' : b.page.title === b.title ? b.title : `${b.page.title} · ${b.title}`);

/** Works out what each thread is about from the game's Blocks and Drafts. */
export function useThreads(blocks: Placed[], drafts: LiveDraft[], messages: ChatMessage[]) {
  return useMemo(() => {
    const byId = new Map(drafts.map((d) => [d.id, d]));
    const placeOf = (id: string) => blocks.find((b) => b.id === id);
    const byCard = new Map<string, { block: Placed; entry: Entry }>();
    for (const b of blocks) for (const e of b.entries) if (e.ref) byCard.set(e.ref.card, { block: b, entry: e });

    const info = (key: ThreadKey): ThreadInfo => {
      const own = drafts.filter((d) => draftThread(d) === key).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const storedKeys = key.startsWith('draft:') ? [key] : [key, ...own.map((d) => `draft:${d.id}`)];
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      if (kind === 'card' && byCard.has(id)) {
        const { block, entry } = byCard.get(id)!;
        return { key, title: entry.name, where: whereOf(block), kind: 'entry', block, entry, drafts: own, storedKeys };
      }
      if (kind === 'entry') {
        const [b, e] = id.split('.');
        const block = placeOf(b), entry = block?.entries.find((x) => x.id === e);
        if (block && entry) return { key, title: entry.name, where: whereOf(block), kind: 'entry', block, entry, drafts: own, storedKeys };
      }
      if (kind === 'block' && placeOf(id)) {
        const block = placeOf(id)!;
        return { key, title: `Setting up ${block.title}`, where: block.page.title, kind: 'setup', block, drafts: own, storedKeys };
      }
      const d = kind === 'draft' ? byId.get(id) : own.at(-1);
      if (d) return { key, title: d.title, where: whereOf(placeOf(d.blockKey)), kind: 'new', block: placeOf(d.blockKey), drafts: own.length ? own : [d], storedKeys };
      return { key, title: 'A Draft', where: 'No longer in the Workshop', kind: 'unknown', drafts: own, storedKeys };
    };

    // How many messages each thread has, for "Chat · 4" on Drafts and entries.
    const counts = new Map<ThreadKey, number>();
    for (const m of messages) {
      const k = threadOf(m, byId);
      if (k && !m.removed && m.kind !== 'system') counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const inThread = (key: ThreadKey) => messages.filter((m) => threadOf(m, byId) === key);

    // What "#" can point at: every entry, each Characters Block's setup, and new entries
    // still waiting as Drafts.
    const options: RefOption[] = [
      ...blocks.flatMap((b) => b.entries.map((e) => ({ key: entryThread(b.id, e), label: e.name, where: whereOf(b), search: { name: e.name, text: `${b.title} ${b.page.title}` } }))),
      ...blocks.filter((b) => b.type === 'characters').map((b) => ({ key: blockThread(b.id), label: `Setting up ${b.title}`, where: b.page.title, search: { name: `${b.title} setup`, text: b.page.title } })),
      ...drafts.filter((d) => !d.cardId && (d.status === 'open' || d.status === 'checking')).map((d) => {
        const b = placeOf(d.blockKey);
        return { key: draftThread(d), label: d.title, where: `New Draft${b ? ` · ${whereOf(b)}` : ''}`, search: { name: d.title, text: b?.title ?? '' } };
      }),
    ];
    /** The thread of the entry a Village address points at (/g/game/page/eshmel), or null. */
    const entryAt = (pageId: string, item: string): ThreadKey | null => {
      const page = blocks.find((b) => b.page.id === pageId)?.page;
      const found = page ? resolveItem(page, item) : null;
      return found?.entry ? entryThread(found.block.id, found.entry) : null;
    };
    // Everyone who has talked or posted a Draft here, for "@" and for showing mentions.
    const peopleById = new Map<string, { id: string; name: string; username: string }>();
    for (const x of [...messages.filter((m) => m.kind !== 'system').map((m) => m.author), ...drafts.map((d) => d.author)]) {
      if (!peopleById.has(x.id)) peopleById.set(x.id, { id: x.id, name: x.name, username: x.username });
    }
    const people = [...peopleById.values()].sort((a, b) => a.name.localeCompare(b.name));
    const personName = (id: string) => peopleById.get(id)?.name ?? 'someone';
    const byMessage = new Map(messages.map((m) => [m.id, m]));
    return { info, counts, inThread, options, people, personName, byId, byMessage, entryAt, resolve: (k: ThreadKey) => resolveThread(k, byId) };
  }, [blocks, drafts, messages]);
}

/** Something "#" can point at, for the picker. */
export interface RefOption { key: ThreadKey; label: string; where: string; search: Searchable }

/**
 * What the chat needs to turn "#Eshmel" into a link: the game, its threads, and how to open
 * one. Provided once by the Workshop, so every message box and message can use it.
 */
export const ChatLinks = createContext<{ gameId: string; threads: Threads; open: (key: ThreadKey) => void; routes: RouteOption[]; me?: string | null; jump?: (id: number) => void } | null>(null);

/** A message's words, with each "#" reference as a tag in its Page's color that opens the thread. */
export function MessageText({ body }: { body: string }) {
  const links = useContext(ChatLinks);
  return (
    <>
      {splitRefs(body).map((p, i) => {
        if ('text' in p) return <LinkedText key={i} text={p.text} />;
        if ('mention' in p) {
          const you = links?.me === p.mention;
          return (
            <span key={i} className={'rounded-md px-1 font-bold ' + (you ? 'text-ink' : 'text-sky')}
              style={you ? { background: 'color-mix(in srgb, var(--signal) 45%, transparent)' } : undefined}>
              @{links ? links.threads.personName(p.mention) : 'someone'}
            </span>
          );
        }
        if (!links) return <span key={i} className="font-bold">#a thread</span>;
        if (p.ref.game !== links.gameId) return <span key={i} className="font-bold">#a thread in another game</span>;
        // info() never fails: something deleted or hidden since comes back as 'unknown', and
        // reads as plain words, never a link to nothing.
        const here = links.threads.info(links.threads.resolve(p.ref.key));
        if (here.kind === 'unknown') return <span key={i} className="text-muted">#something no longer here</span>;
        const tint = here.block?.page.tint;
        return (
          <button key={i} type="button" onClick={() => links.open(here.key)}
            className="rounded-md px-1 font-bold hover:underline"
            style={tint ? { background: `var(--${tint}-soft)`, color: `var(--${tint})` } : undefined}>
            #{here.title}
          </button>
        );
      })}
    </>
  );
}
export type Threads = ReturnType<typeof useThreads>;

/** Where this copy of Village runs, so links to it are known as Village links. */
const ownHosts = () => [...VILLAGE_HOSTS, ...(typeof window === 'undefined' ? [] : [window.location.host])];

/** The thread a Village address points at in this game, or null. */
function villageThread(url: string, links: { gameId: string; threads: Threads } | null) {
  const v = villagePath(url, ownHosts());
  return v && links && v.game === links.gameId ? links.threads.entryAt(v.page, v.item) : null;
}

/** Plain words with their web addresses as links; a Village entry address reads as its tag. */
function LinkedText({ text }: { text: string }) {
  const links = useContext(ChatLinks);
  return (
    <>
      {findLinks(text).map((p, i) => {
        if ('text' in p) return <span key={i}>{p.text}</span>;
        // A link to one message reads as a short quote of it, and jumps to it.
        const msg = messageLink(p.url, ownHosts());
        if (msg && links && msg.game === links.gameId) {
          const q = links.threads.byMessage.get(msg.id);
          return (
            <button key={i} type="button" onClick={() => links.jump?.(msg.id)}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-ink/5 px-1.5 align-bottom text-sm hover:bg-ink/10">
              <CornerUpLeft size={12} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 truncate">{q && !q.removed ? <><b>{q.author.name}</b>: {q.spoiler ? 'Spoiler' : gist(q, links)}</> : 'a message'}</span>
            </button>
          );
        }
        const key = villageThread(p.url, links);
        const here = key && links ? links.threads.info(key) : null;
        if (here && here.kind !== 'unknown' && links) {
          const tint = here.block?.page.tint;
          return (
            <button key={i} type="button" onClick={() => links.open(here.key)} className="rounded-md px-1 font-bold hover:underline"
              style={tint ? { background: `var(--${tint}-soft)`, color: `var(--${tint})` } : undefined}>
              #{here.title}
            </button>
          );
        }
        return (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer nofollow ugc"
            className="break-all font-bold text-sky underline decoration-sky/40 underline-offset-2 hover:decoration-sky">{p.url.replace(/^https?:\/\//, '')}</a>
        );
      })}
    </>
  );
}

/** A thread's face: the entry's piece, or the Block's symbol (Blocks are never pieces). */
function ThreadIcon({ info, small = false }: { info: ThreadInfo; small?: boolean }) {
  const color = info.block ? `var(--${info.block.page.tint})` : 'var(--muted)';
  const content = info.entry ?? info.drafts.at(-1)?.content;
  if (info.block && content && info.kind !== 'setup') {
    return <span className={'shrink-0 ' + (small ? 'scale-[0.7] -m-1.5' : '')}><EntryIcon entry={content} block={info.block} size="sm" color={color} /></span>;
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card-2" style={{ color }}>
      {info.block ? <BlockIcon name={info.block.icon} size={18} /> : <MessageCircle size={18} aria-hidden="true" />}
    </span>
  );
}

/**
 * Picking a reaction: the quick row (src/lib/reactions.ts), and "More" for the rest, with a
 * search ("heart", "yes").
 */
function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const found = [...new Set(findReactions(query))];
  // It opens under the message, so near the bottom of the chat it could open out of sight:
  // bring it into view when it opens, and again when "More" makes it taller.
  useEffect(() => { box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [more]);
  return (
    <div ref={box} role="group" aria-label="React" className="grid scroll-my-3 gap-1 rounded-2xl bg-card p-1 shadow-soft ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-0.5">
        {QUICK.map((e) => (
          <button key={e} type="button" onClick={() => onPick(e)} aria-label={`React with ${e}`}
            className="grid size-8 place-items-center rounded-full text-lg leading-none hover:bg-card-2">{e}</button>
        ))}
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
          className="h-8 rounded-full px-2.5 text-xs font-bold text-muted hover:bg-card-2 hover:text-ink">{more ? 'Less' : 'More'}</button>
      </div>
      {more && (
        <div className="grid gap-1 border-t border-line pt-1">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: heart, yes, fire" aria-label="Search reactions"
            className="rounded-full bg-card-2 px-3 py-1.5 text-sm outline-none ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-sky" />
          <div className="grid max-h-44 grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-0.5 overflow-y-auto overscroll-contain">
            {found.map((e) => (
              <button key={e} type="button" onClick={() => onPick(e)} aria-label={`React with ${e}`}
                className="grid size-8 place-items-center rounded-full text-lg leading-none hover:bg-card-2">{e}</button>
            ))}
            {found.length === 0 && <p className="col-span-full px-2 py-1 text-xs text-muted">No match. Try another word.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Ana", "Ana and Ben", "Ana, Ben and 3 others", with you as "You". */
function whoReacted(people: Reaction[], me: Villager | null | undefined) {
  const names = people.map((p) => (me && p.by === me.id ? 'You' : p.name));
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} other${names.length === 3 ? '' : 's'}`;
}

/** Reactions under a message, Slack-style: one pill per emoji with how many, yours highlighted. */
function Reactions({ m, me, live, picking, onPicked, centered = false }: {
  m: ChatMessage; me: Villager | null | undefined; live: WorkshopData; picking: boolean; onPicked: () => void;
  /** Under a system line in the main chat, which sits in the middle. */
  centered?: boolean;
}) {
  const [error, setError] = useState('');
  const groups: { emoji: string; people: Reaction[] }[] = [];
  for (const r of live.reactions.get(m.id) ?? []) {
    const g = groups.find((x) => x.emoji === r.emoji);
    if (g) g.people.push(r); else groups.push({ emoji: r.emoji, people: [r] });
  }
  if (!groups.length && !picking && !error) return null;
  const toggle = async (emoji: string) => setError((await live.react(m.id, emoji)) ?? '');
  return (
    <div className={'mt-1 grid gap-1 ' + (centered ? 'justify-items-center' : 'justify-items-start')}>
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {groups.map((g) => {
            const yours = Boolean(me && g.people.some((p) => p.by === me.id));
            return (
              <Tip key={g.emoji} text={`${whoReacted(g.people, me)} reacted with ${g.emoji}${me ? '' : '. Sign in to react'}`}>
                <button type="button" onClick={() => { if (me) toggle(g.emoji); }} aria-pressed={yours} aria-label={`${g.emoji} ${g.people.length}`}
                  className={'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ' + (yours ? 'ring-ink/50' : 'bg-card ring-line hover:ring-ink')}
                  style={yours ? { background: 'color-mix(in srgb, var(--signal) 30%, var(--card))' } : undefined}>
                  <span className="text-sm leading-none">{g.emoji}</span>{g.people.length}
                </button>
              </Tip>
            );
          })}
        </div>
      )}
      {picking && <ReactionPicker onPick={(e) => { toggle(e); onPicked(); }} />}
      {error && <p role="status" className="text-xs text-berry">{error}</p>}
    </div>
  );
}

/** Pictures on a message: one shown large, several in a grid. Tap one to see it full size. */
function Pictures({ list, by }: { list: Attachment[]; by: string }) {
  // A picture deleted with its removed message (and the message restored since) says so.
  const [gone, setGone] = useState<string[]>([]);
  if (!list.length) return null;
  const one = list.length === 1;
  return (
    <div className={'mt-1.5 grid gap-1 ' + (one ? '' : 'grid-cols-2')}>
      {list.map((a) => gone.includes(a.path) ? (
        <p key={a.path} className="rounded-xl bg-card-2 px-3 py-2 text-xs text-muted ring-1 ring-line">Picture removed</p>
      ) : (
        <a key={a.path} href={imageUrl(a.path)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl bg-card-2 ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- a villager's picture from our own storage, any size */}
          <img src={imageUrl(a.path)} alt={`Picture shared by ${by}`} loading="lazy"
            className={one ? 'max-h-72 w-auto max-w-full object-contain' : 'aspect-square size-full object-cover'}
            style={one && a.w && a.h ? { aspectRatio: `${a.w} / ${a.h}` } : undefined}
            onError={() => setGone((g) => [...g, a.path])} />
        </a>
      ))}
    </div>
  );
}

/** The message a reply answers, quoted at the top of the reply. Tap it to see the original. */
function Quote({ id }: { id: number }) {
  const links = useContext(ChatLinks);
  const q = links?.threads.byMessage.get(id);
  const show = () => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.animate?.([{ backgroundColor: 'color-mix(in srgb, var(--signal) 35%, transparent)' }, { backgroundColor: 'transparent' }], { duration: 1400 });
  };
  return (
    <button type="button" onClick={show} disabled={!q}
      className="mb-1 flex w-full min-w-0 items-start gap-1.5 rounded-lg border-l-2 border-ink/40 bg-ink/5 px-2 py-1 text-left text-xs hover:bg-ink/10">
      <CornerUpLeft size={12} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 truncate">{!q ? 'A message no longer here' : q.removed ? 'A removed message' : <><b>{q.author.name}</b> {q.spoiler ? 'Spoiler' : gist(q, links)}</>}</span>
    </button>
  );
}

/** The Village's own mark for system notes: never a person's picture. */
function SystemMark({ size = 22 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-ink text-signal" style={{ width: size, height: size }}>
      <Sparkles size={Math.round(size * 0.55)} aria-hidden="true" />
    </span>
  );
}

export function Message({ m, me, live, compact = false, small = false, onReply }: {
  m: ChatMessage; me: Villager | null | undefined; live: WorkshopData; compact?: boolean;
  /** Inside a thread: a little smaller than the main chat, as a part of it. */
  small?: boolean;
  /** Answer this message: the box quotes it until you send. */
  onReply?: (m: ChatMessage) => void;
}) {
  const [shown, setShown] = useState(false);
  const [tools, setTools] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const { run, busy, error } = useAction();
  const own = me?.id === m.author.id && !me.practice;
  const reported = live.myReports.has(targetKey({ messageId: m.id }));
  const canReport = Boolean(me) && !own;
  // Everyone can copy a link to a message; reporting and moderating add to the same menu.
  const hasTools = true;
  const [copied, setCopied] = useState(false);
  const links = useContext(ChatLinks);
  const copyLink = async () => {
    if (!links) return;
    try { await navigator.clipboard.writeText(location.origin + messagePath(links.gameId, m.id)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const system = m.kind === 'system';

  // A small preview inside a thread's card: a line or two, no bubble.
  if (compact) {
    return (
      <li className={'flex gap-2 ' + (m.removed ? 'opacity-50' : '')}>
        {system ? <SystemMark /> : <Avatar name={m.author.name} url={m.author.avatarUrl} size={22} />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-bold">{system ? 'Village' : own ? 'You' : m.author.name}</span>
            <time dateTime={m.createdAt} title={fullTime(m.createdAt)} className="text-xs text-muted">{clock(m.createdAt)}</time>
          </p>
          {m.spoiler ? <p className="text-muted">Spoiler · open the thread to read it</p>
            : <p className={'line-clamp-2 break-words ' + (system ? 'text-muted' : '')}><MessageText body={m.body} /></p>}
        </div>
      </li>
    );
  }

  // In full: a soft bubble, yours on the right, everyone else's on the left with their picture.
  // Reacting and the options sit beside it: on hover with a mouse, always on a touch screen.
  return (
    <li id={`msg-${m.id}`} className={'group flex scroll-my-6 items-start gap-2 ' + (own ? 'flex-row-reverse ' : '') + (m.removed ? 'opacity-50' : '')}>
      {!own && <Avatar name={m.author.name} url={m.author.avatarUrl} size={small ? 26 : 32} />}
      <div className={'flex min-w-0 max-w-[88%] flex-col ' + (own ? 'items-end' : 'items-start')}>
        {/* A message that mentions you has a yellow ring, so it stands out as yours to answer. */}
        <div tabIndex={-1} className={'min-w-0 max-w-full rounded-2xl px-3 py-2 outline-none transition-shadow ' + (own ? 'rounded-tr-md' : 'rounded-tl-md bg-card '
          + (me && mentionsIn(m.body).includes(me.id) ? 'ring-2 ring-signal' : 'ring-1 ring-line'))}
          style={own ? { background: 'color-mix(in srgb, var(--signal) 26%, var(--card))' } : undefined}>
          {m.replyTo && <Quote id={m.replyTo} />}
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold">{own ? 'You' : m.author.name}</span>
            <time dateTime={m.createdAt} title={fullTime(m.createdAt)} className="text-xs text-muted">{clock(m.createdAt)}</time>
            {m.removed && <span className="rounded-full bg-berry-soft px-2 py-0.5 text-xs font-bold text-berry">Removed · only moderators see it</span>}
          </p>
          {m.spoiler && !shown ? (
            <button onClick={() => setShown(true)} className="mt-0.5 inline-flex items-center gap-1.5 rounded-xl bg-ink/80 px-3 py-1 text-sm font-bold text-paper">
              <EyeOff size={14} aria-hidden="true" /> Spoiler · tap to show
            </button>
          ) : (
            <>
              {m.body && <p className={'whitespace-pre-wrap break-words ' + (small ? 'text-sm' : '')}><MessageText body={m.body} /></p>}
              <Pictures list={m.attachments} by={m.author.name} />
              <LinkedCard body={m.body} me={me} live={live} />
            </>
          )}
        </div>
        <Reactions m={m} me={me} live={live} picking={picking} onPicked={() => setPicking(false)} />
        {tools && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <SmallButton onClick={copyLink} icon={copied ? <Check size={13} aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}>{copied ? 'Link copied' : 'Copy link'}</SmallButton>
            {canReport && (reported
              ? <span className="px-1 text-xs font-bold text-muted">You reported this</span>
              : <SmallButton onClick={() => setReporting(!reporting)} icon={<Flag size={13} aria-hidden="true" />}>Report</SmallButton>)}
            {live.mod && (
              <>
                <SmallButton disabled={busy} onClick={() => run(() => live.moderate.markSpoiler(m.id, !m.spoiler))} icon={<EyeOff size={13} aria-hidden="true" />}>
                  {m.spoiler ? 'Unmark spoiler' : 'Mark as spoiler'}
                </SmallButton>
                <Tip text={m.removed ? 'Bring the words back (pictures were deleted for good)'
                  : m.attachments.length ? 'Hide it from everyone. Its pictures are deleted for good' : 'Hide it from everyone'} tint="berry">
                  <SmallButton tone={m.removed ? 'plain' : 'bad'} disabled={busy} onClick={() => run(() => live.moderate.removeMessage(m.id, !m.removed))}
                    icon={m.removed ? <RotateCcw size={13} aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}>
                    {m.removed ? 'Restore' : 'Remove'}
                  </SmallButton>
                </Tip>
              </>
            )}
          </div>
        )}
        {error && <p role="status" className="mt-1 text-sm text-berry">{error}</p>}
        {reporting && !reported && <ReportForm target={{ messageId: m.id }} live={live} onDone={() => { setReporting(false); setTools(false); }} />}
      </div>
      {(me || hasTools) && (
        // With a mouse they appear on hover; on touch screens (no hover) they always show.
        <div className={'flex shrink-0 flex-col gap-0.5 self-center ' + (picking || tools ? ''
          : '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100')}>
          {me && (
            <Tip text="React">
              <button type="button" onClick={() => setPicking(!picking)} aria-expanded={picking} aria-label="Add a reaction"
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
                <SmilePlus size={16} aria-hidden="true" />
              </button>
            </Tip>
          )}
          {me && onReply && !m.removed && (
            <Tip text="Reply">
              <button type="button" onClick={() => onReply(m)} aria-label="Reply"
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
                <CornerUpLeft size={16} aria-hidden="true" />
              </button>
            </Tip>
          )}
          {hasTools && (
            <button type="button" onClick={() => { setTools(!tools); setReporting(false); }} aria-expanded={tools} aria-label="Message options"
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Something published, as one line in the game's chat: the detail is in its thread. */
function SystemLine({ m, me, live }: { m: ChatMessage; me: Villager | null | undefined; live: WorkshopData }) {
  const links = useContext(ChatLinks);
  const [picking, setPicking] = useState(false);
  const key = links && m.threadKey ? links.threads.resolve(m.threadKey) : null;
  const info = key && links ? links.threads.info(key) : null;
  const title = info && info.kind !== 'unknown' ? info.title : null;
  return (
    <li className="grid justify-items-center">
      <div className="flex max-w-full items-center gap-1">
        <button type="button" onClick={() => { if (key) links?.open(key); }} disabled={!title}
          className="inline-flex min-w-0 items-center gap-2 rounded-full bg-ink py-1 pl-1 pr-3 text-xs text-paper hover:ring-2 hover:ring-signal">
          <SystemMark />
          <span className="min-w-0 truncate">
            {title ? <><b>{title}</b> {m.event?.isNew ? 'is new in the app' : 'was updated in the app'}</> : m.body}
          </span>
          <time dateTime={m.createdAt} title={fullTime(m.createdAt)} className="shrink-0 opacity-60">{clock(m.createdAt)}</time>
        </button>
        {me && (
          <Tip text="React" className="shrink-0">
            <button type="button" onClick={() => setPicking(!picking)} aria-expanded={picking} aria-label="Add a reaction"
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
              <SmilePlus size={16} aria-hidden="true" />
            </button>
          </Tip>
        )}
      </div>
      <Reactions m={m} me={me} live={live} picking={picking} onPicked={() => setPicking(false)} centered />
    </li>
  );
}

/**
 * A system note in a thread, in detail: what happened, who wrote it and who approved it, and
 * for something published, what changed. Marked as the Village's, never a person's.
 */
function SystemNote({ m, info, me, live }: { m: ChatMessage; info: ThreadInfo; me: Villager | null | undefined; live: WorkshopData }) {
  const links = useContext(ChatLinks);
  const ev = m.event;
  const [picking, setPicking] = useState(false);
  const draft = ev ? links?.threads.byId.get(ev.draft) : undefined;
  // What the entry was before, from the revision the Draft started from (none for a new entry).
  const [before, setBefore] = useState<EntryContent | null | undefined>(ev?.before ? undefined : null);
  useEffect(() => {
    if (!ev?.before) return;
    let gone = false;
    browserClient()?.from('card_revisions').select('content').eq('id', ev.before).maybeSingle()
      .then(({ data }) => { if (!gone) setBefore((data?.content as EntryContent | undefined) ?? null); });
    return () => { gone = true; };
  }, [ev?.before]);
  const published = ev?.type === 'published';
  const changes = published && draft && info.block && before !== undefined && links
    ? changesBetween(before ?? undefined, draft.content, info.block, links.routes) : [];
  const writer = draft?.author.name;
  return (
    <li className="overflow-hidden rounded-2xl bg-card ring-1 ring-ink/70">
      <div className="flex items-center gap-2 bg-ink py-1 pl-1 pr-3 text-xs font-bold text-paper">
        <SystemMark />
        <span>{published ? (ev?.isNew ? 'New in the app' : 'Updated in the app') : 'Declined'}</span>
        <time dateTime={m.createdAt} title={fullTime(m.createdAt)} className="ml-auto font-normal opacity-70">{clock(m.createdAt)}</time>
      </div>
      <div className="px-3 py-2 text-sm">
        {published ? (
          <p>
            {writer ? <><b>{writer}</b>&apos;s {ev?.isNew ? 'new entry' : 'fix'}</> : 'A Draft'} was approved by <b>{m.author.name}</b> and is now in the app.
          </p>
        ) : (
          <p><b>{m.author.name}</b> declined {writer ? <><b>{writer}</b>&apos;s Draft</> : 'a Draft'}{ev?.reason ? <>: “{ev.reason}”</> : '.'}</p>
        )}
        {changes.length > 0 && <ChangeList changes={changes} />}
        <div className="mt-1 flex items-start gap-1">
          <div className="min-w-0 flex-1"><Reactions m={m} me={me} live={live} picking={picking} onPicked={() => setPicking(false)} /></div>
          {me && (
            <button type="button" onClick={() => setPicking(!picking)} aria-expanded={picking} aria-label="Add a reaction"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
              <SmilePlus size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/** A YouTube video under a message: its picture, a play mark, and where it starts. */
function VideoCard({ url, id, start }: { url: string; id: string; start?: number }) {
  const at = start ? `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}` : null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow ugc"
      className="mt-2 block w-full max-w-72 overflow-hidden rounded-2xl bg-card text-left ring-1 ring-line hover:ring-ink">
      <span className="relative block aspect-video bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail from YouTube's own servers */}
        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-11 place-items-center rounded-full bg-ink/80 text-paper"><Play size={20} className="ml-0.5" aria-hidden="true" /></span>
        </span>
      </span>
      <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold">
        YouTube{at && <span className="font-normal text-muted">· starts at {at}</span>}
        <ExternalLink size={12} className="ml-auto text-muted" aria-hidden="true" />
      </span>
    </a>
  );
}

/** The first thread a message points at, as a card under it: its latest words and a reply box. */
function LinkedCard({ body, me, live }: { body: string; me: Villager | null | undefined; live: WorkshopData }) {
  const links = useContext(ChatLinks);
  // A "#" pick or a pasted Village entry address gets the entry's card; failing that, a
  // YouTube link gets a picture of the video.
  const urls = splitRefs(body).flatMap((p) => ('text' in p ? linksIn(p.text) : []));
  const first = links && refs(body).find((r) => r.game === links.gameId);
  const pasted = urls.map((u) => villageThread(u, links)).find(Boolean);
  if (!links || (!first && !pasted)) {
    const video = urls.map((u) => ({ u, v: youTube(u) })).find((x) => x.v);
    return video ? <VideoCard url={video.u} id={video.v!.id} start={video.v!.start} /> : null;
  }
  const key = links.threads.resolve(first ? first.key : pasted!);
  const info = links.threads.info(key);
  if (info.kind === 'unknown') return null;
  return (
    <div className="mt-2 text-left">
      <ThreadCard as="div" info={info} messages={links.threads.inThread(key)} me={me} live={live} onOpen={() => links.open(key)} />
    </div>
  );
}

/** What a message carries besides its words. */
export interface Extra { attachments: Attachment[]; replyTo: number | null }

/** The first words of a message, for a quote or a "Replying to" line. */
const gist = (m: ChatMessage, links: { threads: Threads } | null) => {
  const words = plainRefs(m.body, (r) => (links ? links.threads.info(links.threads.resolve(r.key)).title : 'a thread'), (id) => links?.threads.personName(id) ?? 'someone').trim();
  return words || (m.attachments.length ? (m.attachments.length > 1 ? `${m.attachments.length} pictures` : 'A picture') : '');
};

/**
 * The message box: a text field that grows to several lines, a picture button, a spoiler
 * switch and Send. Visitors get a sign-in button. Typing "#" lists things to point at (#esh
 * finds Eshmel) and "@" lists people (@an finds Ana); picking writes #Eshmel or @Ana, and
 * sending turns them into links. Pictures can also be pasted in.
 */
export function Composer({ me, placeholder, onSend, id, compact = false, onShade = false, replyTo = null, onCancelReply }: {
  me: Villager | null | undefined; placeholder: string; onSend: (body: string, spoiler: boolean, extra: Extra) => Promise<string | null>;
  /** The stream's box has an id, so "Say hi" can put the cursor in it. */
  id?: string;
  /** Inside a thread's card: smaller, no pictures, and no sign-in button (the stream's box has one). */
  compact?: boolean;
  /** On a thread's darker frame: a white box, so it still stands out. */
  onShade?: boolean;
  /** The message being answered, quoted above the box until it's sent or cancelled. */
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const links = useContext(ChatLinks);
  const [caret, setCaret] = useState(0);
  const [picked, setPicked] = useState<{ label: string; mark: '#' | '@'; token: string }[]>([]);
  const [sel, setSel] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [pictures, setPictures] = useState<{ file: File; preview: string }[]>([]);

  const listId = useId();
  const typed = links ? typedMark(text, caret) : null;
  const choices: { key: string; label: string; where: string }[] = !typed || !links ? []
    : typed.mark === '#'
      ? rank(links.threads.options, typed.query, (o) => o.search).slice(0, typed.query ? 8 : 40)
      : rank(links.threads.people.filter((p) => p.id !== me?.id), typed.query, (p) => ({ name: p.name, text: p.username }))
        .slice(0, 8).map((p) => ({ key: p.id, label: p.name, where: `@${p.username}` }));
  const picking = Boolean(typed && !hidden && choices.length);
  // The box grows with what's written, up to about six lines, then scrolls.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);
  // Choosing Reply puts the cursor in the box.
  useEffect(() => { if (replyTo) field.current?.focus(); }, [replyTo]);

  if (me === null) return compact ? null : <div className="mt-auto pt-2"><SignInPrompt>Sign in to chat</SignInPrompt></div>;

  const pick = (o: { key: string; label: string }) => {
    if (!typed || !links) return;
    const next = insertPick(text, typed.start, caret, o.label, typed.mark);
    setText(next.text);
    setCaret(next.caret);
    const token = typed.mark === '#' ? refToken({ game: links.gameId, key: o.key }) : mentionToken(o.key);
    setPicked((p) => [...p.filter((x) => !(x.label === o.label && x.mark === typed.mark)), { label: o.label, mark: typed.mark, token }]);
    setSel(0);
    requestAnimationFrame(() => { field.current?.focus(); field.current?.setSelectionRange(next.caret, next.caret); });
  };

  const addPictures = (list: FileList | File[]) => {
    const images = [...list].filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setError(pictures.length + images.length > 4 ? 'Four pictures at most on one message.' : '');
    setPictures((p) => [...p, ...images.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 4));
  };
  const dropPicture = (i: number) => setPictures((p) => {
    URL.revokeObjectURL(p[i].preview);
    return p.filter((_, j) => j !== i);
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = encodeRefs(text.trim(), picked);
    if ((!body && !pictures.length) || busy || !me || !links) return;
    setBusy(true);
    const attachments: Attachment[] = [];
    for (const p of pictures) {
      const up = await uploadChatImage(links.gameId, me.id, p.file);
      if (typeof up === 'string') { setBusy(false); setError(up); return; }
      attachments.push(up);
    }
    const err = await onSend(body, spoiler, { attachments, replyTo: replyTo?.id ?? null });
    setBusy(false);
    setError(err ?? '');
    if (!err) {
      setText(''); setSpoiler(false); setPicked([]); setCaret(0);
      pictures.forEach((p) => URL.revokeObjectURL(p.preview));
      setPictures([]);
      onCancelReply?.();
    }
  };
  const size = compact ? 'size-7' : 'size-9';
  const track = (el: HTMLTextAreaElement) => setCaret(el.selectionStart ?? el.value.length);
  // Enter sends and Shift+Enter starts a new line. On a phone (no hover, an on-screen keyboard)
  // Enter starts a new line, and the Send button sends.
  const enterSends = () => typeof window !== 'undefined' && !window.matchMedia('(hover: none)').matches;
  const canSend = Boolean(text.trim() || pictures.length);

  return (
    <div className={'relative ' + (compact ? '' : 'mt-auto')}>
      {picking && typed && (
        <ul id={listId} role="listbox" aria-label={typed.mark === '#' ? 'Point at something' : 'Mention someone'} className="absolute inset-x-0 bottom-full z-30 mb-2 max-h-64 overflow-y-auto overscroll-contain rounded-2xl bg-card p-1 shadow-soft ring-1 ring-line">
          {choices.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === sel}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseEnter={() => setSel(i)}
                className={'flex w-full items-baseline gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm ' + (i === sel ? 'bg-card-2 ring-1 ring-ink' : '')}>
                <span className="shrink-0 font-bold">{typed.mark}{o.label}</span>
                <span className="min-w-0 truncate text-xs text-muted">{o.where}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {replyTo && (
        <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-card-2 px-3 py-1.5 text-xs ring-1 ring-line">
          <CornerUpLeft size={13} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Replying to <b>{replyTo.author.id === me?.id ? 'yourself' : replyTo.author.name}</b>: {gist(replyTo, links)}</span>
          <button type="button" onClick={onCancelReply} aria-label="Don't reply" className="grid size-5 shrink-0 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}
      {pictures.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {pictures.map((p, i) => (
            <div key={p.preview} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a picture from your own device, before it's sent */}
              <img src={p.preview} alt="" className={'size-14 rounded-xl object-cover ring-1 ring-line ' + (spoiler ? 'blur-sm' : '')} />
              <button type="button" onClick={() => dropPicture(i)} aria-label="Remove this picture"
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-paper ring-2 ring-card">
                <X size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* The whole box takes a click: the text field fills its height, and a click on its edge lands in the field. */}
      <form onSubmit={submit} onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); field.current?.focus(); } }}
        className={'flex cursor-text items-end gap-1.5 rounded-[1.25rem] ring-1 ring-line focus-within:ring-2 focus-within:ring-sky ' + (compact ? 'bg-card p-1' : onShade ? 'bg-card p-1.5' : 'bg-card-2 p-1.5')}>
        <textarea ref={field} id={id} value={text} maxLength={4000} disabled={me === undefined} rows={1}
          onChange={(e) => { setText(e.target.value); track(e.target); setHidden(false); setSel(0); if (error) setError(''); }}
          onSelect={(e) => track(e.currentTarget)}
          onPaste={(e) => { if (!compact && e.clipboardData.files.length) { e.preventDefault(); addPictures(e.clipboardData.files); } }}
          onBlur={() => setHidden(true)}
          onFocus={() => {
            setHidden(false);
            // Phones: once the keyboard is up, make sure the box is above it.
            setTimeout(() => field.current?.scrollIntoView({ block: 'nearest' }), 350);
          }}
          onKeyDown={(e) => {
            if (!picking) {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && enterSends()) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
              return;
            }
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % choices.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + choices.length) % choices.length); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(choices[Math.min(sel, choices.length - 1)]); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setHidden(true); }
          }}
          role="combobox" aria-expanded={picking} aria-controls={listId} aria-autocomplete="list"
          className={'max-h-40 min-w-0 flex-1 resize-none self-center overflow-y-auto bg-transparent outline-none placeholder:text-muted ' + (compact ? 'px-2.5 py-1 text-sm leading-5' : 'px-3 py-1.5 leading-6')} placeholder={placeholder} aria-label={placeholder} />
        {!compact && (
          <>
            <input ref={files} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden"
              onChange={(e) => { if (e.target.files) addPictures(e.target.files); e.target.value = ''; }} />
            <Tip text="Add a picture (or paste one)" className="shrink-0">
              <button type="button" onClick={() => files.current?.click()} disabled={pictures.length >= 4}
                className={'grid place-items-center rounded-full text-muted hover:text-ink disabled:opacity-40 ' + size}>
                <ImagePlus size={16} aria-hidden="true" /><span className="sr-only">Add a picture</span>
              </button>
            </Tip>
          </>
        )}
        <Tip text="Spoiler: hide this message behind a tap" className="shrink-0">
          <button type="button" onClick={() => setSpoiler(!spoiler)} aria-pressed={spoiler}
            className={'grid place-items-center rounded-full ' + size + ' ' + (spoiler ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
            <EyeOff size={compact ? 14 : 16} aria-hidden="true" /><span className="sr-only">Spoiler</span>
          </button>
        </Tip>
        <button disabled={busy || !canSend} className={'btn-primary grid place-items-center rounded-full disabled:opacity-50 ' + size} aria-label={busy ? 'Sending' : 'Send'}>
          <Send size={compact ? 14 : 16} aria-hidden="true" />
        </button>
      </form>
      {spoiler && <p className="mt-1 px-3 text-xs text-muted">Hidden behind a tap until someone chooses to read it.</p>}
      {busy && pictures.length > 0 && <p role="status" className="mt-1 px-3 text-xs text-muted">Sending your picture{pictures.length > 1 ? 's' : ''}…</p>}
      {error && <p role="status" className="mt-1 px-3 text-sm text-berry">{error}</p>}
    </div>
  );
}

/** Sends a message into a thread, stored under its key and tagged with its Page. */
export function sendToThread(live: WorkshopData, info: ThreadInfo) {
  return (body: string, spoiler: boolean, extra?: Extra) => live.send(body, {
    blockKey: info.block?.page.id ?? null, threadKey: info.key,
    draftId: info.kind === 'new' ? info.drafts.at(-1)?.id ?? null : null, spoiler, ...extra,
  });
}

/** A thread in the stream: what it's about, its latest words, and a box to reply right there. */
function ThreadCard({ info, messages, me, live, onOpen, as: Box = 'li' }: {
  info: ThreadInfo; messages: ChatMessage[]; me: Villager | null | undefined; live: WorkshopData; onOpen: () => void;
  /** A list item in the stream; a plain box under a message that points at it. */
  as?: 'li' | 'div';
}) {
  const count = messages.filter((m) => !m.removed && m.kind !== 'system').length;
  return (
    <Box className="rounded-2xl bg-card p-2.5 ring-1 ring-line">
      <button onClick={onOpen} className="flex w-full items-center gap-2.5 text-left">
        <ThreadIcon info={info} small />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold leading-tight">{info.title}</span>
          <span className="block truncate text-xs text-muted">
            {info.where}{info.where ? ' · ' : ''}{count} message{count === 1 ? '' : 's'}{info.drafts.length ? ` · ${info.drafts.length} Draft${info.drafts.length === 1 ? '' : 's'}` : ''}
          </span>
        </span>
        <Tip text="Open this thread beside the chat" className="shrink-0">
          <span className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><PanelRight size={16} aria-hidden="true" /><span className="sr-only">Open</span></span>
        </Tip>
      </button>
      {messages.length > 0 && (
        <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 border-t border-line pt-2">
          {messages.slice(-2).map((m) => <Message key={m.id} m={m} me={me} live={live} compact />)}
        </ul>
      )}
      <div className="mt-2">
        <Composer compact me={me} placeholder={`Reply about ${info.title}`} onSend={sendToThread(live, info)} />
      </div>
    </Box>
  );
}

/** Keeps the newest message in view, unless you've scrolled up to read. */
function useStickToBottom(lastId: number | undefined, me: Villager | null | undefined, lastAuthor?: string) {
  const el = useRef<HTMLUListElement | null>(null);
  const stick = useRef(true);
  const watcher = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    if (el.current && (stick.current || (me && lastAuthor === me.id))) el.current.scrollTop = el.current.scrollHeight;
  }, [lastId, me, lastAuthor]);
  // The list only appears once the chat has loaded, so it's set up as it appears: it opens at
  // the newest message, and when it gets shorter (a phone keyboard opening, the window
  // resizing) the newest message stays in view if that's where you were.
  const list = useCallback((node: HTMLUListElement | null) => {
    el.current = node;
    watcher.current?.disconnect();
    watcher.current = null;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    if (typeof ResizeObserver === 'undefined') return;
    watcher.current = new ResizeObserver(() => { if (stick.current) node.scrollTop = node.scrollHeight; });
    watcher.current.observe(node);
  }, []);
  const onScroll = () => {
    const node = el.current;
    if (node) stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
  };
  return { list, onScroll };
}

/** The game's one chat: messages to everyone, and a card for each thread that's talking. */
export function Stream({ topic, onAll, onFold, switcher, bar, className = '', messages, me, live, threads, onOpen }: {
  /** A Page chosen in the chips: the stream narrows to it. */
  topic: { key: string; label: string } | null; onAll: () => void;
  /** Wide screens: fold the chat to a thin strip. */
  onFold?: () => void;
  /** Phones: the Build / Chat switch, at the top right. */
  switcher?: React.ReactNode;
  /** Before the heading, like the edit and chat switch over an editor. */
  bar?: React.ReactNode;
  className?: string;
  messages: ChatMessage[];
  me: Villager | null | undefined; live: WorkshopData; threads: Threads;
  onOpen: (key: ThreadKey) => void;
}) {
  const items = useMemo(() => buildStream(messages, threads.byId), [messages, threads.byId]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const last = messages.at(-1);
  const { list, onScroll } = useStickToBottom(last?.id, me, last?.author.id);

  return (
    <section aria-label="Chat" className={'relative flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-2xl bg-card p-4 ring-1 ring-line in-data-[phone-chat]:min-h-0 lg:min-h-0 ' + className}>
      <div className="flex flex-wrap items-center gap-x-2">
        {bar && <span className="mr-1 shrink-0">{bar}</span>}
        <h2 className="font-display text-xl">Chat</h2>
        {switcher && <span className="ml-auto lg:hidden">{switcher}</span>}
        {topic && (
          <span className="order-last basis-full text-sm text-muted">
            {topic.label} only · <button onClick={onAll} className="font-bold text-leaf underline underline-offset-2">show all</button>
          </span>
        )}
        {onFold && <span className="ml-auto hidden shrink-0 lg:block">
          <Tip text="Fold the chat away, for more room">
            <button onClick={onFold} aria-label="Fold the chat away" className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
              <PanelLeftClose size={17} aria-hidden="true" />
            </button>
          </Tip>
        </span>}
      </div>
      {live.state === 'loading' ? (
        <div className="m-auto py-10 text-sm text-muted">Opening the workshop doors…</div>
      ) : messages.length === 0 ? (
        <div className="-mx-4 my-3 grid flex-1 place-items-center px-3" style={WALL}><div className="grid max-w-sm justify-items-center gap-2 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-sky-soft text-sky"><MessageCircle aria-hidden="true" /></span>
          <h3 className="font-display text-xl">{topic ? `Nothing about ${topic.label} yet` : 'The village is quiet'}</h3>
          <p className="text-sm text-muted">Say what you&apos;ve found or what you&apos;re stuck on. Messages show up for everyone here right away.</p>
        </div></div>
      ) : (
        <ul ref={list} onScroll={onScroll} aria-live="polite" className={WALL_LIST} style={WALL}>
          {items.map((x) => x.kind === 'message' ? <Message key={x.m.id} m={x.m} me={me} live={live} onReply={setReplyTo} />
            : x.kind === 'system' ? <SystemLine key={x.m.id} m={x.m} me={me} live={live} />
            : <ThreadCard key={x.key} info={threads.info(x.key)} messages={x.messages} me={me} live={live} onOpen={() => onOpen(x.key)} />)}
          {messages.length < 4 && (
            <li className="mt-2 rounded-2xl bg-card-2 px-3 py-2.5 text-sm text-muted">
              It&apos;s quiet in here. Ask where something is, share something you found, or just say hi. Everyone here sees it right away.
            </li>
          )}
        </ul>
      )}
      <Composer id="chat-input" me={me} placeholder={topic ? `Message about ${topic.label}` : 'Message everyone'}
        replyTo={replyTo} onCancelReply={() => setReplyTo(null)}
        onSend={(body, spoiler, extra) => live.send(body, { blockKey: topic?.key ?? null, spoiler, ...extra })} />
    </section>
  );
}

const DRAFT_STATUS: Record<string, string> = {
  checking: 'being checked', open: 'open for votes', approved: 'approved', preview: 'in Preview', stable: 'published', declined: 'declined', removed: 'removed',
};

/**
 * One thread on its own: everything said about the thing, with its Drafts in the timeline so
 * feedback and votes sit beside the talk that led to them.
 */
export function ThreadPanel({ info, messages, me, live, gameId, onBack, switcher, onDraft, onEdit, bar, className = '' }: {
  info: ThreadInfo; messages: ChatMessage[]; me: Villager | null | undefined; live: WorkshopData; gameId: string;
  /** Phones: the Build / Chat switch, at the top right. */
  switcher?: React.ReactNode;
  /** Back to the stream, where the two don't fit side by side. */
  onBack?: () => void;
  /** Opens a Draft's card, to read it and vote. */
  onDraft: (draftId: string) => void;
  /** Opens the entry's editor (not shown while it's already open). */
  onEdit?: () => void;
  bar?: React.ReactNode;
  className?: string;
}) {
  const { loadThread } = live;
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const keys = info.storedKeys.join('|');
  const draftIds = info.drafts.map((d) => d.id).join(',');
  // The whole history, past the newest messages the Workshop loads.
  useEffect(() => { loadThread(keys.split('|'), draftIds ? draftIds.split(',') : []).catch(() => {}); }, [loadThread, keys, draftIds]);

  const timeline = useMemo(() => [
    ...messages.map((m) => ({ at: m.createdAt, m })),
    ...info.drafts.map((d) => ({ at: d.createdAt, d })),
  ].sort((a, b) => a.at.localeCompare(b.at)), [messages, info.drafts]);
  const last = messages.at(-1);
  const { list, onScroll } = useStickToBottom(last?.id, me, last?.author.id);
  const people = new Set(messages.map((m) => m.author.id)).size;
  const href = info.block && info.entry ? sharePath(gameId, info.block.page, info.block, info.entry) : null;

  return (
    // Escape goes back to the main chat, unless you're partway through writing a message.
    <section aria-label={`Thread: ${info.title}`} style={{ background: THREAD_FRAME }}
      className={'relative flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-2xl p-4 ring-1 ring-line in-data-[phone-chat]:min-h-0 lg:min-h-0 ' + className}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !onBack || e.defaultPrevented) return;
        if (e.target instanceof HTMLInputElement && e.target.value.trim()) return;
        e.stopPropagation();
        onBack();
      }}>
      {/* Phones: "← Chat ›" and the switch on the first line, the thread's name on the next. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {bar && <span className="shrink-0">{bar}</span>}
        {/* A thread is a part of the main chat, so its heading says so: Chat › Eshmel. */}
        {onBack && (
          <Tip text="Back to the whole chat" className="shrink-0">
            <button onClick={onBack} aria-label="Back to the whole chat"
              className="inline-flex h-8 items-center gap-0.5 rounded-full pl-1 pr-2 text-sm font-bold text-muted hover:bg-card-2 hover:text-ink">
              <ArrowLeft size={16} aria-hidden="true" /> Chat
            </button>
          </Tip>
        )}
        {onBack && <span aria-hidden="true" className="-mx-1 shrink-0 text-muted">›</span>}
        <div className="flex min-w-0 flex-1 items-center gap-2 max-lg:order-last max-lg:basis-full">
          <ThreadIcon info={info} small />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg leading-tight" title={info.title}>{info.title}</h2>
            <p className="truncate text-xs text-muted">{info.where}{people ? ` · ${people} ${people === 1 ? 'person' : 'people'} talking` : ''}</p>
          </div>
        </div>
        {switcher && <span className="ml-auto shrink-0 lg:hidden">{switcher}</span>}
      </div>
      {(onEdit || href) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {onEdit && <SmallButton onClick={onEdit} icon={<PenLine size={13} aria-hidden="true" />}>{info.kind === 'setup' ? 'Set up' : 'Fix'}</SmallButton>}
          {href && <a href={href} className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">See it in the app</a>}
        </div>
      )}
      <ul ref={list} onScroll={onScroll} aria-live="polite" className={WALL_LIST}
        style={{ ...THREAD_WALL, boxShadow: `inset 4px 0 0 ${info.block ? 'var(--' + info.block.page.tint + ')' : 'var(--ink)'}` }}>
        {timeline.length === 0 && (
          <li className="m-auto grid max-w-xs justify-items-center gap-2 py-8 text-center">
            <h3 className="font-display text-lg">Start the thread</h3>
            <p className="text-sm text-muted">Ask what you&apos;re unsure of, or say what you&apos;re working on, so nobody does it twice. It shows in the main chat too.</p>
          </li>
        )}
        {timeline.map((x) => 'm' in x ? (x.m.kind === 'system'
          ? <SystemNote key={`m${x.m.id}`} m={x.m} info={info} me={me} live={live} />
          : <Message key={`m${x.m.id}`} m={x.m} me={me} live={live} small onReply={setReplyTo} />) : (
          <li key={`d${x.d.id}`} className="flex items-center gap-2.5 rounded-2xl bg-card-2 px-3 py-2 text-sm ring-1 ring-line">
            <FileText size={16} className="shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="font-bold">{x.d.author.name}</span> posted {x.d.cardId ? 'a fix' : 'a new entry'}
              <span className="text-muted"> · {ago(x.d.createdAt)} · {DRAFT_STATUS[x.d.status] ?? x.d.status}</span>
            </span>
            <button onClick={() => onDraft(x.d.id)} className="shrink-0 rounded-full bg-card px-2.5 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
              {me && x.d.author.id !== me.id && !x.d.myVote && (x.d.status === 'open' || x.d.status === 'checking') ? 'Vote' : 'See Draft'}
            </button>
          </li>
        ))}
      </ul>
      <Composer onShade me={me} placeholder={`Message about ${info.title}`} onSend={sendToThread(live, info)}
        replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
    </section>
  );
}
