import { cacheLife } from 'next/cache';
import { isVideoId, oembedUrl, toVideoInfo, type VideoInfo } from '@/lib/videos';

// Who made a YouTube video, asked of YouTube itself (its free oEmbed address, no key) and kept
// for a day. The credit on every video in the app comes from here, never from whoever added
// the video, so it can't be faked (docs/blocks/videos.md).

async function videoInfo(id: string): Promise<VideoInfo> {
  'use cache';
  cacheLife('days');
  const res = await fetch(oembedUrl(id), { headers: { accept: 'application/json' } });
  // YouTube being down isn't an answer about the video: throw, so nothing is kept.
  if (res.status >= 500) throw new Error(`YouTube answered ${res.status}`);
  const body = res.ok ? await res.json().catch(() => null) : null;
  return toVideoInfo(res.status, body);
}

export async function GET(_req: Request, ctx: RouteContext<'/api/video-info/[id]'>) {
  const { id } = await ctx.params;
  if (!isVideoId(id)) return Response.json({ ok: false, reason: 'gone' } satisfies VideoInfo, { status: 400 });
  try {
    const info = await videoInfo(id);
    return Response.json(info, { headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch {
    return Response.json({ error: 'Couldn’t reach YouTube.' }, { status: 502 });
  }
}
