import { getGame } from '@/data/games';
import { gameWiki } from '@/lib/wiki-server';

// The game's wiki for the Workshop (docs/blocks/wiki-links.md): its name and addresses, as its
// moderators saved them, on a wiki site we know. Public: it's what every wiki link shows anyway.

export async function GET(_req: Request, ctx: RouteContext<'/api/wiki/[game]'>) {
  const { game } = await ctx.params;
  if (!getGame(game)) return Response.json({ wiki: null }, { status: 404 });
  const wiki = await gameWiki(game);
  return Response.json({ wiki }, { headers: { 'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600' } });
}
