'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { usePlayerPrefs } from '@/components/usePlayerPrefs';
import { planKey, readPartyIndex, type PartyIndex } from '@/lib/planner';
import { PARTY_EVENT, partyIndexKey } from './useParty';

// "In your party" on a unit's card, and "Planned for Goliath" on an item's card, anywhere in the app
// (docs/blocks/planner.md, slice 2b). Read from the small index the Planner keeps on this device, for
// the route picked in the switcher. Tapping it opens that unit's plan on the Party Page. Nothing shows
// on the Party Page itself, in previews, or for anything not in the plan.

function useIndex(gameId: string) {
  const [index, setIndex] = useState<PartyIndex | null>(null);
  useEffect(() => {
    if (!gameId) return;
    const read = () => {
      try { setIndex(readPartyIndex(JSON.parse(localStorage.getItem(partyIndexKey(gameId)) ?? 'null'))); } catch { setIndex(null); }
    };
    read();
    window.addEventListener(PARTY_EVENT, read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener(PARTY_EVENT, read); window.removeEventListener('storage', read); };
  }, [gameId]);
  return index;
}

export function PartyMark({ blockId, entryId }: { blockId: string; entryId: string }) {
  const gameId = String(useParams<{ game?: string }>()?.game ?? '');
  const path = usePathname();
  const [prefs] = usePlayerPrefs(gameId);
  const index = useIndex(gameId);
  if (!index || path === index.href) return null;
  const here = index.byRoute[planKey(prefs.route)];
  if (!here) return null;
  const key = `${blockId}.${entryId}`;
  const isMember = here.members.includes(key);
  const forWhom = here.items[key] ?? [];
  if (!isMember && !forWhom.length) return null;
  const label = isMember ? 'In your party' : `Planned for ${forWhom.slice(0, 3).join(', ')}${forWhom.length > 3 ? ` and ${forWhom.length - 3} more` : ''}`;
  return (
    <Link href={isMember ? `${index.href}?e=${key}` : index.href}
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-soft px-2.5 py-1 text-xs font-bold text-slate ring-1 ring-slate/30 hover:ring-slate">
      <ClipboardList size={13} aria-hidden="true" /> {label}
    </Link>
  );
}
