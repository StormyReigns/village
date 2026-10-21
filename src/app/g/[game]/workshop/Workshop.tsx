'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, MessageCircle, Plus, Send, Sparkles, TriangleAlert, X,
} from 'lucide-react';
import type { GameBlock } from '@/data/games';
import { BlockIcon } from '@/components/Icon';
import { CardPreview, type CardContent } from '@/components/CardPreview';
import { MarketDay } from '@/components/Countdown';
import { AccountButton } from '@/components/AccountButton';
import { sortStandouts, type DraftStats } from '@/lib/standouts';

type Sort = 'standouts' | 'new' | 'needs' | 'shipped';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'standouts', label: 'Standouts' },
  { key: 'new', label: 'New' },
  { key: 'needs', label: 'Needs votes' },
  { key: 'shipped', label: 'Shipped' },
];

interface Draft extends DraftStats {
  blockKey: string;
  title: string;
  kind: 'fact' | 'opinion';
  content: CardContent;
  before?: CardContent;
  author: string;
  status: string;
  comments: number;
  example?: boolean;
}

// Clearly labeled examples, so the panel's design can be judged before real Drafts exist.
// They contain no game facts.
function exampleDrafts(blocks: GameBlock[]): Draft[] {
  const has = (k: string) => blocks.some((b) => b.key === k);
  const out: Draft[] = [];
  if (has('builds')) out.push({
    id: 'ex1', blockKey: 'builds', kind: 'opinion', title: 'Example build', author: 'example_villager', status: 'Open for votes',
    ups: 5, downs: 0, viewers: 9, createdAt: '2026-10-18', comments: 4, example: true,
    content: { name: 'Example build', for: 'An example unit', path: 'First class\nSecond class', why: 'Shows how an opinion Draft looks.' },
  });
  if (has('people')) out.push({
    id: 'ex2', blockKey: 'people', kind: 'fact', title: 'Example correction', author: 'example_villager', status: 'Waiting for review, 2 ahead',
    ups: 2, downs: 0, viewers: 3, createdAt: '2026-10-19', comments: 1, example: true,
    before: { name: 'Example unit', joins: 'Chapter 5' },
    content: { name: 'Example unit', joins: 'Chapter 6' },
  });
  return out;
}

export function Workshop({ game, blocks }: { game: { id: string; shortTitle: string; title: string }; blocks: GameBlock[] }) {
  const params = useSearchParams();
  const initial = params.get('block');
  const [block, setBlock] = useState<string>(initial && blocks.some((b) => b.key === initial) ? initial : 'all');
  const [sort, setSort] = useState<Sort>('standouts');
  const [showExamples, setShowExamples] = useState(false);
  const [composing, setComposing] = useState(false);

  const drafts = useMemo(() => (showExamples ? exampleDrafts(blocks) : []), [showExamples, blocks]);
  const counts = useMemo(() => Object.fromEntries(blocks.map((b) => [b.key, drafts.filter((d) => d.blockKey === b.key).length])), [blocks, drafts]);
  const visible = useMemo(() => {
    const list = drafts.filter((d) => block === 'all' || d.blockKey === block);
    if (sort === 'new') return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'needs') return [...list].sort((a, b) => a.viewers - b.viewers);
    if (sort === 'shipped') return list.filter((d) => d.status === 'Shipped');
    return sortStandouts(list);
  }, [drafts, block, sort]);
  const current = blocks.find((b) => b.key === block);

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
        <span className="rounded-full bg-sun-soft px-3 py-1 text-sm font-bold text-sun"><MarketDay /></span>
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

      <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Chat block={current?.label ?? (block === 'notice' ? 'the Notice Board' : null)} onAll={() => setBlock('all')} />

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
          ) : visible.length === 0 ? (
            <Empty
              title={`No Drafts${current ? ' for ' + current.label : ''} yet`}
              body="Spotted something missing or wrong? Start the first one."
              action={<button onClick={() => setComposing(true)} className="rounded-full bg-leaf px-4 py-2 font-bold text-paper">Start a Draft</button>}
              extra={!showExamples && <button onClick={() => setShowExamples(true)} className="text-sm font-bold text-muted underline underline-offset-2">Show example Drafts</button>}
            />
          ) : (
            <ul className="mt-3 grid gap-3">
              {visible.map((d) => <DraftCard key={d.id} draft={d} block={blocks.find((b) => b.key === d.blockKey)!} />)}
            </ul>
          )}
        </section>
      </div>

      {composing && <Compose blocks={blocks} initial={current?.key ?? blocks[0].key} onClose={() => setComposing(false)} />}
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

function Empty({ title, body, action, extra }: { title: string; body: string; action?: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="m-auto grid max-w-xs justify-items-center gap-3 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-leaf-soft text-leaf"><Sparkles aria-hidden="true" /></span>
      <h3 className="font-display text-xl">{title}</h3>
      <p className="text-sm text-muted">{body}</p>
      {action}
      {extra}
    </div>
  );
}

