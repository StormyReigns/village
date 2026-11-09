'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flag, Users } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { useVillager } from '@/components/useVillager';
import { INVITE_REASONS } from '@/lib/communities';
import { CommunityRow } from './Communities';
import { useCommunities, type Community } from './useCommunities';

// Moderators' part of the Notice Board for Communities (docs/blocks/discord.md): listings waiting
// for approval, shown exactly as players will see them, with Approve or Decline (with a reason
// that goes to the lister's inbox); and reported listings, with Take it down or Dismiss.
// Shows nothing when there's nothing to do, or before the SQL is run.

const REASON: Record<string, string> = { wrong: 'Dead link or not about this game', spam: 'Spam or an advert', rude: 'Rude or unsafe', other: 'Something else', spoiler: 'Spoiler' };

interface Reported { communityId: string; reasons: string[]; count: number }

export function CommunityQueue({ gameId }: { gameId: string }) {
  const me = useVillager();
  const data = useCommunities(gameId, me?.id ?? null);
  const [reported, setReported] = useState<Reported[]>([]);

  const loadReports = useCallback(async () => {
    const db = browserClient();
    if (!db) return;
    const { data: rows, error } = await db.from('flags').select('community_id, reason').eq('game_id', gameId).eq('status', 'open').not('community_id', 'is', null);
    if (error) return;
    const by = new Map<string, Reported>();
    for (const r of (rows ?? []) as { community_id: string; reason: string }[]) {
      const g = by.get(r.community_id) ?? { communityId: r.community_id, reasons: [], count: 0 };
      g.count += 1;
      if (!g.reasons.includes(r.reason)) g.reasons.push(r.reason);
      by.set(r.community_id, g);
    }
    setReported([...by.values()]);
  }, [gameId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the database
  useEffect(() => { loadReports(); }, [loadReports]);

  async function dismiss(id: string) {
    const db = browserClient();
    if (!db || !me) return;
    await db.from('flags').update({ status: 'dismissed', handled_by: me.id, handled_at: new Date().toISOString() }).eq('community_id', id).eq('status', 'open');
    loadReports();
  }

  if (!data.ready || data.missing) return null;
  const waiting = data.all.filter((c) => c.status === 'waiting');
  const flagged = reported.map((r) => ({ r, c: data.all.find((c) => c.id === r.communityId && c.status === 'live') })).filter((x): x is { r: Reported; c: Community } => Boolean(x.c));
  if (!waiting.length && !flagged.length) return null;

  return (
    <section aria-label="Communities to check" className="surface mt-3 rounded-2xl p-4">
      <h3 className="flex items-center gap-2 font-bold"><Users size={16} className="text-muted" aria-hidden="true" /> Communities</h3>
      <ul className="mt-3 grid gap-4">
        {waiting.map((c) => <li key={c.id}><Waiting c={c} data={data} /></li>)}
        {flagged.map(({ r, c }) => (
          <li key={c.id} className="rounded-2xl bg-card-2 p-3 ring-1 ring-line">
            <p className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <span className="inline-flex items-center gap-1 rounded-full bg-berry-soft px-2 py-0.5 text-berry"><Flag size={12} aria-hidden="true" /> {r.count} {r.count === 1 ? 'report' : 'reports'}</span>
              {r.reasons.map((x) => <span key={x} className="rounded-full bg-card px-2 py-0.5 ring-1 ring-line">{REASON[x] ?? x}</span>)}
            </p>
            <CommunityRow c={c} look={data.lookFor(c)} />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={async () => { await data.remove(c.id); loadReports(); }} className="rounded-full bg-berry px-3 py-1.5 text-sm font-bold text-white">Take it down</button>
              <button type="button" onClick={() => dismiss(c.id)} className="btn-quiet rounded-full px-3 py-1.5 text-sm font-bold">Dismiss</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Waiting({ c, data }: { c: Community; data: ReturnType<typeof useCommunities> }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const look = data.lookFor(c);
  const bad = look && typeof look === 'object' && !look.ok ? INVITE_REASONS[look.reason] : look === 'unreachable' ? 'Couldn’t reach Discord to check this invite.' : null;
  return (
    <div className="rounded-2xl bg-card-2 p-3 ring-1 ring-line">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Waiting for approval · {c.kind === 'discord' ? 'Discord server' : 'Link'}</p>
      <CommunityRow c={c} look={look} />
      {bad && <p className="mt-2 text-sm font-bold text-berry">{bad}</p>}
      {declining ? (
        <form className="mt-2 grid gap-2" onSubmit={async (e) => { e.preventDefault(); setError((await data.decide(c.id, false, reason)) ?? ''); }}>
          <label className="text-sm font-bold" htmlFor={`why-${c.id}`}>Why not? They’ll read this in their inbox.</label>
          <input id={`why-${c.id}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Not about this game"
            className="rounded-xl bg-card px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-signal" />
          <div className="flex gap-2">
            <button type="submit" disabled={reason.trim().length < 3} className="rounded-full bg-berry px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Decline</button>
            <button type="button" onClick={() => setDeclining(false)} className="btn-quiet rounded-full px-3 py-1.5 text-sm font-bold">Back</button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={Boolean(bad)} onClick={async () => setError((await data.decide(c.id, true)) ?? '')} className="btn-primary rounded-full px-3 py-1.5 text-sm font-bold disabled:opacity-50">Approve</button>
          <button type="button" onClick={() => setDeclining(true)} className="btn-quiet rounded-full px-3 py-1.5 text-sm font-bold">Decline</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-bold text-berry">{error}</p>}
    </div>
  );
}
