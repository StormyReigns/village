'use client';

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, EyeOff, FileText, Flag, MessageCircle, MoreHorizontal, PanelLeftClose, PanelRight, PenLine, RotateCcw, Send, Trash2, X } from 'lucide-react';
import type { Block, Entry, Page } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { EntryIcon } from '@/components/app/EntryPanel';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Avatar } from '@/components/Avatar';
import { Tip } from '@/components/Tip';
import type { Villager } from '@/components/useVillager';
import { sharePath } from '@/data/pages/links';
import { blockThread, buildStream, draftThread, entryThread, resolveThread, threadOf, type ThreadKey } from '@/lib/threads';
import { encodeRefs, insertPick, refsIn, splitRefs, typedHash, type Ref } from '@/lib/refs';
import { rank, type Searchable } from '@/lib/search';
import { targetKey, type ChatMessage, type LiveDraft, type WorkshopData } from '../useWorkshop';
import { ago, ReportForm, SmallButton, useAction } from './bits';

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
      if (k && !m.removed) counts.set(k, (counts.get(k) ?? 0) + 1);
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
    return { info, counts, inThread, options, byId, resolve: (k: ThreadKey) => resolveThread(k, byId) };
  }, [blocks, drafts, messages]);
}

/** Something "#" can point at, for the picker. */
export interface RefOption { key: ThreadKey; label: string; where: string; search: Searchable }

/**
 * What the chat needs to turn "#Eshmel" into a link: the game, its threads, and how to open
 * one. Provided once by the Workshop, so every message box and message can use it.
 */
export const ChatLinks = createContext<{ gameId: string; threads: Threads; open: (key: ThreadKey) => void } | null>(null);

