'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, EyeOff, ExternalLink, MessageCircle, Plus, Send, Sparkles, TriangleAlert, X,
} from 'lucide-react';
import type { GameBlock } from '@/data/games';
import { titleField } from '@/lib/blocks';
import { BlockIcon } from '@/components/Icon';
import { CardPreview, type CardContent } from '@/components/CardPreview';
import { MarketDay } from '@/components/Countdown';
import { AccountButton } from '@/components/AccountButton';
import { Avatar } from '@/components/Avatar';
import { useVillager, type Villager } from '@/components/useVillager';
import { sortStandouts } from '@/lib/standouts';
import { useWorkshop, type ChatMessage, type LiveDraft, type NewDraft } from './useWorkshop';

type Sort = 'standouts' | 'new' | 'needs' | 'shipped';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'standouts', label: 'Standouts' },
  { key: 'new', label: 'New' },
  { key: 'needs', label: 'Needs votes' },
  { key: 'shipped', label: 'Shipped' },
];

const STATUS: Record<string, string> = {
  checking: 'Being checked', open: 'Open for votes', approved: 'Approved', preview: 'In Preview', stable: 'Shipped', declined: 'Declined',
};

type SendFn = (body: string, opts?: { blockKey?: string | null; draftId?: string | null; spoiler?: boolean }) => Promise<string | null>;

