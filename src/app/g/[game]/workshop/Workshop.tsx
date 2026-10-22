'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, EyeOff, ExternalLink, Flag, MessageCircle, MoreHorizontal, Plus, RotateCcw, Send,
  ShieldCheck, Sparkles, Trash2, TriangleAlert, X,
} from 'lucide-react';
import type { Block, Page } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { EntryDetails, type RouteOption } from '@/components/app/EntryPanel';
import { SignInPrompt } from '@/components/SignInPrompt';
import { MarketDay } from '@/components/Countdown';
import { AccountButton } from '@/components/AccountButton';
import { Avatar } from '@/components/Avatar';
import { useVillager, type Villager } from '@/components/useVillager';
import { sortStandouts } from '@/lib/standouts';
import {
  REASONS, targetKey, useWorkshop,
  type ChatMessage, type LiveDraft, type ReportGroup, type ReportReason, type Target, type WorkshopData,
} from './useWorkshop';
import { EntryForm, ChangeList, type FormStart } from './EntryForm';
import { changesBetween } from './changes';

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
    if (fix && placeOf(fix[0])) return { blockId: fix[0], entryId: fix[1] };
    const add = params.get('add');
    if (add && placeOf(add)) return { blockId: add };
    return null;
  })();
  const startPage = params.get('page') ?? (linked ? placeOf(linked.blockId)?.page.id : null);
  const [chip, setChip] = useState<string>(startPage && pages.some((p) => p.id === startPage) ? startPage : 'all');
  const [sort, setSort] = useState<Sort>('standouts');
  const [form, setForm] = useState<FormStart | null>(linked);
  const me = useVillager();
  const live = useWorkshop(game.id, me);

  const closeForm = () => {
    setForm(null);
    // Drop ?fix= and ?add= so a refresh doesn't reopen the form.
    const url = new URL(window.location.href);
    url.searchParams.delete('fix');
    url.searchParams.delete('add');
    window.history.replaceState(window.history.state, '', url);
  };

  const drafts = live.drafts;
  const pageOf = useMemo(() => new Map(blocks.map((b) => [b.id, b.page.id])), [blocks]);
  const counts = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, drafts.filter((d) => pageOf.get(d.blockKey) === p.id).length])), [pages, drafts, pageOf]);
  const visible = useMemo(() => {
    const list = drafts.filter((d) => chip === 'all' || pageOf.get(d.blockKey) === chip);
    if (sort === 'new') return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'needs') return list.filter((d) => d.status === 'open').sort((a, b) => a.viewers - b.viewers);
    if (sort === 'shipped') return list.filter((d) => d.status === 'stable');
    return sortStandouts(list.filter((d) => d.status === 'open' || d.status === 'checking'));
  }, [drafts, chip, sort, pageOf]);
  const current = pages.find((p) => p.id === chip);
  const chat = useMemo(() => (current ? live.messages.filter((m) => m.blockKey === current.id) : live.messages), [live.messages, current]);
  const startNew = () => setForm({ blockId: current?.blocks[0]?.id ?? blocks[0]?.id });

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

      {/* Page chips */}
      <nav aria-label="Pages" className="chip-strip -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={chip === 'all'} onClick={() => setChip('all')} count={drafts.length}>All</Chip>
        {pages.map((p) => (
          <Chip key={p.id} active={chip === p.id} onClick={() => setChip(p.id)} count={counts[p.id]} icon={p.icon}>{p.title}</Chip>
        ))}
        <Chip active={chip === 'notice'} onClick={() => setChip('notice')} count={live.mod ? live.reports.length : 0} icon="Flag">Notice Board</Chip>
      </nav>

      {live.state === 'offline' && (
        <p role="status" className="mt-3 rounded-2xl bg-berry-soft px-4 py-3 text-sm text-berry">Couldn&apos;t reach the village just now. Refresh the page to try again.</p>
      )}

      <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Chat
          topic={current ? { key: current.id, label: current.title } : null}
          notice={chip === 'notice'}
          onAll={() => setChip('all')}
          messages={chat}
          me={me}
          live={live}
        />

        {/* Drafts panel */}
        <section aria-label="Drafts" className="flex min-h-[28rem] flex-col rounded-[1.75rem] bg-card p-4 shadow-soft ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl">{chip === 'notice' ? 'Notice Board' : 'Drafts'}</h2>
            <label className={'ml-auto' + (chip === 'notice' ? ' hidden' : '')}>
              <span className="sr-only">Sort Drafts</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full bg-card-2 px-3 py-1.5 text-sm font-bold ring-1 ring-line">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <button onClick={startNew} className="inline-flex items-center gap-1 rounded-full bg-leaf px-3 py-1.5 text-sm font-bold text-paper hover:opacity-90">
              <Plus size={16} aria-hidden="true" /> New
            </button>
          </div>

          {chip === 'notice' ? (
            live.mod ? <ReportQueue live={live} blocks={blocks} /> : (
              <Empty title="No reports waiting" body="When players tap “not quite” in the app without signing in, their report waits here until a villager confirms it." />
            )
          ) : live.state === 'loading' ? (
            <div className="mt-3 grid gap-3" aria-hidden="true">
              {[0, 1].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-card-2" />)}
            </div>
          ) : visible.length === 0 ? (
            <Empty
              title={sort === 'shipped' ? 'Nothing published yet' : `No Drafts${current ? ' for ' + current.title : ''} yet`}
              body={sort === 'shipped' ? 'Drafts land here once a moderator publishes them to the app.' : 'Spotted something missing or wrong? Start one here, or tap "Suggest a fix" on anything in the app.'}
              action={<button onClick={startNew} className="rounded-full bg-leaf px-4 py-2 font-bold text-paper">Start a Draft</button>}
            />
          ) : (
            <ul className="mt-3 grid gap-3">
              {visible.map((d) => (
                <DraftCard key={d.id} draft={d} place={placeOf(d.blockKey)} routes={routes} me={me}
                  messages={live.messages.filter((m) => m.draftId === d.id)} live={live} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {form && blocks.length > 0 && (
        <EntryForm pages={pages} routes={routes} start={form} me={me} postDraft={live.postDraft}
          onClose={closeForm} onPosted={(pageId) => { closeForm(); setChip(pageId); setSort('new'); }} />
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
            <SmallButton tone="good" disabled={busy} onClick={publish} icon={<Check size={13} aria-hidden="true" />}>{busy ? 'Publishing…' : 'Approve and publish'}</SmallButton>
            <SmallButton disabled={busy} onClick={() => setDeclining(!declining)} icon={<X size={13} aria-hidden="true" />}>Decline</SmallButton>
            <SmallButton tone="bad" disabled={busy} onClick={() => decide('removed')} icon={<Trash2 size={13} aria-hidden="true" />}>Remove</SmallButton>
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

function DraftCard({ draft, place, routes, me, messages, live }: {
  draft: LiveDraft; place?: Placed; routes: RouteOption[]; me: Villager | null | undefined; messages: ChatMessage[]; live: WorkshopData;
}) {
  const [open, setOpen] = useState(false);
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
    <li className={'rise rounded-3xl bg-card-2 p-3 ring-1 ring-line ' + (draft.status === 'removed' ? 'opacity-60' : '')}>
      <button onClick={expand} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf"><BlockIcon name={block.icon} size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg leading-tight">{draft.title}</span>
            {draft.cardId ? <span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs font-bold text-sky">fix</span> : <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-bold text-leaf">new</span>}
            {draft.theory && <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold text-sun">Theory</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Avatar name={draft.author.name} url={draft.author.avatarUrl} size={18} />
            {block.page.title} · {block.title} · {draft.author.name} · {ago(draft.createdAt)} · {STATUS[draft.status] ?? draft.status}
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
            : <button onClick={() => setReporting(!reporting)} aria-expanded={reporting} title="Report this Draft"
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-card hover:text-berry">
                <Flag size={15} aria-hidden="true" /><span className="sr-only">Report</span>
              </button>)}
          <button onClick={() => setDiscuss(!discuss)} aria-expanded={discuss} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:bg-card hover:text-ink">
            <MessageCircle size={15} aria-hidden="true" /> Discuss · {messages.filter((m) => !m.removed).length}
          </button>
        </span>
      </div>
      {practiceVote && <p className="mt-2 text-xs text-muted">Your own Draft: votes here are practice, and only you see them.</p>}
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
    <section aria-label="Chat" className="flex min-h-[28rem] flex-col rounded-[1.75rem] bg-card p-4 shadow-soft ring-1 ring-line lg:max-h-[calc(100vh-11rem)]">
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
          <span className="font-bold">Draft:</span> {r.draft.title}{block && <span className="text-muted"> · {block.page.title} · {block.title}</span>}
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
