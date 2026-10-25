'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CircleHelp, Sparkles, X } from 'lucide-react';
import type { Page } from '@/data/pages';
import { browserClient } from '@/lib/supabase/browser';
import { MarketDay } from '@/components/Countdown';
import { useStored } from '@/components/useStored';

// Reasons to come back to a game's app: questions nobody has answered yet, and what other
// players found lately.

/** Open Mysteries (status Open or Theory), with one example question to pull people in. */
export function HelpSolve({ gameId, pages }: { gameId: string; pages: Page[] }) {
  for (const p of pages) for (const b of p.blocks) {
    const open = b.entries.filter((e) => !e.spoiler && ['Open', 'Theory'].includes(e.categories.Status ?? ''));
    if (!open.length) continue;
    return (
      <Link href={`/g/${gameId}/${p.id}#${b.id}`} className="lift flex items-start gap-3 rounded-2xl bg-plum-soft p-4 ring-1 ring-line">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-plum text-white"><CircleHelp size={19} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-plum">Help solve · {open.length} open {open.length === 1 ? 'mystery' : 'mysteries'}</span>
          <span className="block font-bold leading-tight">{open[0].name}</span>
          <span className="block text-sm text-muted">Know the answer, or have a theory? Say so in the Workshop.</span>
        </span>
      </Link>
    );
  }
  return null;
}

interface Found { id: string; title: string; when: string; who: string }

/** The last few changes that reached the app, who found them, and the next Market Day. */
export function NewInVillage({ gameId }: { gameId: string }) {
  const [found, setFound] = useState<Found[] | null>(null);
  useEffect(() => {
    const db = browserClient();
    if (!db) return;
    let live = true;
    db.from('drafts')
      .select('id, title, decided_at, author:profiles!drafts_author_id_fkey(display_name, username)')
      .eq('game_id', gameId).eq('status', 'stable').order('decided_at', { ascending: false }).limit(3)
      .then(({ data }) => {
        if (!live) return;
        setFound((data ?? []).map((d) => {
          const a = (Array.isArray(d.author) ? d.author[0] : d.author) as { display_name?: string; username?: string } | null;
          return { id: d.id, title: d.title, when: d.decided_at ?? '', who: a?.display_name || a?.username || 'a villager' };
        }));
      });
    return () => { live = false; };
  }, [gameId]);

  return (
    <div className="surface rounded-2xl p-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5"><Sparkles size={13} aria-hidden="true" /> New in the village</span>
        <span className="ml-auto rounded-full bg-sun-soft px-2 py-0.5 normal-case tracking-normal text-sun"><MarketDay /></span>
      </p>
      {found === null ? (
        <p className="mt-2 h-10" aria-hidden="true" />
      ) : found.length ? (
        <ul className="mt-2 grid gap-1 text-sm">
          {found.map((f) => (
            <li key={f.id}><span className="font-bold">{f.title}</span> <span className="text-muted">· found by {f.who}</span></li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Nothing new yet. The first fix you send lands here, with your name on it.{' '}
          <Link href={`/g/${gameId}/workshop`} className="font-bold text-leaf underline">Help build</Link>
        </p>
      )}
    </div>
  );
}

/** For someone who just arrived from a shared link: what this place is. Closes for good. */
export function Welcome({ game }: { game: { id: string; shortTitle: string } }) {
  const [seen, setSeen] = useStored('village:welcome-seen', false);
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- shown only after reading device storage
  useEffect(() => setReady(true), []);
  if (!ready || seen) return null;
  return (
    <p className="mb-3 flex items-center gap-2 rounded-2xl bg-sky-soft px-3 py-2 text-sm">
      <span className="flex-1">
        This is Village, a fan-made {game.shortTitle} app built by players.{' '}
        <Link href={`/g/${game.id}`} className="font-bold text-sky underline">Look around</Link>
      </span>
      <button onClick={() => setSeen(true)} aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-card"><X size={14} aria-hidden="true" /></button>
    </p>
  );
}
