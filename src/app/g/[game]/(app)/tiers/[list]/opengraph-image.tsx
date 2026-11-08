import { getGame } from '@/data/games';
import { getSharedList } from '@/lib/tier-share';
import { OG_SIZE, villageCard } from '@/lib/og-card';
import { tierCard } from '@/lib/og-tiers';

// The preview picture for a shared tier list: its tiers as rows of pieces.
export const alt = 'A tier list on Village';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ game: string; list: string }> }) {
  const { game: gameId, list } = await params;
  const game = getGame(gameId);
  const shared = game ? await getSharedList(gameId, list) : null;
  if (!game || !shared) return villageCard({ tint: 'leaf', kicker: 'Village', title: 'Not found' });
  const rows = Object.fromEntries(shared.tiers.map((t) => [t.key, (shared.list.rows[t.key] ?? []).map((id) => shared.entries.get(id)?.name).filter((n): n is string => Boolean(n))]));
  return tierCard({
    tint: shared.page.tint, shade: game.shade, kicker: `${game.shortTitle} · ${shared.block.title}`,
    title: `${shared.maker}’s list`, tiers: shared.tiers, rows,
  });
}
