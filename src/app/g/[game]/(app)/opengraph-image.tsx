import { getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { OG_SIZE, villageCard } from '@/lib/og-card';

// The preview picture for a game's app home and its Workshop: the game and its Pages.
export const alt = 'A Village card for this game';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ game: string }> }) {
  const game = getGame((await params).game);
  if (!game) return villageCard({ tint: 'leaf', kicker: 'Village', title: 'Not found' });
  const pages = await getApp(game.id);
  return villageCard({
    tint: game.hue, shade: game.shade, kicker: 'Companion app · Built by players', title: game.title,
    rows: pages.map((p) => ({ name: p.title, tint: p.tint })),
  });
}
