'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CircleHelp, EyeOff, Flag, Inbox, X } from 'lucide-react';
import type { Page, Tint } from '@/data/pages';
import { useVillager } from '@/components/useVillager';
import { TINT } from '@/components/app/tint';
import { rank } from '@/lib/search';
import { answerHref, oldestFirst, openFor, openOn, similarQuestions, waitingOn, wantCount } from '@/lib/questions';
import { readUnsentQuestion, saveUnsentQuestion, useQuestions, type LiveQuestion, type QuestionsData, type UnsentQuestion } from './useQuestions';

// Questions in the game app (docs/blocks/questions.md): the slim bar under every Page's title,
// the Page's questions in a sheet, the Ask sheet, and every open question on the Guides Page.

/** A Page as the questions need it: where to file one, and its color. */
export interface QPage { id: string; title: string; short: string; tint: Tint }
/** An entry in the app, for "Maybe it's already here". */
export interface QLink { name: string; href: string }

/** "Sign in" that keeps what was typed and comes back to the Ask sheet afterwards. */
function SignInToAsk({ gameId, draft, label, pageKey }: { gameId: string; draft: UnsentQuestion; label: string; pageKey: string }) {
  const path = usePathname() || `/g/${gameId}/${pageKey}`;
  // Back to the Page it's about, where its bar reopens the sheet with the words kept.
  const back = path.startsWith(`/g/${gameId}/`) && path.split('/').length === 4 ? path : `/g/${gameId}/${pageKey}`;
  const href = `/signin?next=${encodeURIComponent(`${back}?ask=1`)}&for=${encodeURIComponent('post your question')}`;
  return (
    <Link href={href} onClick={() => saveUnsentQuestion(gameId, draft)} className="btn-primary inline-flex rounded-full px-4 py-2 text-sm font-bold">
      {label}
    </Link>
  );
}

/** A sheet over the page: from the bottom on phones, centered on computers. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[2rem] bg-card shadow-soft sm:rounded-[2rem]">
        <div className="flex items-center gap-3 px-5 pb-2 pt-5">
          <h2 className="min-w-0 flex-1 font-display text-2xl leading-tight">{label}</h2>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

/** A spoiler question stays hidden until tapped, like spoiler steps. */
function QuestionText({ q, className = '' }: { q: LiveQuestion; className?: string }) {
  const [shown, setShown] = useState(false);
  if (q.spoiler && !shown) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setShown(true); }} className={'inline-flex items-center gap-1.5 text-left italic text-muted hover:text-ink ' + className}>
        <EyeOff size={14} aria-hidden="true" /> Spoiler · tap to show
      </button>
    );
  }
  return <span className={className}>{q.body}</span>;
}

const REASONS = [
  { key: 'spam', label: 'Spam' }, { key: 'rude', label: 'Rude or hurtful' },
  { key: 'spoiler', label: 'Unmarked spoiler' }, { key: 'other', label: 'Something else' },
];

