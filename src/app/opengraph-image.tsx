import { GAMES } from '@/data/games';
import { OG_SIZE, villageCard } from '@/lib/og-card';

// The preview picture for the village square, and for any page without its own.
export const alt = 'Village: community-built companion apps';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return villageCard({
    tint: 'leaf', kicker: 'Village', title: 'Companion apps, built by players',
    line: 'Community-built companion apps for the games you love.', chips: GAMES.map((g) => g.shortTitle),
  });
}
