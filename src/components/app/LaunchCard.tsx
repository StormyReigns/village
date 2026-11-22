'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Rocket, Trash2 } from 'lucide-react';
import { Piece, GLITCH } from '@/components/Piece';
import { useVillager } from '@/components/useVillager';
import { browserClient } from '@/lib/supabase/browser';
import { gameLaunchCheck } from '@/app/actions';

/** How many "I'd use this" votes launch a game (game_votes_launch in 20261203000000_game_launch.sql). */
export const LAUNCH_VOTES = 5;

/**
 * A game a Builder started, before it launches (docs/games.md, slice 3): how many players have said they'd use
 * it, and the vote. Five launch it onto the front page. Its starter can't vote for it; Village moderators can
 * launch it now or take it down. Five pieces show the votes: solid for each one in, split outlines for the rest.
 */
export function LaunchCard({ gameId, shortTitle, createdBy }: { gameId: string; shortTitle: string; createdBy?: string }) {
  const router = useRouter();
  const me = useVillager();
  const [count, setCount] = useState<number | null>(null);
  const [mine, setMine] = useState(false);
  const [villageMod, setVillageMod] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<'launched' | 'down' | null>(null);
  const starter = Boolean(me && createdBy && me.id === createdBy);

  const load = useCallback(async () => {
    const db = browserClient();
    if (!db) return;
    const [all, own, mod] = await Promise.all([
      db.from('game_votes').select('voter_id', { count: 'exact', head: true }).eq('game_id', gameId),
      me ? db.from('game_votes').select('voter_id').eq('game_id', gameId).eq('voter_id', me.id).maybeSingle() : Promise.resolve({ data: null }),
      me ? db.rpc('is_village_moderator') : Promise.resolve({ data: false }),
    ]);
    // Before the launch SQL is run there's no votes table: the card says what it can and offers no vote.
    if ('error' in all && all.error) { setCount(null); return; }
    setCount(all.count ?? 0);
    setMine(Boolean(own.data));
    setVillageMod(Boolean(mod.data));
  }, [gameId, me]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the votes from the database once signed-in state is known
  useEffect(() => { void load(); }, [load]);

  const launched = async (what: 'launched' | 'down') => {
    await gameLaunchCheck(gameId);
    setDone(what);
    router.refresh();
  };

  const vote = async () => {
    const db = browserClient();
    if (!db || !me) return;
    setBusy(true);
    setNote('');
    const { error } = mine
      ? await db.from('game_votes').delete().eq('game_id', gameId).eq('voter_id', me.id)
      : await db.from('game_votes').insert({ game_id: gameId });
    setBusy(false);
    if (error) { setNote(error.message); return; }
    const next = (count ?? 0) + (mine ? -1 : 1);
    setMine(!mine);
    setCount(next);
    if (!mine && next >= LAUNCH_VOTES) await launched('launched');
  };

  const moderate = async (what: 'launch' | 'down') => {
    if (what === 'down' && !window.confirm(`Take ${shortTitle} down? Players won't see it any more. Use this for spam, duplicates, or games we shouldn't host.`)) return;
    const db = browserClient();
    if (!db) return;
    setBusy(true);
    const { error } = what === 'launch' ? await db.rpc('launch_game', { gid: gameId }) : await db.rpc('take_down_game', { gid: gameId });
    setBusy(false);
    if (error) { setNote(error.message); return; }
    await launched(what === 'launch' ? 'launched' : 'down');
  };

  if (done) {
    return (
      <div role="status" className="rounded-2xl bg-card p-4 ring-1 ring-line md:col-span-2">
        <p className="font-bold">{done === 'launched' ? `${shortTitle} has launched. It's on the front page now.` : `${shortTitle} was taken down.`}</p>
      </div>
    );
  }

  const n = count ?? 0;
  return (
    <section aria-label={`Launching ${shortTitle}`} className="rounded-2xl bg-card p-4 ring-1 ring-line md:col-span-2">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GLITCH.violet }}>Not launched yet</p>
          <p className="font-display text-xl leading-tight">
            {count === null ? `${shortTitle} launches when ${LAUNCH_VOTES} players say they'd use it` : `${n} of ${LAUNCH_VOTES} players would use ${shortTitle}`}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {starter ? 'You started it. Share its link: once five players say they’d use it, it joins the front page.'
              : 'Once five players say they’d use it, it joins the front page. Until then, only people with its link find it.'}
          </p>
        </div>
        {/* The votes as five pieces, never touching: solid for each one in, the split outline for the rest. */}
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: LAUNCH_VOTES }, (_, i) => <Piece key={i} size={28} color="var(--leaf)" outline={i >= n} />)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {count !== null && !starter && (me ? (
          <button type="button" onClick={vote} disabled={busy} aria-pressed={mine}
            className={'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60 ' + (mine ? 'bg-card ring-1 ring-line hover:ring-ink' : 'btn-primary')}>
            {mine ? <><Check size={15} aria-hidden="true" /> You&apos;d use it · Take it back</> : 'I’d use this'}
          </button>
        ) : me === null ? (
          <Link href={`/signin?next=${encodeURIComponent(`/g/${gameId}`)}`} className="btn-primary rounded-full px-4 py-2 text-sm font-bold">Sign in to vote</Link>
        ) : null)}
        <Link href={`/g/${gameId}/workshop`} className="rounded-full bg-card px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">Help build it</Link>
        {villageMod && count !== null && (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => moderate('launch')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-leaf disabled:opacity-60">
              <Rocket size={14} aria-hidden="true" /> Launch now
            </button>
            <button type="button" onClick={() => moderate('down')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold text-berry ring-1 ring-line hover:ring-berry disabled:opacity-60">
              <Trash2 size={14} aria-hidden="true" /> Take it down
            </button>
          </span>
        )}
      </div>
      {note && <p role="status" className="mt-2 text-sm font-bold text-berry">{note}</p>}
    </section>
  );
}