/** A message's words, with each "#" reference as a tag in its Page's color that opens the thread. */
export function MessageText({ body }: { body: string }) {
  const links = useContext(ChatLinks);
  return (
    <>
      {splitRefs(body).map((p, i) => {
        if ('text' in p) return <span key={i}>{p.text}</span>;
        const here = links && p.ref.game === links.gameId ? links.threads.info(links.threads.resolve(p.ref.key)) : null;
        if (!here || !links) return <span key={i} className="font-bold">#a thread in another game</span>;
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

export function Message({ m, me, live, compact = false }: { m: ChatMessage; me: Villager | null | undefined; live: WorkshopData; compact?: boolean }) {
  const [shown, setShown] = useState(false);
  const [tools, setTools] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { run, busy, error } = useAction();
  const own = me?.id === m.author.id && !me.practice;
  const reported = live.myReports.has(targetKey({ messageId: m.id }));
  const canReport = Boolean(me) && !own;
  const hasTools = !compact && (canReport || live.mod);
  return (
    <li className={'group flex gap-2.5 ' + (m.removed ? 'opacity-50' : '')}>
      <Avatar name={m.author.name} url={m.author.avatarUrl} size={compact ? 22 : 32} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-bold">{m.author.name}</span>
          <span className="text-xs text-muted">{ago(m.createdAt)}</span>
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
          <>
            <p className={'whitespace-pre-wrap break-words ' + (compact ? 'line-clamp-2 text-sm' : '')}><MessageText body={m.body} /></p>
            {!compact && <LinkedCard refs={refsIn(m.body)} me={me} live={live} />}
          </>
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

/** The first thread a message points at, as a card under it: its latest words and a reply box. */
function LinkedCard({ refs, me, live }: { refs: Ref[]; me: Villager | null | undefined; live: WorkshopData }) {
  const links = useContext(ChatLinks);
  const first = links && refs.find((r) => r.game === links.gameId);
  if (!links || !first) return null;
  const key = links.threads.resolve(first.key);
  return (
    <div className="mt-2">
      <ThreadCard as="div" info={links.threads.info(key)} messages={links.threads.inThread(key)} me={me} live={live} onOpen={() => links.open(key)} />
    </div>
  );
}

/**
 * The message box: a text field, a spoiler switch and Send. Visitors get a sign-in button.
 * Typing "#" opens a list of things to point at (#esh finds Eshmel); picking one writes
 * #Eshmel, and sending turns it into a link to his thread.
 */
export function Composer({ me, placeholder, onSend, id, compact = false }: {
  me: Villager | null | undefined; placeholder: string; onSend: (body: string, spoiler: boolean) => Promise<string | null>;
  /** The stream's box has an id, so "Say hi" can put the cursor in it. */
  id?: string;
  /** Inside a thread's card: smaller, and no sign-in button (the stream's box has one). */
  compact?: boolean;
}) {
  const [text, setText] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const links = useContext(ChatLinks);
  const [caret, setCaret] = useState(0);
  const [picked, setPicked] = useState<{ label: string; ref: Ref }[]>([]);
  const [sel, setSel] = useState(0);
  const [hidden, setHidden] = useState(false);

  const listId = useId();
  const hash = links ? typedHash(text, caret) : null;
  const query = hash ? hash.query : null;
  const choices = query === null || !links ? [] : rank(links.threads.options, query, (o) => o.search).slice(0, query ? 8 : 40);
  const picking = Boolean(hash && !hidden && choices.length);

  if (me === null) return compact ? null : <div className="mt-auto pt-2"><SignInPrompt>Sign in to chat</SignInPrompt></div>;

  const pick = (o: RefOption) => {
    if (!hash || !links) return;
    const next = insertPick(text, hash.start, caret, o.label);
    setText(next.text);
    setCaret(next.caret);
    setPicked((p) => [...p.filter((x) => x.label !== o.label), { label: o.label, ref: { game: links.gameId, key: o.key } }]);
    setSel(0);
    requestAnimationFrame(() => { field.current?.focus(); field.current?.setSelectionRange(next.caret, next.caret); });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = encodeRefs(text.trim(), picked);
    if (!body || busy) return;
    setBusy(true);
    const err = await onSend(body, spoiler);
    setBusy(false);
    setError(err ?? '');
    if (!err) { setText(''); setSpoiler(false); setPicked([]); setCaret(0); }
  };
  const size = compact ? 'size-7' : 'size-9';
  const track = (el: HTMLInputElement) => setCaret(el.selectionStart ?? el.value.length);

  return (
    <div className={'relative ' + (compact ? '' : 'mt-auto')}>
      {picking && (
        <ul id={listId} role="listbox" aria-label="Point at something" className="absolute inset-x-0 bottom-full z-30 mb-2 max-h-64 overflow-y-auto overscroll-contain rounded-2xl bg-card p-1 shadow-soft ring-1 ring-line">
          {choices.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === sel}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseEnter={() => setSel(i)}
                className={'flex w-full items-baseline gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm ' + (i === sel ? 'bg-card-2 ring-1 ring-ink' : '')}>
                <span className="shrink-0 font-bold">#{o.label}</span>
                <span className="min-w-0 truncate text-xs text-muted">{o.where}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* The whole box takes a click: the text field fills its height, and a click on its edge lands in the field. */}
      <form onSubmit={submit} onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); field.current?.focus(); } }}
        className={'flex cursor-text items-center gap-1.5 rounded-full ring-1 ring-line focus-within:ring-2 focus-within:ring-sky ' + (compact ? 'bg-card p-1' : 'bg-card-2 p-1.5')}>
        <input ref={field} id={id} value={text} maxLength={4000} disabled={me === undefined}
          onChange={(e) => { setText(e.target.value); track(e.target); setHidden(false); setSel(0); if (error) setError(''); }}
          onSelect={(e) => track(e.currentTarget)}
          onBlur={() => setHidden(true)} onFocus={() => setHidden(false)}
          onKeyDown={(e) => {
            if (!picking) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % choices.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + choices.length) % choices.length); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(choices[Math.min(sel, choices.length - 1)]); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setHidden(true); }
          }}
          role="combobox" aria-expanded={picking} aria-controls={listId} aria-autocomplete="list"
          className={'min-w-0 flex-1 self-stretch bg-transparent outline-none placeholder:text-muted ' + (compact ? 'px-2.5 text-sm' : 'px-3')} placeholder={placeholder} aria-label={placeholder} />
        <Tip text="Spoiler: hide this message behind a tap" className="shrink-0">
          <button type="button" onClick={() => setSpoiler(!spoiler)} aria-pressed={spoiler}
            className={'grid place-items-center rounded-full ' + size + ' ' + (spoiler ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
            <EyeOff size={compact ? 14 : 16} aria-hidden="true" /><span className="sr-only">Spoiler</span>
          </button>
        </Tip>
        <button disabled={busy || !text.trim()} className={'btn-primary grid place-items-center rounded-full disabled:opacity-50 ' + size} aria-label="Send">
          <Send size={compact ? 14 : 16} aria-hidden="true" />
        </button>
      </form>
      {spoiler && <p className="mt-1 px-3 text-xs text-muted">Hidden behind a tap until someone chooses to read it.</p>}
      {error && <p role="status" className="mt-1 px-3 text-sm text-berry">{error}</p>}
    </div>
  );
}

/** Sends a message into a thread, stored under its key and tagged with its Page. */
export function sendToThread(live: WorkshopData, info: ThreadInfo) {
  return (body: string, spoiler: boolean) => live.send(body, {
    blockKey: info.block?.page.id ?? null, threadKey: info.key,
    draftId: info.kind === 'new' ? info.drafts.at(-1)?.id ?? null : null, spoiler,
  });
}

/** A thread in the stream: what it's about, its latest words, and a box to reply right there. */
function ThreadCard({ info, messages, me, live, onOpen, as: Box = 'li' }: {
  info: ThreadInfo; messages: ChatMessage[]; me: Villager | null | undefined; live: WorkshopData; onOpen: () => void;
  /** A list item in the stream; a plain box under a message that points at it. */
  as?: 'li' | 'div';
}) {
  const count = messages.filter((m) => !m.removed).length;
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
        <ul className="mt-2 grid gap-2 border-t border-line pt-2">
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
  const list = useRef<HTMLUListElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = list.current;
    if (el && (stick.current || (me && lastAuthor === me.id))) el.scrollTop = el.scrollHeight;
  }, [lastId, me, lastAuthor]);
  const onScroll = () => {
    const el = list.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  return { list, onScroll };
}

/** The game's one chat: messages to everyone, and a card for each thread that's talking. */
export function Stream({ topic, onAll, onFold, bar, className = '', messages, me, live, threads, onOpen }: {
  /** A Page chosen in the chips: the stream narrows to it. */
  topic: { key: string; label: string } | null; onAll: () => void;
  /** Wide screens: fold the chat to a thin strip. */
  onFold?: () => void;
  /** Before the heading, like the edit and chat switch over an editor. */
  bar?: React.ReactNode;
  className?: string;
  messages: ChatMessage[];
  me: Villager | null | undefined; live: WorkshopData; threads: Threads;
  onOpen: (key: ThreadKey) => void;
}) {
  const items = useMemo(() => buildStream(messages, threads.byId), [messages, threads.byId]);
  const last = messages.at(-1);
  const { list, onScroll } = useStickToBottom(last?.id, me, last?.author.id);

  return (
    <section aria-label="Chat" className={'relative flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-2xl bg-card p-4 ring-1 ring-line lg:min-h-0 ' + className}>
      <div className="flex flex-wrap items-center gap-x-2">
        {bar && <span className="mr-1 shrink-0">{bar}</span>}
        <h2 className="font-display text-xl">Chat</h2>
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
        <div className="m-auto grid max-w-sm justify-items-center gap-2 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-sky-soft text-sky"><MessageCircle aria-hidden="true" /></span>
          <h3 className="font-display text-xl">{topic ? `Nothing about ${topic.label} yet` : 'The village is quiet'}</h3>
          <p className="text-sm text-muted">Say what you&apos;ve found or what you&apos;re stuck on. Messages show up for everyone here right away.</p>
        </div>
      ) : (
        <ul ref={list} onScroll={onScroll} aria-live="polite" className="my-3 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain pr-1">
          {items.map((x) => x.kind === 'message'
            ? <Message key={x.m.id} m={x.m} me={me} live={live} />
            : <ThreadCard key={x.key} info={threads.info(x.key)} messages={x.messages} me={me} live={live} onOpen={() => onOpen(x.key)} />)}
          {messages.length < 4 && (
            <li className="mt-2 rounded-2xl bg-card-2 px-3 py-2.5 text-sm text-muted">
              It&apos;s quiet in here. Ask where something is, share something you found, or just say hi. Everyone here sees it right away.
            </li>
          )}
        </ul>
      )}
      <Composer id="chat-input" me={me} placeholder={topic ? `Message about ${topic.label}` : 'Message everyone'}
        onSend={(body, spoiler) => live.send(body, { blockKey: topic?.key ?? null, spoiler })} />
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
export function ThreadPanel({ info, messages, me, live, gameId, onBack, onClose, besideStream = false, onDraft, onEdit, bar, className = '' }: {
  info: ThreadInfo; messages: ChatMessage[]; me: Villager | null | undefined; live: WorkshopData; gameId: string;
  /** Back to the stream, where the two don't fit side by side. */
  onBack?: () => void;
  /** On the widest screens the stream stays beside the thread: Back gives way to an X there. */
  besideStream?: boolean;
  onClose?: () => void;
  /** Opens a Draft's card, to read it and vote. */
  onDraft: (draftId: string) => void;
  /** Opens the entry's editor (not shown while it's already open). */
  onEdit?: () => void;
  bar?: React.ReactNode;
  className?: string;
}) {
  const { loadThread } = live;
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
    <section aria-label={`Thread: ${info.title}`} className={'relative flex min-h-[28rem] min-w-0 flex-1 flex-col rounded-2xl bg-card p-4 ring-1 ring-line lg:min-h-0 ' + className}>
      <div className="flex items-center gap-2">
        {bar && <span className="shrink-0">{bar}</span>}
        {onBack && (
          <Tip text="Back to the whole chat" className={'shrink-0 ' + (besideStream ? '2xl:hidden' : '')}>
            <button onClick={onBack} aria-label="Back to the whole chat" className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
          </Tip>
        )}
        <ThreadIcon info={info} small />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg leading-tight" title={info.title}>{info.title}</h2>
          <p className="truncate text-xs text-muted">{info.where}{people ? ` · ${people} ${people === 1 ? 'person' : 'people'} talking` : ''}</p>
        </div>
        {onClose && besideStream && (
          <button onClick={onClose} aria-label="Close this thread" className="hidden size-8 shrink-0 2xl:grid place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
            <X size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      {(onEdit || href) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {onEdit && <SmallButton onClick={onEdit} icon={<PenLine size={13} aria-hidden="true" />}>{info.kind === 'setup' ? 'Set up' : 'Fix'}</SmallButton>}
          {href && <a href={href} className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">See it in the app</a>}
        </div>
      )}
      <ul ref={list} onScroll={onScroll} aria-live="polite" className="my-3 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain pr-1">
        {timeline.length === 0 && (
          <li className="m-auto grid max-w-xs justify-items-center gap-2 py-8 text-center">
            <h3 className="font-display text-lg">Start the thread</h3>
            <p className="text-sm text-muted">Ask what you&apos;re unsure of, or say what you&apos;re working on, so nobody does it twice. It shows in the main chat too.</p>
          </li>
        )}
        {timeline.map((x) => 'm' in x ? <Message key={`m${x.m.id}`} m={x.m} me={me} live={live} /> : (
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
      <Composer me={me} placeholder={`Message about ${info.title}`} onSend={sendToThread(live, info)} />
    </section>
  );
}
