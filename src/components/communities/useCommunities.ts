'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { missingTable } from '@/lib/questions';
import { rankCommunities, type InviteInfo } from '@/lib/communities';

// Loading, listing, voting and deciding for a game's Communities (docs/blocks/discord.md).
// Rows come from the database (live ones for everyone; your own and, for moderators, waiting
// ones too). What a Discord server looks like comes from /api/discord-invite, read from Discord.

export interface Community {
  id: string; gameId: string; kind: 'discord' | 'link';
  invite: string | null; url: string | null; name: string | null; pitch: string;
  listedBy: string; status: 'waiting' | 'live' | 'declined' | 'removed';
  declineReason: string | null; createdAt: string;
  ups: number; downs: number;
}

/** A Discord server's look: loading, Discord's answer, or Discord couldn't be reached. */
export type Look = 'loading' | 'unreachable' | InviteInfo;

type Row = Record<string, unknown>;
const toCommunity = (r: Row, t?: { ups: number; downs: number }): Community => ({
  id: r.id as string, gameId: r.game_id as string, kind: r.kind === 'link' ? 'link' : 'discord',
  invite: (r.invite as string) ?? null, url: (r.url as string) ?? null, name: (r.name as string) ?? null,
  pitch: r.pitch as string, listedBy: r.listed_by as string, status: r.status as Community['status'],
  declineReason: (r.decline_reason as string) ?? null, createdAt: r.created_at as string,
  ups: t?.ups ?? 0, downs: t?.downs ?? 0,
});

const COLUMNS = 'id, game_id, kind, invite, url, name, pitch, listed_by, status, decline_reason, created_at';

/** Asks our server what Discord says about each invite (kept for a day there). */
const looks = new Map<string, Promise<Look>>();
export function lookOf(code: string): Promise<Look> {
  let p = looks.get(code);
  if (!p) {
    p = fetch(`/api/discord-invite/${encodeURIComponent(code)}`)
      .then(async (r) => (r.ok || r.status === 400 ? ((await r.json()) as InviteInfo) : 'unreachable' as const))
      .catch(() => 'unreachable' as const);
    looks.set(code, p);
  }
  return p;
}

export function useCommunities(gameId: string, meId: string | null) {
  /** null while loading; 'missing' before the SQL is run. */
  const [rows, setRows] = useState<Community[] | null | 'missing'>(null);
  const [mine, setMine] = useState<Map<string, number>>(new Map());
  const [look, setLook] = useState<Map<string, Look>>(new Map());

  const load = useCallback(async () => {
    const db = browserClient();
    if (!db) { setRows([]); return; }
    const [list, tallies] = await Promise.all([
      db.from('communities').select(COLUMNS).eq('game_id', gameId).in('status', ['waiting', 'live', 'declined']).order('created_at'),
      db.rpc('community_tallies', { g: gameId }),
    ]);
    if (list.error) { setRows(missingTable(list.error) || list.error.code === 'PGRST205' ? 'missing' : []); return; }
    const t = new Map(((tallies.data ?? []) as Row[]).map((r) => [r.community_id as string, { ups: r.ups as number, downs: r.downs as number }]));
    const all = ((list.data ?? []) as Row[]).map((r) => toCommunity(r, t.get(r.id as string)));
    setRows(all);
    if (meId) {
      const v = await db.from('community_votes').select('community_id, value').eq('voter_id', meId);
      setMine(new Map(((v.data ?? []) as Row[]).map((r) => [r.community_id as string, r.value as number])));
    } else setMine(new Map());
    for (const c of all) {
      if (!c.invite) continue;
      const code = c.invite;
      lookOf(code).then((l) => setLook((m) => new Map(m).set(code, l)));
    }
  }, [gameId, meId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the database
  useEffect(() => { load(); }, [load]);

  const list = rows === 'missing' || rows === null ? [] : rows;
  const lookFor = (c: Community): Look | null => (c.invite ? look.get(c.invite) ?? 'loading' : null);
  /** Live listings players can see: Discord ones only once Discord says the invite is good. */
  const shown = rankCommunities(list.filter((c) => {
    if (c.status !== 'live') return false;
    const l = lookFor(c);
    return l === null || (typeof l === 'object' && l.ok);
  }));

  async function vote(id: string, value: 1 | -1) {
    const db = browserClient();
    if (!db || !meId) return;
    const before = mine.get(id);
    const next = before === value ? 0 : value;
    const res = next === 0
      ? await db.from('community_votes').delete().eq('community_id', id).eq('voter_id', meId)
      : await db.from('community_votes').upsert({ community_id: id, voter_id: meId, value: next });
    if (!res.error) await load();
    return res.error?.message;
  }

  async function submit(c: { kind: 'discord' | 'link'; invite?: string; url?: string; name: string; pitch: string }) {
    const db = browserClient();
    if (!db || !meId) return 'Sign in first.';
    const { error } = await db.from('communities').insert({
      game_id: gameId, kind: c.kind, invite: c.invite ?? null, url: c.url ?? null,
      name: c.name.trim().slice(0, 60) || null, pitch: c.pitch.trim(), listed_by: meId,
    });
    if (error) {
      if (error.code === '23505') return 'That’s already listed for this game.';
      if (error.code === 'P0001') return error.message;
      return 'Couldn’t send it. Check the link and try again.';
    }
    await load();
    return null;
  }

  async function rpc(fn: string, args: Record<string, unknown>) {
    const db = browserClient();
    if (!db) return 'Not connected.';
    const { error } = await db.rpc(fn, args);
    if (error) return error.code === 'P0001' ? error.message : 'Something went wrong. Try again in a minute.';
    await load();
    return null;
  }

  async function report(id: string, reason: 'spam' | 'rude' | 'wrong' | 'other') {
    const db = browserClient();
    if (!db || !meId) return 'Sign in first.';
    const { error } = await db.from('flags').insert({ community_id: id, reason, reporter_id: meId });
    if (error && error.code !== '23505') return error.code === 'P0001' ? error.message : 'Couldn’t send the report.';
    return null;
  }

  return {
    ready: rows !== null, missing: rows === 'missing', all: list, shown, mine, lookFor, load, vote, submit, report,
    remove: (id: string) => rpc('remove_community', { c: id }),
    decide: (id: string, approve: boolean, reason?: string) => rpc('decide_community', { c: id, approve, reason: reason ?? null }),
  };
}

export type CommunitiesData = ReturnType<typeof useCommunities>;