/** One question in a list: who wants to know, "me too", and its answer once it has one. */
export function QuestionRow({ q, gameId, data, names, pageTitle }: {
  q: LiveQuestion; gameId: string; data: QuestionsData; names?: Record<string, string>; pageTitle?: string;
}) {
  const me = useVillager();
  const meId = me?.id ?? null;
  const path = usePathname() || `/g/${gameId}`;
  const [note, setNote] = useState('');
  const [reporting, setReporting] = useState(false);
  const mine = Boolean(meId && q.askedBy === meId);
  const waiting = waitingOn(q, meId);
  const n = wantCount(q);
  const href = q.answer ? answerHref(gameId, q.answer) : null;
  const where = q.answerCardId ? names?.[q.answerCardId] : undefined;

  return (
    <li className="rounded-2xl bg-card-2 px-3 py-2.5">
      <p className="font-bold leading-snug"><QuestionText q={q} /></p>
      {q.status === 'answered' ? (
        <p className="mt-1 text-sm">
          <span className="inline-flex items-center gap-1 font-bold text-leaf"><Check size={14} aria-hidden="true" /> Answered</span>{' '}
          {q.reply}
          {href && <> · <Link href={href} className="font-bold underline">see {where ?? 'the answer'}</Link></>}
          {mine && (
            <button type="button" onClick={async () => setNote((await data.reopen(q.id)) ?? 'Opened again. Builders will take another look.')}
              className="ml-2 text-xs font-bold text-muted underline hover:text-ink">That didn&apos;t answer it</button>
          )}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="text-muted">
            {n > 0 ? `${n} ${n === 1 ? 'player wants' : 'players want'} to know` : 'Waiting for an answer'} · open {openFor(q.createdAt)}
            {pageTitle ? ` · ${pageTitle}` : ''}
          </span>
          {mine ? (
            <span className="ml-auto text-xs font-bold text-muted">You asked</span>
          ) : me ? (
            <button type="button" aria-pressed={waiting}
              onClick={async () => { setNote((await data.meToo(q.id, !waiting)) ?? ''); }}
              className={'ml-auto rounded-full px-3 py-1 text-xs font-bold ring-1 ' + (waiting ? 'bg-ink text-paper ring-ink' : 'bg-card ring-line hover:ring-ink')}>
              {waiting ? 'You want to know too' : '+1 me too'}
            </button>
          ) : (
            <Link href={`/signin?next=${encodeURIComponent(path)}&for=${encodeURIComponent('say “me too”')}`}
              className="ml-auto rounded-full bg-card px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">+1 me too</Link>
          )}
          {me && !mine && (
            <button type="button" onClick={() => setReporting(!reporting)} aria-label="Report this question" aria-expanded={reporting}
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
              <Flag size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {reporting && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="w-full font-bold text-muted">What&apos;s wrong with it?</span>
          {REASONS.map((r) => (
            <button key={r.key} type="button" className="rounded-full bg-card px-2.5 py-1 font-bold ring-1 ring-line hover:ring-ink"
              onClick={async () => { const err = await data.report(q.id, r.key); setReporting(false); setNote(err ?? 'Thanks. A moderator will take a look.'); }}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {note && <p role="status" className="mt-1.5 text-xs font-bold text-muted">{note}</p>}
    </li>
  );
}

/** The Ask sheet: one line, which Page, a spoiler tick, and what's already here as they type. */
export function AskSheet({ gameId, pages, startPage, start, links, data, onClose }: {
  gameId: string; pages: QPage[]; startPage: string; start?: UnsentQuestion | null; links: QLink[]; data: QuestionsData; onClose: () => void;
}) {
  const me = useVillager();
  const [body, setBody] = useState(start?.body ?? '');
  const [pageKey, setPageKey] = useState(start?.pageKey && pages.some((p) => p.id === start.pageKey) ? start.pageKey : startPage);
  const [spoiler, setSpoiler] = useState(start?.spoiler ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'asked' | 'me-too' | null>(null);
  const draft = { body, pageKey, spoiler };
  // Kept on this device as they type, so closing by mistake or signing in loses nothing.
  useEffect(() => { saveUnsentQuestion(gameId, draft); }, [gameId, body, pageKey, spoiler]); // eslint-disable-line react-hooks/exhaustive-deps

  const typed = body.trim().length >= 3;
  const entries = typed ? rank(links, body, (l) => ({ name: l.name, text: '' })).slice(0, 3) : [];
  const asked = similarQuestions(data.questions, body);
  const page = pages.find((p) => p.id === pageKey);

  const post = async () => {
    setBusy(true);
    const res = await data.ask({ body, pageKey, spoiler });
    setBusy(false);
    if (res.error) return setError(res.error);
    saveUnsentQuestion(gameId, null);
    setDone('asked');
  };
  const join = async (id: string) => {
    const err = await data.meToo(id, true);
    if (err) return setError(err);
    saveUnsentQuestion(gameId, null);
    setDone('me-too');
  };

  if (done) {
    return (
      <Sheet label={done === 'asked' ? 'Asked' : 'Added your “me too”'} onClose={onClose}>
        <p className="flex items-start gap-2 rounded-2xl bg-leaf-soft px-3 py-2.5 text-sm text-leaf">
          <Inbox size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>When a Builder answers it, the reply lands in your inbox: the bell at the top of the screen.</span>
        </p>
        <button onClick={onClose} className="btn-primary mt-4 rounded-full px-4 py-2 text-sm font-bold">Done</button>
      </Sheet>
    );
  }

  return (
    <Sheet label="Ask the village" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (me && typed && !busy) post(); }} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-bold">Your question</span>
          <input autoFocus value={body} maxLength={300} onChange={(e) => { setBody(e.target.value); setError(''); }}
            placeholder="How does Long join?" aria-invalid={Boolean(error) || undefined}
            className="rounded-2xl bg-card-2 px-4 py-3 text-lg outline-none ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-signal" />
        </label>

        {(entries.length > 0 || asked.length > 0) && (
          <div className="grid gap-1.5 rounded-2xl bg-sun-soft p-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-sun">Maybe it&apos;s already here</p>
            {entries.map((l) => (
              <Link key={l.href} href={l.href} onClick={onClose} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 font-bold ring-1 ring-line hover:ring-ink">
                <span className="min-w-0 flex-1 truncate">{l.name}</span> <ChevronRight size={15} className="text-muted" aria-hidden="true" />
              </Link>
            ))}
            {asked.map((q) => (
              <div key={q.id} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-line">
                <span className="min-w-0 flex-1"><QuestionText q={q} className="font-bold" /> <span className="text-xs text-muted">· asked already</span></span>
                {me ? (
                  waitingOn(q, me.id)
                    ? <span className="text-xs font-bold text-muted">You&apos;re waiting on it</span>
                    : <button type="button" onClick={() => join(q.id)} className="shrink-0 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">Me too</button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-bold">About</span>
            <select value={pageKey} onChange={(e) => setPageKey(e.target.value)} className="rounded-full bg-card-2 px-3 py-1.5 font-bold ring-1 ring-line">
              {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="size-4 accent-[var(--ink)]" />
            It gives away the story
          </label>
        </div>

        {error && <p role="alert" className="rounded-2xl bg-berry-soft px-3 py-2 text-sm text-berry">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          {me ? (
            <button disabled={!typed || busy} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">
              {busy ? 'Posting…' : 'Post question'}
            </button>
          ) : typed ? (
            <SignInToAsk gameId={gameId} draft={draft} pageKey={pageKey} label="Sign in to post" />
          ) : (
            <button type="button" disabled className="btn-primary rounded-full px-4 py-2 text-sm font-bold opacity-50">Sign in to post</button>
          )}
          <span className="text-xs text-muted">
            {me ? `The answer comes to your inbox${page ? `, and it goes into ${page.title} for everyone` : ''}.` : 'Signing in lets the answer reach you. What you typed is kept.'}
          </span>
        </div>
      </form>
    </Sheet>
  );
}

/** The Page's questions in a sheet: open ones oldest first, then recent answers. */
function PageQuestions({ gameId, page, data, names, onAsk, onClose }: {
  gameId: string; page: QPage; data: QuestionsData; names: Record<string, string>; onAsk: () => void; onClose: () => void;
}) {
  const open = openOn(data.questions, page.id);
  const answered = data.questions.filter((q) => q.status === 'answered' && q.pageKey === page.id)
    .sort((a, b) => (b.answeredAt ?? '').localeCompare(a.answeredAt ?? '')).slice(0, 10);
  return (
    <Sheet label={`Questions about ${page.title}`} onClose={onClose}>
      <button onClick={onAsk} className="btn-primary mb-3 rounded-full px-4 py-2 text-sm font-bold">Ask a question</button>
      {open.length > 0 ? (
        <ul className="grid gap-2">{open.map((q) => <QuestionRow key={q.id} q={q} gameId={gameId} data={data} names={names} />)}</ul>
      ) : (
        <p className="text-sm text-muted">No open questions about {page.title} right now.</p>
      )}
      {answered.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-muted">Answered</p>
          <ul className="grid gap-2">{answered.map((q) => <QuestionRow key={q.id} q={q} gameId={gameId} data={data} names={names} />)}</ul>
        </>
      )}
    </Sheet>
  );
}

/** Entry names by their database id, so an answer can say "see Cai". */
function namesOf(pages: Page[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pages) for (const b of p.blocks) for (const e of b.entries) if (e.ref) out[e.ref.card] = e.name;
  return out;
}

const SLIDE_MS = 5000;

/**
 * The slim bar under a Page's title: its open questions one at a time, sliding to the next
 * every few seconds, with a yellow Ask on the right. It holds still while touched, hovered
 * or focused, and always for reduced motion. Shows nothing until the database has questions.
 */
export function QuestionBar(props: { gameId: string; page: Page; pages: QPage[]; links: QLink[] }) {
  const me = useVillager();
  const data = useQuestions(props.gameId, me?.id);
  return <QuestionBarView {...props} data={data} />;
}

/** The bar itself, given the game's questions (the lab page feeds it samples). */
export function QuestionBarView({ gameId, page, pages, links, data }: { gameId: string; page: Page; pages: QPage[]; links: QLink[]; data: QuestionsData }) {
  const open = openOn(data.questions, page.id);
  const names = useMemo(() => namesOf([page]), [page]);
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const [still, setStill] = useState(false);
  const [sheet, setSheet] = useState<'list' | 'ask' | null>(null);
  const [resume, setResume] = useState<UnsentQuestion | null>(null);
  const t = TINT[page.tint];

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the device's motion setting
    setStill(m.matches);
    const on = () => setStill(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (still || held || sheet || open.length < 2) return;
    const id = setInterval(() => setAt((n) => n + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, [still, held, sheet, open.length]);

  // Back from signing in (?ask=1): the Ask sheet opens again with what they typed.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.get('ask')) return;
    url.searchParams.delete('ask');
    window.history.replaceState({}, '', url);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
    setResume(readUnsentQuestion(gameId));
    setSheet('ask');
  }, [gameId]);

  // The bar loads in the browser after the Page is drawn, so its slot is kept from the start
  // and it fades in there: the Blocks never move once someone's reading. Only before the
  // Questions SQL is run (no table yet) does the slot close again.
  if (data.state === 'loading') return <div className="mt-4 h-[46px]" aria-hidden="true" />;
  if (data.state !== 'ready') return null;
  const q = open.length ? open[at % open.length] : null;
  const qp: QPage = { id: page.id, title: page.title, short: page.short, tint: page.tint };
  const step = (by: number) => setAt((n) => (n + by + open.length) % open.length);

  return (
    <>
      <div className="rise relative mt-4 flex h-[46px] items-center gap-1 rounded-full bg-card py-1 pl-1 pr-1 ring-1 ring-line"
        onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}
        onTouchStart={() => setHeld(true)} onTouchEnd={() => setTimeout(() => setHeld(false), 2500)}>
        <button type="button" onClick={() => setSheet('list')} aria-label={q ? `Open questions about ${page.title}` : `Questions about ${page.title}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full py-1.5 pl-2 pr-1 text-left hover:bg-card-2">
          <CircleHelp size={18} className={'shrink-0 ' + t.text} strokeWidth={2.4} aria-hidden="true" />
          {q ? (
            <>
              {/* No live announcement: a screen reader would read every slide. */}
              <span key={q.id} className="rise min-w-0 flex-1 truncate font-bold">
                {q.spoiler ? <span className="italic text-muted">Spoiler · tap to show</span> : q.body}
              </span>
              <span className="shrink-0 text-xs font-bold text-muted">
                <span className="sm:hidden">{(at % open.length) + 1}/{open.length}</span>
                <span className="hidden sm:inline">{(at % open.length) + 1} of {open.length} open about {page.short}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-muted">Got a question about {page.short}?</span>
          )}
        </button>
        {/* Reduced motion: it never slides on its own, so the player steps through instead. */}
        {still && open.length > 1 && (
          <span className="flex shrink-0">
            <button type="button" onClick={() => step(-1)} aria-label="Previous question" className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => step(1)} aria-label="Next question" className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><ChevronRight size={16} aria-hidden="true" /></button>
          </span>
        )}
        <button type="button" onClick={() => { setResume(null); setSheet('ask'); }} className="btn-primary shrink-0 rounded-full px-4 py-1.5 text-sm font-bold">Ask</button>
      </div>
      {sheet === 'list' && <PageQuestions gameId={gameId} page={qp} data={data} names={names} onAsk={() => setSheet('ask')} onClose={() => setSheet(null)} />}
      {sheet === 'ask' && <AskSheet gameId={gameId} pages={pages} startPage={page.id} start={resume ?? readUnsentQuestion(gameId)} links={links} data={data} onClose={() => setSheet(null)} />}
    </>
  );
}

/** Every open question in the game, grouped by Page: on the Guides Page, the place to go and help. */
export function AllQuestions({ gameId, pages, allPages }: { gameId: string; pages: QPage[]; allPages?: Page[] }) {
  const me = useVillager();
  const data = useQuestions(gameId, me?.id);
  const names = useMemo(() => namesOf(allPages ?? []), [allPages]);
  if (data.state !== 'ready') return null;
  const open = oldestFirst(data.questions.filter((q) => q.status === 'open'));
  const groups = [...pages, { id: '', title: 'Other', short: 'Other', tint: 'leaf' as Tint }]
    .map((p) => ({ p, list: open.filter((q) => (p.id ? q.pageKey === p.id : !pages.some((x) => x.id === q.pageKey))) }))
    .filter((g) => g.list.length);
  return (
    <section id="questions" className="surface scroll-mt-24 rounded-2xl p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-xl"><CircleHelp size={18} aria-hidden="true" /> Open questions <span className="text-muted">{open.length}</span></h2>
      <p className="mt-1 text-sm text-muted">What players have asked and nobody has answered yet. Know one? Answer it in the Workshop, and the asker hears back.</p>
      {groups.length ? groups.map(({ p, list }) => (
        <div key={p.id || 'other'} className="mt-4">
          <p className={`text-xs font-bold uppercase tracking-wide ${TINT[p.tint].text}`}>{p.title} · {list.length}</p>
          <ul className="mt-2 grid gap-2">{list.map((q) => <QuestionRow key={q.id} q={q} gameId={gameId} data={data} names={names} />)}</ul>
        </div>
      )) : <p className="mt-3 text-sm text-muted">Every question has an answer right now.</p>}
      <Link href={`/g/${gameId}/workshop?tab=questions`} className="mt-4 inline-flex rounded-full bg-card px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">Answer in the Workshop</Link>
    </section>
  );
}

/** "Ask the village" in a search that found nothing: the Ask sheet, filled in with what they typed. */
export function AskFromSearch({ gameId, pages, links, query }: { gameId: string; pages: QPage[]; links: QLink[]; query: string }) {
  const me = useVillager();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-bold">
        <CircleHelp size={15} aria-hidden="true" /> Ask the village
      </button>
      {open && <AskWith gameId={gameId} meId={me?.id} pages={pages} links={links} start={{ body: query.trim(), pageKey: pages[0]?.id ?? '', spoiler: false }} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The Ask sheet with its own connection, for places without a question bar. */
function AskWith({ gameId, meId, pages, links, start, onClose }: { gameId: string; meId?: string; pages: QPage[]; links: QLink[]; start: UnsentQuestion; onClose: () => void }) {
  const data = useQuestions(gameId, meId);
  return <AskSheet gameId={gameId} pages={pages} startPage={start.pageKey} start={start} links={links} data={data} onClose={onClose} />;
}

/**
 * The app's front page: the oldest open question and how many are waiting, to pull in people
 * who know. `fallback` shows until the database has questions (today's Mysteries card).
 */
export function HelpAnswer({ gameId, pages, listPage, fallback }: { gameId: string; pages: QPage[]; /** The Page listing every open question. */ listPage?: string; fallback: React.ReactNode }) {
  const me = useVillager();
  const data = useQuestions(gameId, me?.id);
  if (data.state !== 'ready') return <>{fallback}</>;
  const open = oldestFirst(data.questions.filter((q) => q.status === 'open'));
  if (!open.length) return null;
  const first = open.find((q) => !q.spoiler) ?? open[0];
  const page = pages.find((p) => p.id === first.pageKey) ?? pages.find((p) => p.id === listPage) ?? pages[0];
  return (
    <Link href={listPage ? `/g/${gameId}/${listPage}#questions` : `/g/${gameId}/workshop?tab=questions`} className="lift flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
      <span className={`grid size-14 shrink-0 place-items-center rounded-full ${page ? TINT[page.tint].soft : 'bg-card-2'}`}>
        <CircleHelp size={22} strokeWidth={2.4} className={page ? TINT[page.tint].text : ''} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide text-muted">Help answer · {open.length} open {open.length === 1 ? 'question' : 'questions'}</span>
        <span className="block font-bold leading-tight">{first.spoiler ? 'Spoiler · tap to show' : first.body}</span>
        <span className="block text-sm text-muted">Know the answer? Answer it in the Workshop, and the asker hears back.</span>
      </span>
      <ChevronRight size={18} className="text-muted" aria-hidden="true" />
    </Link>
  );
}
