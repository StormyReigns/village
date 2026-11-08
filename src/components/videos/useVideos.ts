'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { rankVideos, type VideoInfo } from '@/lib/videos';

// The videos on one entry (docs/blocks/videos.md): loading them with their totals and your
// votes, adding, voting, reporting and taking down. Row-level security in the database decides
// what's allowed (20261108180000_videos.sql); this file only asks.

export interface LiveVideo {
  id: string;
  gameId: string;
  youtubeId: string;
  start: number;
  addedBy: string | null;
  createdAt: string;
  helped: number;
  notHelped: number;
  /** Your vote: 1 helped, -1 didn't help, 0 none. */
  mine: -1 | 0 | 1;
}

type Row = Record<string, unknown>;

/** Database errors in words a player can act on. */
export function videoError(message: string): string {
  if (/slow down/i.test(message)) return message.replace(/^.*?(Slow down)/i, '$1');
  if (/duplicate key|unique/i.test(message)) return 'That video is already on this entry.';
  if (/row-level security|permission/i.test(message)) return "That wasn't allowed. Try signing in again.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the village. Check your connection and try again.";
  return message;
}

/** Before the Videos SQL is run there's no table: the app shows nothing about videos. */
const missing = (e: { message?: string; code?: string } | null) =>
  Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /videos|video_tallies|schema cache|does not exist/i.test(e.message ?? '')));

