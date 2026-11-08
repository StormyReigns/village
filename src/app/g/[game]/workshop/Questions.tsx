'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleHelp, FileText, Flag, Link2, Merge, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import type { Page } from '@/data/pages';
import type { Villager } from '@/components/useVillager';
import { EntryIcon } from '@/components/app/EntryPanel';
import { entryText } from '@/components/app/entries';
import { SignInPrompt } from '@/components/SignInPrompt';
import { rank } from '@/lib/search';
import { oldestFirst, openFor, wantCount } from '@/lib/questions';
import { type LiveQuestion, type QuestionsData } from '@/components/questions/useQuestions';
import { SmallButton, useAction } from './chat/bits';
import type { Placed } from './chat/Chat';

// The Workshop's Questions tab (docs/blocks/questions.md): what players have asked, oldest
// first, each with the Drafts already answering it. Two ways to answer, each with a short reply
// to the asker: update the app with a Draft (it closes the question when it ships), or link the
// entry that already has the answer (it closes straight away). No claiming, no time limit.

/** What the Workshop's editor needs to start a Draft that answers a question. */
export interface AnswerStart { question: { id: string; body: string }; blockId: string; entryId?: string }

/** A Draft as this tab needs it: which question it answers, and how long it's been open. */
export interface QuestionDraft { id: string; questionId?: string | null; status: string; createdAt: string; title: string }

const isOpenDraft = (d: QuestionDraft) => d.status === 'open' || d.status === 'checking';

