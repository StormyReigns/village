import { getGame } from '@/data/games';
import { getSharedPlan } from '@/lib/plan-share';
import { OG_SIZE, villageCard } from '@/lib/og-card';
import { partyCard } from '@/lib/og-party';

// The preview picture for a shared party: its units as pieces.
export const alt = 'A party on Village';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ game: string; plan: string }> }) {
  const { game: gameId, plan } = await params;
  const game = getGame(gameId);
  const shared = game ? await getSharedPlan(gameId, plan) : null;
  if (!game || !shared) return villageCard({ tint: 'leaf', kicker: 'Village', title: 'Not found' });
  return partyCard({
    tint: shared.page.tint, shade: game.shade, kicker: `${game.shortTitle} · ${shared.page.title}`,
    title: `${shared.maker}’s ${shared.title}`, names: shared.members.map((m) => m.unit.name),
  });
}
