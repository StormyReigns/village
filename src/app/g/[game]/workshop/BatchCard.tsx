'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ShieldCheck, Sheet, TriangleAlert, Undo2, X } from 'lucide-react';
import type { Villager } from '@/components/useVillager';
import { SignInPrompt } from '@/components/SignInPrompt';
import { Tip } from '@/components/Tip';
import { Avatar } from '@/components/Avatar';
import { EntryDetails, EntryIcon, type RouteOption } from '@/components/app/EntryPanel';
import type { Entry } from '@/data/pages';
import type { Placed } from './chat/Chat';
import { ago, SmallButton, useAction } from './chat/bits';
import { ChangeList } from './EntryForm';
import { changesBetween } from './changes';
import type { Batch, BatchData, BatchRow } from './useBatches';

// A batch in Drafts (docs/blocks/spreadsheets.md, level 2): rows pasted from a sheet, shown as one
// card. Voters vote once for the whole batch and can set a single row aside; moderators publish it
// in one go or decline it with a reason.

const STATUS: Record<Batch['status'], string> = { open: 'open for votes', stable: 'published', declined: 'declined', removed: 'taken back' };

export function BatchCard({ batch, place, routes, me, mod, data, startOpen = false }: {
  batch: Batch; place?: Placed; routes: RouteOption[]; me: Villager | null | undefined; mod: boolean; data: BatchData; startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [rows, setRows] = useState<BatchRow[] | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // The rows load when the card opens, and again after anything changes them.
  const reload = async () => setRows(await data.loadRows(batch.id));
  useEffect(() => {
    if (!open || rows) return;
    let gone = false;
    data.loadRows(batch.id).then((r) => { if (!gone) setRows(r); });
    return () => { gone = true; };
  }, [open, rows, data, batch.id]);

  if (!place) return null;
  const block = place;
  const color = `var(--${block.page.tint})`;
  const mine = me?.id === batch.author.id && !me?.practice;
  const isOpen = batch.status === 'open';
  const total = batch.ups + batch.downs;
  const leaning = total === 0 ? 'no votes yet' : batch.ups >= batch.downs ? 'leaning yes' : 'leaning no';
  const needsVote = Boolean(me && !mine && !batch.myVote && isOpen);
  const cast = async (v: 0 | 1 | -1) => setError((await data.vote(batch.id, v)) ?? '');
  const live = rows?.filter((r) => r.status !== 'removed') ?? [];
  const counts = rows ? { fresh: live.filter((r) => !r.cardId).length, fixed: live.filter((r) => r.cardId).length } : null;

  return (
    <li className={'rise rounded-3xl bg-card p-3 ' + (needsVote ? 'ring-1 ring-ink/40 ' : 'ring-1 ring-line ') + (batch.status === 'removed' ? 'opacity-60' : '')}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        {/* A batch isn't an entry, so no piece: a sheet mark on the Page's color. */}
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl text-paper" style={{ background: color }}><Sheet size={20} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg leading-tight">{batch.title}</span>
            <Tip text="Rows pasted from a spreadsheet, reviewed together" tint="plum"><span className="rounded-full bg-plum-soft px-2 py-0.5 text-xs font-bold text-plum">batch</span></Tip>
            {needsVote && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-ink ring-1 ring-ink">Needs your vote</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Avatar name={batch.author.name} url={batch.author.avatarUrl} size={18} />
            {block.page.title === block.title ? block.title : `${block.page.title} · ${block.title}`} · {batch.author.name} · {ago(batch.createdAt)} · {STATUS[batch.status]}
          </span>
          <span className="mt-0.5 block text-sm"><span className="font-bold">From:</span> {batch.source}</span>
        </span>
        <ChevronDown size={16} className={'mt-1 shrink-0 text-muted transition ' + (open ? 'rotate-180' : '')} aria-hidden="true" />
      </button>
      {batch.status === 'declined' && batch.declineReason && (
        <p className="mt-2 rounded-2xl bg-card-2 px-3 py-2 text-sm ring-1 ring-line"><span className="font-bold">Declined:</span> {batch.declineReason}</p>
      )}

      {open && (
        <div className="mt-3 grid gap-2">
          {!rows ? <div className="h-16 animate-pulse rounded-2xl bg-card-2" aria-hidden="true" /> : (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                {counts!.fresh} new · {counts!.fixed} fixed{isOpen ? ' · spot-check the ones you know' : ''}
              </p>
              <ul className="grid gap-1.5">
                {live.map((r) => <BatchRowLine key={r.id} row={r} block={block} routes={routes} color={color} canSetAside={Boolean(me) && isOpen} data={data} onChanged={reload} />)}
              </ul>
              {live.length === 0 && <p className="text-sm text-muted">No rows left in this batch.</p>}
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {me === null ? <SignInPrompt>Sign in to vote</SignInPrompt> : !me ? null : mine ? (
          <>
            <span className="text-sm text-muted">Your batch · {total >= 5 ? `${batch.ups} yes · ${batch.downs} no` : leaning}</span>
            {isOpen && (
              <Tip text="Takes the whole batch back. Nothing in it reaches the app">
                <button onClick={async () => { if (window.confirm('Take this batch back? Its rows won’t reach the app.')) setError((await data.withdraw(batch.id)) ?? ''); }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:bg-card-2 hover:text-berry">
                  <Undo2 size={14} aria-hidden="true" /> Take it back
                </button>
              </Tip>
            )}
          </>
        ) : isOpen ? (
          <>
            <Tip text="You've spot-checked rows you know, and they're right" tint="leaf"><Vote on={batch.myVote === 1} onClick={() => cast(batch.myVote === 1 ? 0 : 1)} icon={<Check size={15} aria-hidden="true" />}>I can confirm</Vote></Tip>
            <Tip text="Rows here don't match your game. Set the wrong ones aside, or say why in the chat" tint="berry"><Vote on={batch.myVote === -1} onClick={() => cast(batch.myVote === -1 ? 0 : -1)} icon={<TriangleAlert size={15} aria-hidden="true" />}>Seems wrong</Vote></Tip>
            <span className="text-sm text-muted">{total >= 5 ? `${batch.ups} yes · ${batch.downs} no` : leaning}</span>
          </>
        ) : null}
      </div>
      {error && <p role="status" className="mt-2 text-sm text-berry">{error}</p>}
      {done && <p role="status" className="mt-2 text-sm text-leaf">{done}</p>}
      {mod && isOpen && <BatchModTools batch={batch} data={data} onDone={(m) => { setDone(m); setRows(null); }} />}
    </li>
  );
}

function BatchRowLine({ row, block, routes, color, canSetAside, data, onChanged }: {
  row: BatchRow; block: Placed; routes: RouteOption[]; color: string; canSetAside: boolean; data: BatchData; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState('');
  const { run, busy, error } = useAction();
  const changes = row.cardId ? changesBetween(row.before, row.content, block, routes) : [];
  const aside = () => run(() => data.setAside(row.id, why)).then((ok) => { if (ok) { setAsking(false); onChanged(); } });
  return (
    <li className="rounded-2xl bg-card-2 ring-1 ring-line">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <EntryIcon entry={{ ...row.content, id: row.id } as Entry} block={block} size="sm" color={color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{row.content.name}</span>
          <span className="block truncate text-xs text-muted">{row.cardId ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'New entry'}{row.status === 'stable' ? ' · published' : row.status === 'declined' ? ' · declined' : ''}</span>
        </span>
        <span className={'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ' + (row.cardId ? 'bg-sky-soft text-sky' : 'bg-leaf-soft text-leaf')}>{row.cardId ? 'fix' : 'new'}</span>
      </button>
      {open && (
        <div className="grid gap-2 border-t border-line px-3 pb-3 pt-2">
          {row.cardId ? (changes.length ? <ChangeList changes={changes} /> : <p className="text-sm text-muted">No changes.</p>)
            : <div className="rounded-2xl bg-card p-3 ring-1 ring-line"><EntryDetails entry={row.content} block={block} route="all" routes={routes} color={color} /></div>}
          {canSetAside && row.status === 'open' && (asking ? (
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void aside(); }}>
              <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} autoFocus placeholder="What's off? The sender and moderators see this."
                className="min-w-0 flex-1 rounded-full bg-card px-3 py-1.5 text-sm ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky" />
              <button disabled={busy || why.trim().length < 3} className="rounded-full bg-ink px-3 py-1.5 text-sm font-bold text-paper disabled:opacity-50">Set aside</button>
            </form>
          ) : (
            <Tip text="Takes this row out of the batch as a Draft of its own, to be settled by itself" tint="berry" className="justify-self-start">
              <button onClick={() => setAsking(true)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-muted hover:text-berry">
                <X size={13} aria-hidden="true" /> This row’s off
              </button>
            </Tip>
          ))}
          {error && <p role="status" className="text-sm text-berry">{error}</p>}
        </div>
      )}
    </li>
  );
}

function BatchModTools({ batch, data, onDone }: { batch: Batch; data: BatchData; onDone: (message: string) => void }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const { run, busy, error } = useAction();
  const publish = () => run(async () => {
    const r = await data.ship(batch.id);
    if (r.error) return r.error;
    onDone(`Published ${r.shipped}.${r.aside ? ` ${r.aside} set aside as Drafts of their own: their entries changed since, or they couldn’t be published.` : ''}`);
    return null;
  });
  const decline = () => run(() => data.decline(batch.id, reason));
  return (
    <div className="mt-3 rounded-2xl bg-sun-soft/60 p-2.5 ring-1 ring-sun/30">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-sun"><ShieldCheck size={14} aria-hidden="true" /> Moderator</span>
        <Tip text="Puts every row in the app now. A row whose entry changed since it was sent is set aside instead, so newer fixes are never overwritten" tint="leaf">
          <SmallButton tone="good" disabled={busy} onClick={publish} icon={<Check size={13} aria-hidden="true" />}>{busy ? 'Publishing…' : 'Publish the batch'}</SmallButton>
        </Tip>
        <Tip text="Say no to the whole batch, with a reason the sender gets"><SmallButton disabled={busy} onClick={() => setDeclining(!declining)} icon={<X size={13} aria-hidden="true" />}>Decline</SmallButton></Tip>
      </div>
      {declining && (
        <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void decline(); }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus placeholder="Why? The sender and everyone will see this."
            className="min-w-0 flex-1 rounded-full bg-card px-3 py-1.5 text-sm ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky" />
          <button disabled={busy || reason.trim().length < 3} className="rounded-full bg-ink px-3 py-1.5 text-sm font-bold text-paper disabled:opacity-50">Decline</button>
        </form>
      )}
      {error && <p role="status" className="mt-1.5 text-sm text-berry">{error}</p>}
    </div>
  );
}

function Vote({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (on ? 'bg-leaf text-paper ring-leaf' : 'bg-card ring-line hover:ring-leaf')}>
      {icon}{children}
    </button>
  );
}