export function useVideos(cardId: string | undefined, meId: string | null | undefined) {
  const [videos, setVideos] = useState<LiveVideo[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'offline'>('loading');
  /** Videos you've reported or asked to have removed, so the button says so. */
  const [reported, setReported] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const db = browserClient();
    if (!db || !cardId) { setState('offline'); return; }
    const list = await db.from('videos').select('id, game_id, youtube_id, start_seconds, added_by, created_at').eq('card_id', cardId).eq('status', 'live').limit(200);
    if (list.error) { setState(missing(list.error) ? 'missing' : 'offline'); return; }
    const rows = (list.data ?? []) as Row[];
    const tallies = rows.length ? await db.rpc('video_tallies', { ids: rows.map((r) => r.id as string) }) : { data: [], error: null };
    if (tallies.error) { setState(missing(tallies.error) ? 'missing' : 'offline'); return; }
    const counts = new Map(((tallies.data ?? []) as Row[]).map((t) => [t.video_id as string, t]));
    let votes = new Map<string, number>();
    if (meId && rows.length) {
      const ids = rows.map((r) => r.id as string);
      const [mine, flagged] = await Promise.all([
        db.from('video_votes').select('video_id, value').eq('voter_id', meId).in('video_id', ids),
        db.from('flags').select('video_id').eq('reporter_id', meId).in('video_id', ids),
      ]);
      votes = new Map(((mine.data ?? []) as Row[]).map((v) => [v.video_id as string, v.value as number]));
      setReported(new Set(((flagged.data ?? []) as Row[]).map((f) => f.video_id as string)));
    }
    setVideos(rows.map((r) => {
      const c = counts.get(r.id as string);
      return {
        id: r.id as string, gameId: r.game_id as string, youtubeId: r.youtube_id as string, start: (r.start_seconds as number) ?? 0,
        addedBy: (r.added_by as string) ?? null, createdAt: r.created_at as string,
        helped: (c?.helped as number) ?? 0, notHelped: (c?.not_helped as number) ?? 0, mine: (votes.get(r.id as string) ?? 0) as -1 | 0 | 1,
      };
    }));
    setState('ready');
  }, [cardId, meId]);

  useEffect(() => {
    if (!cardId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading this entry's videos from the database
    load().catch(() => setState('offline'));
  }, [cardId, load]);

  /** Adds a video to this entry. Returns an error in plain words, or null. */
  const add = useCallback(async (youtubeId: string, start: number): Promise<string | null> => {
    const db = browserClient();
    if (!db || !meId || !cardId) return 'Sign in to add a video.';
    const { error } = await db.from('videos').insert({ card_id: cardId, youtube_id: youtubeId, start_seconds: start, added_by: meId });
    if (error) return videoError(error.message);
    await load();
    return null;
  }, [cardId, meId, load]);

  /** Votes "helped" (1) or "didn't help" (-1); the same vote again takes it back. */
  const vote = useCallback(async (id: string, value: 1 | -1): Promise<string | null> => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to vote.';
    const before = videos.find((v) => v.id === id);
    if (!before) return null;
    const next = before.mine === value ? 0 : value;
    const bump = (v: LiveVideo): LiveVideo => ({
      ...v, mine: next,
      helped: v.helped - (v.mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
      notHelped: v.notHelped - (v.mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
    });
    // Shown straight away; put back if the database says no.
    setVideos((list) => list.map((v) => (v.id === id ? bump(v) : v)));
    const { error } = next === 0
      ? await db.from('video_votes').delete().eq('video_id', id).eq('voter_id', meId)
      : await db.from('video_votes').upsert({ video_id: id, voter_id: meId, value: next });
    if (error) {
      setVideos((list) => list.map((v) => (v.id === id ? before : v)));
      return videoError(error.message);
    }
    return null;
  }, [meId, videos]);

  /** Reports a video to the game's moderators. A removal request from whoever added it is a
   *  report too ("Something else", with a note saying who's asking). */
  const report = useCallback(async (id: string, reason: string, note?: string): Promise<string | null> => {
    const db = browserClient();
    if (!db || !meId) return 'Sign in to report.';
    const { error } = await db.from('flags').insert({ video_id: id, reason, reporter_id: meId, note: note ?? null });
    const already = Boolean(error && /duplicate key|unique/i.test(error.message));
    if (!error || already) setReported((s) => new Set(s).add(id));
    return error ? (already ? 'You already sent this one. A moderator will take a look.' : videoError(error.message)) : null;
  }, [meId]);

  /** Takes a video down: a moderator, or whoever added it in its first hour. */
  const remove = useCallback(async (id: string): Promise<string | null> => {
    const db = browserClient();
    if (!db) return "Couldn't reach the village.";
    const { error } = await db.rpc('remove_video', { v: id });
    if (error) return videoError(error.message);
    setVideos((list) => list.filter((v) => v.id !== id));
    return null;
  }, []);

  return { videos: rankVideos(videos), state, reported, add, vote, report, remove };
}

// What YouTube says about each video, asked once per video per visit.
const infos = new Map<string, Promise<VideoInfo | null>>();

export function fetchVideoInfo(youtubeId: string): Promise<VideoInfo | null> {
  let p = infos.get(youtubeId);
  if (!p) {
    p = fetch(`/api/video-info/${youtubeId}`)
      .then(async (r) => (r.ok || r.status === 400 ? ((await r.json()) as VideoInfo) : null))
      .catch(() => null);
    // A failed lookup (no connection, YouTube down) is asked again next time.
    p.then((v) => { if (!v) infos.delete(youtubeId); });
    infos.set(youtubeId, p);
  }
  return p;
}

/** A video's credit: undefined while asking, null if YouTube couldn't be reached. */
export function useVideoInfo(youtubeId: string | null): VideoInfo | null | undefined {
  const [info, setInfo] = useState<{ id: string; v: VideoInfo | null } | null>(null);
  useEffect(() => {
    if (!youtubeId) return;
    let live = true;
    fetchVideoInfo(youtubeId).then((v) => { if (live) setInfo({ id: youtubeId, v }); });
    return () => { live = false; };
  }, [youtubeId]);
  return info && info.id === youtubeId ? info.v : undefined;
}

/** Credits for several videos at once, keyed by YouTube id (undefined while asking). */
export function useVideoInfos(youtubeIds: string[]): Record<string, VideoInfo | null | undefined> {
  const key = youtubeIds.join(',');
  const [infos, setInfos] = useState<Record<string, VideoInfo | null>>({});
  useEffect(() => {
    let live = true;
    for (const id of key ? key.split(',') : []) {
      fetchVideoInfo(id).then((v) => { if (live) setInfos((cur) => (id in cur && cur[id] === v ? cur : { ...cur, [id]: v })); });
    }
    return () => { live = false; };
  }, [key]);
  return infos;
}
