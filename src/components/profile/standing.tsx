'use client';

import { useEffect, useState } from 'react';
import { Leaf, Sparkles, Star } from 'lucide-react';
import { GAMES } from '@/data/games';
import { Piece } from '@/components/Piece';
import { Tip } from '@/components/Tip';
import { browserClient } from '@/lib/supabase/browser';
import { ROLE, TENURE, activeWeeks, keeperStars, leaves, standing } from '@/lib/ranks';

// A villager's standing, shared by your own profile (/me) and everyone's public one (/u/name):
// their Drafts, active weeks and votes, the title those make, and a badge per game.

export interface TheirDraft { id: string; game_id: string; title: string; status: string; created_at: string; card_id: string | null; action?: string | null }
export interface Standing { drafts: TheirDraft[]; weeks: number; votes: number; live: Set<string>; hidePlanted: boolean }

/** Everything a profile shows, read from the village's records (all of it is public). */
export function useStanding(profileId: string | null | undefined) {
  const [data, setData] = useState<Standing | null>(null);
  useEffect(() => {
    const db = browserClient();
    if (!db || !profileId) return;
    let cancelled = false;
    (async () => {
      const [d, v, c, p] = await Promise.all([
        db.from('drafts').select('id, game_id, title, status, created_at, card_id, action').eq('author_id', profileId).order('created_at', { ascending: false }).limit(500),
        db.from('draft_votes').select('created_at').eq('voter_id', profileId).limit(2000),
        db.from('chat_messages').select('created_at').eq('author_id', profileId).limit(2000),
        db.from('profiles').select('hide_planted').eq('id', profileId).maybeSingle(),
      ]);
      const drafts = (d.data ?? []) as TheirDraft[];
      // Which published Drafts are still the live version in the app ("in season").
      const shipped = drafts.filter((x) => x.status === 'stable' && x.card_id);
      const live = new Set<string>();
      if (shipped.length) {
        const ptr = await db.from('card_pointers').select('revision:card_revisions(draft_id)').eq('channel', 'stable').in('card_id', shipped.map((x) => x.card_id!));
        for (const r of (ptr.data ?? []) as unknown as { revision: { draft_id: string | null } | null }[]) if (r.revision?.draft_id) live.add(r.revision.draft_id);
      }
      const times = [...drafts.map((x) => x.created_at), ...((v.data ?? []) as { created_at: string }[]).map((x) => x.created_at), ...((c.data ?? []) as { created_at: string }[]).map((x) => x.created_at)];
      if (!cancelled) setData({ drafts, weeks: activeWeeks(times), votes: v.data?.length ?? 0, live, hidePlanted: Boolean(p.data?.hide_planted) });
    })();
    return () => { cancelled = true; };
  }, [profileId]);
  return [data, setData] as const;
}

/** The two-part title (tenure plus role), with Keeper stars. */
export function titleOf(data: Standing | null) {
  const harvests = data?.drafts.filter((d) => d.status === 'stable').length ?? 0;
  const role = standing(ROLE, harvests).now.name;
  return { harvests, role, title: `${standing(TENURE, data?.weeks ?? 0).now.name} ${role}`, stars: keeperStars(harvests) };
}

/** The title as an ink chip. */
export function TitleChip({ data, tip }: { data: Standing | null; tip: string }) {
  const { title, stars } = titleOf(data);
  return (
    <Tip text={tip} tint="leaf">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">
        <Sparkles size={14} className="text-signal" aria-hidden="true" /> {data ? title : '…'}
        {stars > 0 && Array.from({ length: stars }, (_, i) => <Star key={i} size={12} aria-hidden="true" />)}
      </span>
    </Tip>
  );
}

/**
 * One badge per game: an empty split outline before they start, gray once something is planted,
 * the game's color once harvested, glowing while in season. `planted` shows the count of Drafts
 * still waiting (left out when the villager hides it). `only` keeps just the games they've started.
 */
export function GameBadges({ data, planted, only = false, you = true }: { data: Standing | null; planted: boolean; only?: boolean; you?: boolean }) {
  const games = GAMES.map((g) => {
    const mine = data?.drafts.filter((d) => d.game_id === g.id && d.status !== 'removed') ?? [];
    const shipped = mine.filter((d) => d.status === 'stable');
    const isLive = shipped.some((d) => data?.live.has(d.id));
    const state = isLive ? 'In season' : shipped.length ? 'Harvested' : mine.length ? 'Planted' : 'Not started';
    return { g, mine, shipped, isLive, state };
  }).filter((x) => !only || x.state !== 'Not started');
  if (!games.length) return null;
  const whose = you ? 'yours' : 'theirs';
  return (
    <ul className="grid gap-4 pt-2 sm:grid-cols-2">
      {games.map(({ g, mine, shipped, isLive, state }) => {
        const why = {
          'In season': `Something of ${whose} is live in the app right now.`,
          Harvested: `Something of ${whose} reached the app.`,
          Planted: `Drafts of ${whose} are in the Workshop, waiting to reach the app.`,
          'Not started': 'Nothing added to this game yet.',
        }[state];
        const n = leaves(shipped.length);
        return (
          <li key={g.id}>
            <Tip text={why} tint={g.hue}>
              <span className="flex w-full items-center gap-3 rounded-2xl bg-card-2 p-3 ring-1 ring-line">
                <Piece size={60} outline={state === 'Not started'} color={shipped.length ? `var(--${g.hue})` : '#9aa0ad'}
                  style={isLive ? { filter: `drop-shadow(0 0 8px var(--${g.hue}))` } : undefined}>
                  {g.shortTitle.slice(0, 1)}
                </Piece>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{g.shortTitle}</span>
                  <span className="block text-xs text-muted">
                    {state}
                    {state === 'Planted' && planted && ` · Planted ${mine.length}`}
                  </span>
                </span>
                {n > 0 && (
                  <span className="flex gap-0.5" aria-label={`${n} of 4 leaves`}>
                    {Array.from({ length: 4 }, (_, i) => <Leaf key={i} size={14} className={i < n ? '' : 'opacity-25'} aria-hidden="true" />)}
                  </span>
                )}
              </span>
            </Tip>
          </li>
        );
      })}
    </ul>
  );
}
