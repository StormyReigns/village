import { getGames } from '@/lib/games-data';
import { listed } from '@/data/games';
import { OG_SIZE, villageCard } from '@/lib/og-card';

// The preview picture for the village square, and for any page without its own.
export const alt = 'Village: community-built companion apps';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return villageCard({
    tint: 'leaf', kicker: 'Village', title: 'Companion apps, built by players',
    line: 'Community-built companion apps for the games you love.',
    rows: listed(await getGames()).map((g) => ({ name: g.shortTitle, tint: g.hue })),
  });
}