/** Find an entry anywhere in the app, by name or words in it. */
function EntryPicker({ blocks, onPick, label }: { blocks: Placed[]; onPick: (b: Placed, entryId: string) => void; label: string }) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => blocks.flatMap((b) => b.entries.map((e) => ({ b, e }))), [blocks]);
  const hits = query.trim().length >= 2 ? rank(all, query, ({ e }) => entryText(e)).slice(0, 6) : [];
  return (
    <div className="grid gap-1.5">
      <label className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm ring-1 ring-ink focus-within:ring-2 focus-within:ring-signal">
        <Search size={15} className="text-muted" aria-hidden="true" />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={label} aria-label={label}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
      </label>
      {hits.length > 0 && (
        <ul className="grid gap-1">
          {hits.map(({ b, e }) => (
            <li key={`${b.id}.${e.id}`}>
              <button type="button" onClick={() => onPick(b, e.id)} className="flex w-full items-center gap-2 rounded-xl bg-card px-2 py-1.5 text-left ring-1 ring-line hover:ring-ink">
                <EntryIcon entry={e} block={b} size="sm" color={`var(--${b.page.tint})`} />
                <span className="min-w-0">
                  <span className="block font-bold leading-tight">{e.name}</span>
                  <span className="block text-xs text-muted">{b.page.title === b.title ? b.title : `${b.page.title} · ${b.title}`}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !hits.length && <p className="text-xs text-muted">Nothing matches. Try just a name.</p>}
    </div>
  );
}

/** One open question: who wants to know, how long it's waited, its Drafts, and the two ways to answer. */
function QuestionCard({ q, pageTitle, blocks, drafts, data, me, mod, reported, focused, others, onAnswer, onOpenDraft }: {
  q: LiveQuestion; pageTitle?: string; reported?: boolean;
  /** Arrived here from the app's "Answer it": brought into view and ringed in yellow. */
  focused?: boolean; blocks: Placed[]; drafts: QuestionDraft[]; data: QuestionsData; me: Villager | null | undefined; mod: boolean;
  others: LiveQuestion[]; onAnswer: (a: AnswerStart) => void; onOpenDraft: (id: string) => void;
}) {
  const [mode, setMode] = useState<'update' | 'new' | 'link' | 'merge' | null>(null);
  const [linked, setLinked] = useState<{ b: Placed; entryId: string } | null>(null);
  const [reply, setReply] = useState('');
  const act = useAction();
  const answering = drafts.filter((d) => d.questionId === q.id && isOpenDraft(d));
  const n = wantCount(q);
  const page = blocks.find((b) => b.page.id === q.pageKey)?.page;
  const linkedEntry = linked ? linked.b.entries.find((e) => e.id === linked.entryId) : undefined;
  const card = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused) card.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focused]);

  return (
    <li ref={card} className={'rise rounded-3xl bg-card p-3 ' + (focused ? 'ring-2 ring-signal' : 'ring-1 ring-line')}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-card-2"><CircleHelp size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg leading-tight">{q.body}</span>
            {q.spoiler && <span className="rounded-full bg-plum-soft px-2 py-0.5 text-xs font-bold text-plum">Spoiler</span>}
            {reported && <span className="inline-flex items-center gap-1 rounded-full bg-berry-soft px-2 py-0.5 text-xs font-bold text-berry"><Flag size={11} aria-hidden="true" /> Reported</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Open {openFor(q.createdAt)}{n > 0 ? ` · ${n} ${n === 1 ? 'player wants' : 'players want'} to know` : ''}{pageTitle ? ` · ${pageTitle}` : ''}
          </p>
          {q.note && <p className="mt-1.5 rounded-xl bg-card-2 px-2.5 py-1.5 text-sm"><span className="font-bold">Known so far:</span> {q.note}</p>}
          <div className="mt-2 text-sm">
            {answering.length ? (
              <>
                <p className="font-bold">{answering.length} {answering.length === 1 ? 'Draft' : 'Drafts'} answering it</p>
                <ul className="mt-1 grid gap-1">
                  {answering.map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => onOpenDraft(d.id)} className="inline-flex items-center gap-1.5 rounded-full bg-card-2 px-2.5 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                        <FileText size={13} aria-hidden="true" /> {d.title} · open {openFor(d.createdAt)}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="text-muted">No Draft answering it yet.</p>}
          </div>
        </div>
      </div>

      {!me ? (
        <div className="mt-3 pl-12"><SignInPrompt back="?tab=questions" forWhat="answer a question">Sign in to answer</SignInPrompt></div>
      ) : mode === null ? (
        <div className="mt-3 flex flex-wrap gap-2 pl-12">
          <button type="button" onClick={() => setMode('update')} className="btn-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold">
            <FileText size={15} aria-hidden="true" /> Update the app
          </button>
          <button type="button" onClick={() => setMode('link')} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink">
            <Link2 size={15} aria-hidden="true" /> It&apos;s already there
          </button>
          {mod && (
            <span className="ml-auto flex gap-1.5">
              {others.length > 0 && <SmallButton onClick={() => setMode('merge')} icon={<Merge size={13} aria-hidden="true" />}>Merge</SmallButton>}
              <SmallButton tone="bad" disabled={act.busy} onClick={() => act.run(() => data.moderate.remove(q.id))} icon={<Trash2 size={13} aria-hidden="true" />}>Remove</SmallButton>
            </span>
          )}
        </div>
      ) : (
        <div className="workbench mt-3 grid gap-2 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-sm font-bold">
              {mode === 'update' ? 'Which entry has it wrong or missing?' : mode === 'new' ? 'Where does the new entry go?' : mode === 'link' ? 'Which entry already answers it?' : 'Merge into which question?'}
            </p>
            <button type="button" onClick={() => { setMode(null); setLinked(null); setReply(''); }} aria-label="Cancel" className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink"><X size={15} aria-hidden="true" /></button>
          </div>

          {mode === 'update' && (
            <>
              <EntryPicker blocks={page ? [...blocks.filter((b) => b.page.id === page.id), ...blocks.filter((b) => b.page.id !== page.id)] : blocks}
                label="Find the entry to fix" onPick={(b, entryId) => onAnswer({ question: { id: q.id, body: q.body }, blockId: b.id, entryId })} />
              <button type="button" onClick={() => setMode('new')} className="inline-flex items-center gap-1.5 self-start rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                <Plus size={13} aria-hidden="true" /> Or add something new (a guide, a character…)
              </button>
            </>
          )}

          {mode === 'new' && (
            <div className="flex flex-wrap gap-1.5">
              {(page ? [...blocks.filter((b) => b.page.id === page.id), ...blocks.filter((b) => b.page.id !== page.id)] : blocks).map((b) => (
                <button key={b.id} type="button" onClick={() => onAnswer({ question: { id: q.id, body: q.body }, blockId: b.id })}
                  className="rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">
                  {b.page.title === b.title ? b.title : `${b.page.title} · ${b.title}`}
                </button>
              ))}
            </div>
          )}

          {mode === 'link' && (
            linkedEntry ? (
              <form className="grid gap-2" onSubmit={async (e) => {
                e.preventDefault();
                const card = linkedEntry.ref?.card;
                if (!card) return;
                await act.run(() => data.answerWithLink(q.id, card, reply));
              }}>
                <p className="flex items-center gap-2 text-sm">
                  <EntryIcon entry={linkedEntry} block={linked!.b} size="sm" color={`var(--${linked!.b.page.tint})`} />
                  <span className="min-w-0 flex-1 font-bold">{linkedEntry.name}</span>
                  <button type="button" onClick={() => setLinked(null)} className="text-xs font-bold text-muted underline">Change</button>
                </p>
                <label className="grid gap-1 text-sm">
                  <span className="font-bold">Your reply to the asker</span>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={500} rows={2} autoFocus
                    placeholder={`${linkedEntry.name} has it: …`} className="rounded-xl bg-card px-3 py-2 outline-none ring-1 ring-ink focus:ring-2 focus:ring-signal" />
                </label>
                <p className="text-xs text-muted">It closes the question now, and the reply goes to everyone who asked.</p>
                <button disabled={act.busy || reply.trim().length < 3 || !linkedEntry.ref} className="btn-primary self-start rounded-full px-4 py-1.5 text-sm font-bold disabled:opacity-50">
                  {act.busy ? 'Sending…' : 'Send the answer'}
                </button>
              </form>
            ) : <EntryPicker blocks={blocks} label="Find the entry that answers it" onPick={(b, entryId) => setLinked({ b, entryId })} />
          )}

          {mode === 'merge' && (
            <ul className="grid gap-1">
              {others.map((o) => (
                <li key={o.id}>
                  <button type="button" disabled={act.busy} onClick={() => act.run(() => data.moderate.merge(q.id, o.id))}
                    className="w-full rounded-xl bg-card px-3 py-1.5 text-left text-sm font-bold ring-1 ring-line hover:ring-ink">{o.body}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {act.error && <p role="alert" className="mt-2 rounded-xl bg-berry-soft px-3 py-1.5 text-sm text-berry">{act.error}</p>}
    </li>
  );
}

/** The tab itself. `page` narrows it to one Page's questions, like the folder tabs above. */
export function QuestionsTab({ data, pages, blocks, page, drafts, me, mod, query = '', reported, onAnswer, onOpenDraft }: {
  data: QuestionsData; pages: Page[]; blocks: Placed[]; page?: Page; drafts: QuestionDraft[]; me: Villager | null | undefined; mod: boolean;
  /** The Workshop's search box. */
  query?: string;
  /** Moderators: questions with open reports (handled on the Notice Board), marked here. */
  reported?: Set<string>;
  onAnswer: (a: AnswerStart) => void; onOpenDraft: (id: string) => void;
}) {
  const [showAnswered, setShowAnswered] = useState(false);
  // ?q= (from the app's "Answer it"): which question to bring into view. Read once, then dropped
  // from the address so a refresh or a later visit doesn't jump back to it.
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('q');
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the address after hydration
    setFocus(id);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  }, []);
  const act = useAction();
  const titleOf = (key: string | null) => pages.find((p) => p.id === key)?.title;
  const here = (q: LiveQuestion) => (!page || q.pageKey === page.id) && (!query.trim() || q.body.toLowerCase().includes(query.trim().toLowerCase()));
  const open = oldestFirst(data.questions.filter((q) => q.status === 'open' && here(q)));
  const answered = data.questions.filter((q) => q.status === 'answered' && here(q))
    .sort((a, b) => (b.answeredAt ?? '').localeCompare(a.answeredAt ?? '')).slice(0, 20);

  if (data.state === 'loading') return <div className="mt-3 grid gap-3" aria-hidden="true">{[0, 1].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-card" />)}</div>;
  if (data.state !== 'ready') {
    return (
      <div className="mt-3 rounded-3xl bg-card p-4 text-sm ring-1 ring-line">
        <p className="font-bold">Questions are almost ready.</p>
        <p className="mt-1 text-muted">The database needs one more update before players can ask here.</p>
      </div>
    );
  }

  return (
    <>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Open questions · {open.length} · oldest first</p>
      {open.length ? (
        <ul className="mt-2 grid gap-3">
          {open.map((q) => (
            <QuestionCard key={q.id} q={q} pageTitle={page ? undefined : titleOf(q.pageKey)} blocks={blocks} drafts={drafts} data={data} me={me} mod={mod} reported={Boolean(reported?.has(q.id))} focused={focus === q.id}
              others={open.filter((o) => o.id !== q.id)} onAnswer={onAnswer} onOpenDraft={onOpenDraft} />
          ))}
        </ul>
      ) : (
        <div className="mt-2 rounded-3xl bg-card p-4 text-sm ring-1 ring-line">
          <p className="font-bold">No open questions{page ? ` about ${page.title}` : ''}.</p>
          <p className="mt-1 text-muted">When a player asks something the app doesn&apos;t answer yet, it waits here for someone who knows.</p>
        </div>
      )}

      {answered.length > 0 && (
        <div className="mt-5">
          <button type="button" onClick={() => setShowAnswered(!showAnswered)} aria-expanded={showAnswered} className="text-xs font-bold uppercase tracking-wide text-muted hover:text-ink">
            Answered lately · {answered.length} {showAnswered ? '▴' : '▾'}
          </button>
          {showAnswered && (
            <ul className="mt-2 grid gap-2">
              {answered.map((q) => (
                <li key={q.id} className="rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-line">
                  <p className="font-bold">{q.body}</p>
                  <p className="mt-0.5"><Check size={13} className="mr-1 inline text-leaf" aria-hidden="true" />{q.reply}</p>
                  {mod && (
                    <div className="mt-1.5">
                      <SmallButton disabled={act.busy} onClick={() => act.run(() => data.reopen(q.id))} icon={<RotateCcw size={13} aria-hidden="true" />}>Reopen: the answer missed</SmallButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {act.error && <p role="alert" className="mt-2 rounded-xl bg-berry-soft px-3 py-1.5 text-sm text-berry">{act.error}</p>}
    </>
  );
}

