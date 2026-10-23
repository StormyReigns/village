'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

/** "5m ago", "2h ago", "3d ago". */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${Math.max(1, mins)}m ago` : mins < 1440 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)}d ago`;
}

/** "3 open Drafts · 2 villagers this month · active 2h ago": signs of life on a game card. */
export function GameActivity({ gameId }: { gameId: string }) {
  const [info, setInfo] = useState<{ open: number; people: number; last: string | null } | null>(null);

  useEffect(() => {
    const db = browserClient();
    if (!db) return;
    let cancelled = false;
    const month = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      db.from('drafts').select('id', { count: 'exact', head: true }).eq('game_id', gameId).in('status', ['open', 'checking']),
      db.from('drafts').select('author_id, created_at').eq('game_id', gameId).gte('created_at', month).limit(500),
      db.from('chat_messages').select('author_id, created_at').eq('game_id', gameId).gte('created_at', month).order('created_at', { ascending: false }).limit(500),
    ]).then(([open, d, c]) => {
      if (cancelled) return;
      const rows = [...(d.data ?? []), ...(c.data ?? [])] as { author_id: string; created_at: string }[];
      const last = rows.map((r) => r.created_at).sort().at(-1) ?? null;
      setInfo({ open: open.count ?? 0, people: new Set(rows.map((r) => r.author_id)).size, last: last && ago(last) });
    });
    return () => { cancelled = true; };
  }, [gameId]);

  if (!info) return <p className="mt-2 h-5 text-sm text-muted" aria-hidden="true" />;
  if (!info.people && !info.open) return <p className="mt-2 text-sm text-muted">Quiet so far. Be the first to help build it.</p>;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
      <span className="size-2 rounded-full bg-leaf" aria-hidden="true" />
      {info.open > 0 && <span>{info.open} open Draft{info.open === 1 ? '' : 's'} ·</span>}
      <span>{info.people} villager{info.people === 1 ? '' : 's'} this month</span>
      {info.last && <span>· active {info.last}</span>}
    </p>
  );
}