function DraftCard({ draft, block }: { draft: Draft; block: GameBlock }) {
  const [open, setOpen] = useState(false);
  const [vote, setVote] = useState<0 | 1 | -1>(0);
  const [discuss, setDiscuss] = useState(false);
  const total = draft.ups + draft.downs + (vote !== 0 ? 1 : 0);
  const leaning = draft.ups + (vote === 1 ? 1 : 0) >= draft.downs + (vote === -1 ? 1 : 0) ? 'leaning yes' : 'leaning no';
  return (
    <li className="rise rounded-3xl bg-card-2 p-3 ring-1 ring-line">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf"><BlockIcon name={block.icon} size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg leading-tight">{draft.title}</span>
            <span className={'rounded-full px-2 py-0.5 text-xs font-bold ' + (draft.kind === 'fact' ? 'bg-sky-soft text-sky' : 'bg-berry-soft text-berry')}>{draft.kind}</span>
            {draft.example && <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold text-sun">example</span>}
          </span>
          <span className="block text-sm text-muted">{block.label} · by {draft.author} · {draft.status}</span>
        </span>
      </button>
      {open && <div className="mt-3"><CardPreview block={block} content={draft.content} before={draft.before} label={block.label} /></div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {draft.kind === 'fact' ? (
          <>
            <VoteButton on={vote === 1} onClick={() => setVote(vote === 1 ? 0 : 1)} icon={<Check size={15} aria-hidden="true" />}>I can confirm</VoteButton>
            <VoteButton on={vote === -1} onClick={() => setVote(vote === -1 ? 0 : -1)} icon={<TriangleAlert size={15} aria-hidden="true" />}>Seems wrong</VoteButton>
          </>
        ) : (
          <>
            <VoteButton on={vote === 1} onClick={() => setVote(vote === 1 ? 0 : 1)} icon={<ArrowUp size={15} aria-hidden="true" />} label="Vote up" />
            <span className="text-sm text-muted">{total >= 5 ? `${draft.ups + (vote === 1 ? 1 : 0)} up · ${draft.downs + (vote === -1 ? 1 : 0)} down` : leaning}</span>
            <VoteButton on={vote === -1} onClick={() => setVote(vote === -1 ? 0 : -1)} icon={<ArrowDown size={15} aria-hidden="true" />} label="Vote down" />
          </>
        )}
        <button onClick={() => setDiscuss(!discuss)} aria-expanded={discuss} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:bg-card hover:text-ink">
          <MessageCircle size={15} aria-hidden="true" /> Discuss · {draft.comments}
        </button>
      </div>
      {discuss && <p className="mt-2 text-sm text-muted">This will show every chat message linked to this Draft, with a reply box. It turns on with chat.</p>}
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

function Chat({ block, onAll }: { block: string | null; onAll: () => void }) {
  const [note, setNote] = useState(false);
  return (
    <section aria-label="Chat" className="flex min-h-[28rem] flex-col rounded-[1.75rem] bg-card p-4 shadow-soft ring-1 ring-line">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl">Chat</h2>
        {block && (
          <span className="text-sm text-muted">
            about {block} · <button onClick={onAll} className="font-bold text-leaf underline underline-offset-2">show all</button>
          </span>
        )}
      </div>
      <div className="m-auto grid max-w-sm justify-items-center gap-2 py-10 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-sky-soft text-sky"><MessageCircle aria-hidden="true" /></span>
        <h3 className="font-display text-xl">The village is quiet</h3>
        <p className="text-sm text-muted">Say what you&apos;ve found or what you&apos;re stuck on. When a message sounds like a fix, you&apos;ll be asked if it should become a Draft.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setNote(true); }} className="mt-auto flex items-center gap-2 rounded-full bg-card-2 p-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
        <input className="min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted" placeholder="Write a message" aria-label="Write a message" />
        <button className="grid size-9 place-items-center rounded-full bg-sky text-paper" aria-label="Send"><Send size={16} aria-hidden="true" /></button>
      </form>
      {note && <p className="mt-2 text-sm text-muted">Chat turns on once sign-in is connected.</p>}
    </section>
  );
}

function Compose({ blocks, initial, onClose }: { blocks: GameBlock[]; initial: string; onClose: () => void }) {
  const [key, setKey] = useState(initial);
  const [content, setContent] = useState<CardContent>({});
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const empty = block.fields.filter((f) => f.required && !content[f.key]?.trim()).map((f) => f.key);
    setMissing(empty);
    if (empty.length) {
      setNote('');
      document.getElementById('field-' + empty[0])?.focus();
      return;
    }
    setNote('Looks good. Saving Drafts turns on once the database is connected.');
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
              <label className="grid gap-1">
                <span className="text-sm font-bold">Where can others check this?</span>
                <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="I saw it myself in chapter 6, or a link"
                  className="rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky" />
              </label>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-leaf px-5 py-2.5 font-bold text-paper hover:opacity-90">Submit Draft</button>
              <button type="button" onClick={onClose} className="rounded-full px-4 py-2.5 font-bold text-muted hover:text-ink">Cancel</button>
            </div>
            {note && <p role="status" className="text-sm">{note}</p>}
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