/** "just now", "5m", "3h", or a date. Only ever runs in the browser. */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Workshop({ game, blocks }: { game: { id: string; shortTitle: string; title: string }; blocks: GameBlock[] }) {
  const params = useSearchParams();
  const initial = params.get('block');
  const [block, setBlock] = useState<string>(initial && blocks.some((b) => b.key === initial) ? initial : 'all');
  const [sort, setSort] = useState<Sort>('standouts');
  const [composing, setComposing] = useState(false);
  const me = useVillager();
  const live = useWorkshop(game.id, me);

  const drafts = live.drafts;
  const counts = useMemo(() => Object.fromEntries(blocks.map((b) => [b.key, drafts.filter((d) => d.blockKey === b.key).length])), [blocks, drafts]);
  const visible = useMemo(() => {
    const list = drafts.filter((d) => block === 'all' || d.blockKey === block);
    if (sort === 'new') return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'needs') return list.filter((d) => d.status === 'open').sort((a, b) => a.viewers - b.viewers);
    if (sort === 'shipped') return list.filter((d) => d.status === 'stable');
    return sortStandouts(list.filter((d) => d.status !== 'declined'));
  }, [drafts, block, sort]);
  const current = blocks.find((b) => b.key === block);
  const chat = useMemo(() => (current ? live.messages.filter((m) => m.blockKey === current.key) : live.messages), [live.messages, current]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-5 sm:px-6">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="grid size-9 place-items-center rounded-full bg-card ring-1 ring-line hover:ring-ink" aria-label="Village square">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Workshop</p>
          <h1 className="font-display text-2xl leading-tight">{game.shortTitle}</h1>
        </div>
        <span className="hidden rounded-full bg-sun-soft px-3 py-1 text-sm font-bold text-sun sm:inline"><MarketDay /></span>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/g/${game.id}`} className="gloss btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold">
            Open the app <ExternalLink size={16} aria-hidden="true" />
          </Link>
          <AccountButton />
        </div>
      </header>

      {/* Block chips */}
      <nav aria-label="Blocks" className="chip-strip -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={block === 'all'} onClick={() => setBlock('all')} count={drafts.length}>All</Chip>
        {blocks.map((b) => (
          <Chip key={b.key} active={block === b.key} onClick={() => setBlock(b.key)} count={counts[b.key]} icon={b.icon}>{b.label}</Chip>
        ))}
        <Chip active={block === 'notice'} onClick={() => setBlock('notice')} count={0} icon="Flag">Notice Board</Chip>
      </nav>

      {live.state === 'offline' && (
        <p role="status" className="mt-3 rounded-2xl bg-berry-soft px-4 py-3 text-sm text-berry">Couldn&apos;t reach the village just now. Refresh the page to try again.</p>
      )}

      <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Chat
          block={current ?? null}
          notice={block === 'notice'}
          onAll={() => setBlock('all')}
          messages={chat}
          drafts={drafts}
          me={me}
          loading={live.state === 'loading'}
          send={live.send}
        />

        {/* Drafts panel */}
        <section aria-label="Drafts" className="flex min-h-[28rem] flex-col rounded-[1.75rem] bg-card p-4 shadow-soft ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl">{block === 'notice' ? 'Notice Board' : 'Drafts'}</h2>
            <label className="ml-auto">
              <span className="sr-only">Sort Drafts</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full bg-card-2 px-3 py-1.5 text-sm font-bold ring-1 ring-line">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <button onClick={() => setComposing(true)} className="inline-flex items-center gap-1 rounded-full bg-leaf px-3 py-1.5 text-sm font-bold text-paper hover:opacity-90">
              <Plus size={16} aria-hidden="true" /> New
            </button>
          </div>

          {block === 'notice' ? (
            <Empty title="No reports waiting" body="When players tap “not quite” in the app without signing in, their report waits here until a villager confirms it." />
          ) : live.state === 'loading' ? (
            <div className="mt-3 grid gap-3" aria-hidden="true">
              {[0, 1].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-card-2" />)}
            </div>
          ) : visible.length === 0 ? (
            <Empty
              title={sort === 'shipped' ? 'Nothing shipped yet' : `No Drafts${current ? ' for ' + current.label : ''} yet`}
              body={sort === 'shipped' ? 'Drafts land here once they reach the app.' : 'Spotted something missing or wrong? Start the first one.'}
              action={<button onClick={() => setComposing(true)} className="rounded-full bg-leaf px-4 py-2 font-bold text-paper">Start a Draft</button>}
            />
          ) : (
            <ul className="mt-3 grid gap-3">
              {visible.map((d) => (
                <DraftCard key={d.id} draft={d} block={blocks.find((b) => b.key === d.blockKey)} me={me}
                  messages={live.messages.filter((m) => m.draftId === d.id)}
                  vote={live.vote} view={live.view} send={live.send} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {composing && (
        <Compose blocks={blocks} initial={current?.key ?? blocks[0].key} me={me} postDraft={live.postDraft}
          onClose={() => setComposing(false)} onPosted={(key) => { setComposing(false); setBlock(key); setSort('new'); }} />
      )}
    </main>
  );
}

function Chip({ active, onClick, count, icon, children }: { active: boolean; onClick: () => void; count?: number; icon?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 transition ' +
        (active ? 'bg-leaf text-paper ring-leaf' : 'bg-card text-ink ring-line hover:ring-leaf')}
    >
      {icon && <BlockIcon name={icon} size={15} />}
      {children}
      {count !== undefined && <span className={'rounded-full px-1.5 text-xs ' + (active ? 'bg-paper/25' : 'bg-card-2 text-muted')}>{count}</span>}
    </button>
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

/** "Sign in to …" for visitors: a link to the sign-in page that comes back here. */
function SignInPrompt({ children }: { children: React.ReactNode }) {
  const path = usePathname() || '/';
  return (
    <Link href={`/signin?next=${encodeURIComponent(path)}`} className="gloss btn-primary inline-flex rounded-full px-4 py-2 text-sm font-bold">
      {children}
    </Link>
  );
}

function DraftCard({ draft, block, me, messages, vote, view, send }: {
  draft: LiveDraft; block?: GameBlock; me: Villager | null | undefined; messages: ChatMessage[];
  vote: (id: string, v: 0 | 1 | -1) => Promise<string | null>; view: (id: string) => Promise<void>; send: SendFn;
}) {
  const [open, setOpen] = useState(false);
  const [discuss, setDiscuss] = useState(false);
  const [error, setError] = useState('');
  if (!block) return null;
  const mine = me?.id === draft.author.id && !me.practice;
  const practiceVote = Boolean(me?.practice && me.id === draft.author.id);
  const total = draft.ups + draft.downs;
  const leaning = total === 0 ? 'no votes yet' : draft.ups >= draft.downs ? 'leaning yes' : 'leaning no';
  const cast = async (v: 0 | 1 | -1) => setError((await vote(draft.id, v)) ?? '');
  const expand = () => { if (!open) view(draft.id); setOpen(!open); };

  const voting = !me ? null : mine ? (
    <span className="text-sm text-muted">Your Draft · {total >= 5 ? `${draft.ups} yes · ${draft.downs} no` : leaning}</span>
  ) : draft.kind === 'fact' ? (
    <>
      <VoteButton on={draft.myVote === 1} onClick={() => cast(draft.myVote === 1 ? 0 : 1)} icon={<Check size={15} aria-hidden="true" />}>I can confirm</VoteButton>
      <VoteButton on={draft.myVote === -1} onClick={() => cast(draft.myVote === -1 ? 0 : -1)} icon={<TriangleAlert size={15} aria-hidden="true" />}>Seems wrong</VoteButton>
    </>
  ) : (
    <>
      <VoteButton on={draft.myVote === 1} onClick={() => cast(draft.myVote === 1 ? 0 : 1)} icon={<ArrowUp size={15} aria-hidden="true" />} label="Vote up" />
      <span className="text-sm text-muted">{total >= 5 ? `${draft.ups} up · ${draft.downs} down` : leaning}</span>
      <VoteButton on={draft.myVote === -1} onClick={() => cast(draft.myVote === -1 ? 0 : -1)} icon={<ArrowDown size={15} aria-hidden="true" />} label="Vote down" />
    </>
  );

  return (
    <li className="rise rounded-3xl bg-card-2 p-3 ring-1 ring-line">
      <button onClick={expand} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf"><BlockIcon name={block.icon} size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg leading-tight">{draft.title}</span>
            <span className={'rounded-full px-2 py-0.5 text-xs font-bold ' + (draft.kind === 'fact' ? 'bg-sky-soft text-sky' : 'bg-berry-soft text-berry')}>{draft.kind}</span>
            {draft.theory && <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold text-sun">Theory</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Avatar name={draft.author.name} url={draft.author.avatarUrl} size={18} />
            {block.label} · {draft.author.name} · {ago(draft.createdAt)} · {STATUS[draft.status] ?? draft.status}
          </span>
        </span>
      </button>
      {open && (
        <div className="mt-3 grid gap-2">
          <CardPreview block={block} content={draft.content} label={block.label} />
          {draft.source && <p className="text-sm text-muted"><span className="font-bold text-ink">Source:</span> {draft.source}</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {me === null ? <SignInPrompt>Sign in to vote</SignInPrompt> : voting}
        <button onClick={() => setDiscuss(!discuss)} aria-expanded={discuss} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:bg-card hover:text-ink">
          <MessageCircle size={15} aria-hidden="true" /> Discuss · {messages.length}
        </button>
      </div>
      {practiceVote && <p className="mt-2 text-xs text-muted">Your own Draft: votes here are practice, and only you see them.</p>}
      {error && <p role="status" className="mt-2 text-sm text-berry">{error}</p>}
      {discuss && (
        <div className="mt-3 grid gap-2 rounded-2xl bg-card p-3 ring-1 ring-line">
          {messages.length === 0
            ? <p className="text-sm text-muted">No one has talked about this Draft yet.</p>
            : <ul className="grid gap-3">{messages.map((m) => <Message key={m.id} m={m} />)}</ul>}
          <Composer me={me} placeholder="Reply about this Draft" onSend={(body, spoiler) => send(body, { blockKey: draft.blockKey, draftId: draft.id, spoiler })} />
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

function Message({ m, tag }: { m: ChatMessage; tag?: string | null }) {
  const [shown, setShown] = useState(false);
  return (
    <li className="flex gap-2.5">
      <Avatar name={m.author.name} url={m.author.avatarUrl} size={32} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-bold">{m.author.name}</span>
          <span className="text-xs text-muted">{ago(m.createdAt)}</span>
          {tag && <span className="rounded-full bg-card-2 px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-line">{tag}</span>}
        </p>
        {m.spoiler && !shown ? (
          <button onClick={() => setShown(true)} className="mt-0.5 inline-flex items-center gap-1.5 rounded-xl bg-ink/80 px-3 py-1 text-sm font-bold text-paper">
            <EyeOff size={14} aria-hidden="true" /> Spoiler · tap to show
          </button>
        ) : (
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        )}
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
        <input value={text} onChange={(e) => { setText(e.target.value); if (error) setError(''); }} maxLength={4000} disabled={me === undefined}
          className="min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted" placeholder={placeholder} aria-label={placeholder} />
        <button type="button" onClick={() => setSpoiler(!spoiler)} aria-pressed={spoiler} title="Mark as a spoiler"
          className={'grid size-9 place-items-center rounded-full ' + (spoiler ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>
          <EyeOff size={16} aria-hidden="true" /><span className="sr-only">Spoiler</span>
        </button>
        <button disabled={busy || !text.trim()} className="grid size-9 place-items-center rounded-full bg-sky text-paper disabled:opacity-50" aria-label="Send">
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
      {spoiler && <p className="mt-1 px-3 text-xs text-muted">Hidden behind a tap until someone chooses to read it.</p>}
      {error && <p role="status" className="mt-1 px-3 text-sm text-berry">{error}</p>}
    </div>
  );
}

function Chat({ block, notice, onAll, messages, drafts, me, loading, send }: {
  block: GameBlock | null; notice: boolean; onAll: () => void; messages: ChatMessage[]; drafts: LiveDraft[];
  me: Villager | null | undefined; loading: boolean; send: SendFn;
}) {
  const list = useRef<HTMLUListElement>(null);
  const titles = useMemo(() => new Map(drafts.map((d) => [d.id, d.title])), [drafts]);
  const lastId = messages.at(-1)?.id;

  // Keep the newest message in view.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const tagFor = (m: ChatMessage) => (m.draftId && titles.has(m.draftId) ? `on “${titles.get(m.draftId)}”` : null);

  return (
    <section aria-label="Chat" className="flex min-h-[28rem] flex-col rounded-[1.75rem] bg-card p-4 shadow-soft ring-1 ring-line lg:max-h-[calc(100vh-11rem)]">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl">Chat</h2>
        {(block || notice) && (
          <span className="text-sm text-muted">
            about {block?.label ?? 'the Notice Board'} · <button onClick={onAll} className="font-bold text-leaf underline underline-offset-2">show all</button>
          </span>
        )}
      </div>
      {loading ? (
        <div className="m-auto py-10 text-sm text-muted">Opening the workshop doors…</div>
      ) : messages.length === 0 ? (
        <div className="m-auto grid max-w-sm justify-items-center gap-2 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-sky-soft text-sky"><MessageCircle aria-hidden="true" /></span>
          <h3 className="font-display text-xl">{block ? `Nothing about ${block.label} yet` : 'The village is quiet'}</h3>
          <p className="text-sm text-muted">Say what you&apos;ve found or what you&apos;re stuck on. Messages show up for everyone here right away.</p>
        </div>
      ) : (
        <ul ref={list} aria-live="polite" className="my-3 grid flex-1 content-start gap-4 overflow-y-auto pr-1">
          {messages.map((m) => <Message key={m.id} m={m} tag={tagFor(m)} />)}
        </ul>
      )}
      <Composer me={me} placeholder={block ? `Message about ${block.label}` : 'Write a message'}
        onSend={(body, spoiler) => send(body, { blockKey: block?.key ?? null, spoiler })} />
    </section>
  );
}

function Compose({ blocks, initial, me, postDraft, onClose, onPosted }: {
  blocks: GameBlock[]; initial: string; me: Villager | null | undefined;
  postDraft: (d: NewDraft) => Promise<string | null>; onClose: () => void; onPosted: (blockKey: string) => void;
}) {
  const [key, setKey] = useState(initial);
  const [content, setContent] = useState<CardContent>({});
  const [source, setSource] = useState('');
  const [theory, setTheory] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const block = blocks.find((b) => b.key === key)!;
  const set = (k: string, v: string) => {
    setContent({ ...content, [k]: v });
    if (missing.includes(k)) setMissing(missing.filter((m) => m !== k));
  };
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const empty = block.fields.filter((f) => f.required && !content[f.key]?.trim()).map((f) => f.key);
    setMissing(empty);
    if (empty.length) {
      setNote('');
      document.getElementById('field-' + empty[0])?.focus();
      return;
    }
    const title = (content[titleField(block).key] ?? '').trim();
    if (title.length < 3 || title.length > 120) {
      setNote(`${titleField(block).label} needs 3 to 120 characters.`);
      return;
    }
    const trimmed = Object.fromEntries(Object.entries(content).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    setBusy(true);
    const err = await postDraft({
      blockKey: block.key, kind: block.kind === 'opinion' ? 'opinion' : 'fact', title, content: trimmed,
      source: source.trim(), theory: block.kind !== 'opinion' && theory,
    });
    setBusy(false);
    if (err) setNote(err);
    else onPosted(block.key);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="New Draft"
        onClick={(e) => e.stopPropagation()}
        className="rise max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[2rem] bg-card p-5 shadow-soft outline-none sm:rounded-[2rem] sm:p-6"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">New Draft</h2>
          <button onClick={onClose} className="ml-auto grid size-9 place-items-center rounded-full bg-card-2 ring-1 ring-line" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="chip-strip -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {blocks.map((b) => (
            <Chip key={b.key} active={b.key === key} onClick={() => { setKey(b.key); setContent({}); setNote(''); setMissing([]); }} icon={b.icon}>{b.label}</Chip>
          ))}
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <form onSubmit={submit} className="grid content-start gap-3">
            <p className="text-sm text-muted">{block.blurb}</p>
            {block.fields.map((f) => {
              const bad = missing.includes(f.key);
              const props = {
                id: 'field-' + f.key,
                value: content[f.key] ?? '',
                'aria-invalid': bad || undefined,
                'aria-describedby': bad ? 'err-' + f.key : undefined,
                className: 'rounded-2xl bg-card-2 px-3 py-2 ring-1 outline-none placeholder:text-muted focus:ring-2 focus:ring-sky ' + (bad ? 'ring-berry' : 'ring-line'),
              };
              return (
                <label key={f.key} className="grid gap-1">
                  <span className="text-sm font-bold">{f.label}{f.required && <span className="text-berry"> *</span>}</span>
                  {f.type === 'longtext' || f.type === 'list' ? (
                    <textarea {...props} rows={f.type === 'list' ? 3 : 2} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
                  ) : f.type === 'select' ? (
                    <select {...props} onChange={(e) => set(f.key, e.target.value)}>
                      <option value="">Choose</option>
                      {f.options?.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input {...props} type={f.type === 'number' ? 'number' : 'text'} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
                  )}
                  {bad && <span id={'err-' + f.key} className="text-sm text-berry">Add {f.label.toLowerCase()} before submitting.</span>}
                </label>
              );
            })}
            {block.kind !== 'opinion' && (
              <>
                <label className="grid gap-1">
                  <span className="text-sm font-bold">Where can others check this?</span>
                  <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="I saw it myself in chapter 6, or a link"
                    className="rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky" />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={theory} onChange={(e) => setTheory(e.target.checked)} className="size-4 accent-[var(--color-leaf)]" />
                  <span><span className="font-bold">It&apos;s a theory.</span> Not confirmed yet, so it shows a Theory label.</span>
                </label>
              </>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {me === null ? (
                <SignInPrompt>Sign in to submit</SignInPrompt>
              ) : (
                <button disabled={busy || me === undefined} className="rounded-full bg-leaf px-5 py-2.5 font-bold text-paper hover:opacity-90 disabled:opacity-60">
                  {busy ? 'Submitting…' : 'Submit Draft'}
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded-full px-4 py-2.5 font-bold text-muted hover:text-ink">Cancel</button>
            </div>
            {note && <p role="status" className="text-sm text-berry">{note}</p>}
          </form>

          <div className="grid content-start gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Live preview: how it will look in the app</p>
            <CardPreview block={block} content={content} label={block.label} />
          </div>
        </div>
      </div>
    </div>
  );
}
