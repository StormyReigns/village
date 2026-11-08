'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tip } from '@/components/Tip';
import { browserClient } from '@/lib/supabase/browser';
import { MIN_LISTS, communityTier, letterStyle, tiersOf, type Counts, type TierSetup } from '@/lib/tiers';

// The community's tier on an entry's card (docs/blocks/tier-lists.md, Matt 2026-11-08): a big
// letter in its tier's color, outlined in ink, over the bottom-left corner of the portrait. A tip
// on hover (or a tap's pause) gives the numbers; tapping opens the tier list with the piece's sheet.
// It finds every Tier list Block that ranks the entry (entry_tiers) and shows the first that has
// placed it. Nothing shows until someone has, or before the Tier lists SQL is run.

interface Found {
  gameId: string; block: string; page: string; title: string;
  label: string; index: number; leaning: boolean; lists: number; spread: string;
}

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
        const c = communityTier(counts, tiers);
        const index = tiers.findIndex((t) => t.key === c.tier);
        if (index < 0) return [];
        return [{
          gameId: row.game_id, block: row.block_key, page: row.page_key, title: row.title,
          label: tiers[index].label, index, leaning: !c.settled, lists: c.lists,
          spread: tiers.filter((t) => counts[t.key]).map((t) => `${t.label} ${counts[t.key]}`).join(' · '),
        }];
      });
    }).catch(() => []);
    asked.set(cardId, p);
  }
  return p;
}

/** `size` is the portrait's width, so the letter can almost cover its corner. */
export function CommunityTier({ cardId, entryId, size }: { cardId?: string; entryId: string; size: number }) {
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    if (!cardId) return;
    let live = true;
    lookUp(cardId).then((f) => { if (live) setFound(f[0] ?? null); });
    return () => { live = false; };
  }, [cardId]);
  if (!found) return null;
  const px = Math.round(size * (found.label.length <= 2 ? 0.62 : 0.24));
  const tip = found.leaning
    ? `${found.title}: leaning ${found.label}. Fewer than ${MIN_LISTS} lists have placed them so far. Tap to see the tier list.`
    : `${found.title}: ${found.label}, from ${found.lists} lists (${found.spread}). Tap to see the tier list.`;
  return (
    <Tip text={tip} className="absolute -bottom-4 -left-3 z-10">
      <Link href={`/g/${found.gameId}/${found.page}?t=${found.block}.${entryId}#${found.block}`}
        aria-label={found.leaning ? `Community tier: leaning ${found.label}` : `Community tier: ${found.label}`}
        className="block -rotate-6 select-none transition hover:-rotate-3 hover:scale-105" style={letterStyle(found.index, px, found.leaning)}>
        {found.label}
      </Link>
    </Tip>
  );
}
