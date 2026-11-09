import { cacheLife } from 'next/cache';
import { inviteApi, toInviteInfo, type InviteInfo } from '@/lib/communities';

// What Discord says about a server invite: its name, icon and member counts, asked of Discord's
// public invite address (no key) and kept for a day. Communities on the app show only this, never
// what the lister typed, so it can't be faked, and a dead or expiring invite simply isn't shown
// (docs/blocks/discord.md).

async function inviteInfo(code: string): Promise<InviteInfo> {
  'use cache';
  cacheLife('days');
  const res = await fetch(inviteApi(code), {
    headers: { accept: 'application/json', 'user-agent': 'Village (https://village-tawny-beta.vercel.app, 1.0)' },
  });
  // Discord busy or down isn't an answer about the invite: throw, so nothing is kept.
  if (res.status === 429 || res.status >= 500) throw new Error(`Discord answered ${res.status}`);
  const body = await res.json().catch(() => null);
  return toInviteInfo(res.status, body);
}

export async function GET(_req: Request, ctx: RouteContext<'/api/discord-invite/[code]'>) {
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9-]{2,32}$/.test(code)) return Response.json({ ok: false, reason: 'gone' } satisfies InviteInfo, { status: 400 });
  try {
    const info = await inviteInfo(code);
    return Response.json(info, { headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch {
    return Response.json({ error: 'Couldn’t reach Discord.' }, { status: 502 });
  }
}
