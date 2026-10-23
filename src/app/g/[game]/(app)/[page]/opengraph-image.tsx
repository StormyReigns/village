import { getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { OG_SIZE, tintFor, villageCard } from '@/lib/og-card';

// The preview picture for a shared Page: its color, its name and the Blocks inside.
export const alt = 'A Village card for this Page';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ game: string; page: string }> }) {
  const { game: gameId, page: pageId } = await params;
  const game = getGame(gameId);
  const page = (await getApp(gameId)).find((p) => p.id === pageId);
  if (!game || !page) return villageCard({ tint: 'leaf', kicker: 'Village', title: 'Not found' });
  return villageCard({
    tint: page.tint, kicker: game.shortTitle, title: page.title, line: page.blurb,
    rows: page.blocks.map((b) => ({ name: b.title, tint: tintFor(b.title) })),
  });
}
