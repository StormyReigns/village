'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/browser';
import { communityText, communityTier, tiersOf, type Counts, type TierSetup } from '@/lib/tiers';

// The "Community tier: A" pill on an entry's card (docs/blocks/tier-lists.md). It finds every Tier
// list Block that ranks the entry (entry_tiers) and shows the first one that has placed it;
// tapping it opens that Block with the piece's sheet. Nothing shows until someone has placed it,
// or before the Tier lists SQL is run.

interface Found { gameId: string; block: string; page: string; title: string; text: string }

type Row = { game_id: string; block_key: string; page_key: string; title: string; tier_setup: TierSetup | null; tier_key: string | null; lists: number };

// One lookup per entry per visit.
const asked = new Map<string, Promise<Found[]>>();

function lookUp(cardId: string): Promise<Found[]> {
  let p = asked.get(cardId);
  if (!p) {
    const db = browserClient();
    p = !db ? Promise.resolve([]) : Promise.resolve(db.rpc('entry_tiers', { c: cardId })).then(({ data, error }) => {
      if (error) return [];
      const blocks = new Map<string, { row: Row; counts: Counts }>();
      for (const r of (data ?? []) as Row[]) {
        const b = blocks.get(r.block_key) ?? { row: r, counts: {} };
        if (r.tier_key) b.counts[r.tier_key] = (b.counts[r.tier_key] ?? 0) + r.lists;
        blocks.set(r.block_key, b);
      }
      return [...blocks.values()].flatMap(({ row, counts }) => {
        const tiers = tiersOf(row.tier_setup);
        const text = communityText(communityTier(counts, tiers), tiers);
        return text ? [{ gameId: row.game_id, block: row.block_key, page: row.page_key, title: row.title, text }] : [];
      });
    }).catch(() => []);
    asked.set(cardId, p);
  }
  return p;
}

export function CommunityTier({ cardId, entryId, color }: { cardId?: string; entryId: string; color: string }) {
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    if (!cardId) return;
    let live = true;
    lookUp(cardId).then((f) => { if (live) setFound(f[0] ?? null); });
    return () => { live = false; };
  }, [cardId]);
  if (!found) return null;
  return (
    <div>
    <Link href={`/g/${found.gameId}/${found.page}?t=${found.block}.${entryId}#${found.block}`} title={`From ${found.title}`}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ring-1 ring-inset ring-black/10 hover:brightness-110"
      style={{ background: color }}>
      Community tier: {found.text}
    </Link>
    </div>
  );
}
