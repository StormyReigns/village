import type { MetadataRoute } from 'next';
import { GAMES } from '@/data/games';

// The phone app: "Add to Home Screen" (or Chrome's Install) turns the site into an app with the
// logo as its icon, opening full screen. Pages you've opened keep working offline (public/sw.js).
// Icons come from the logo via scripts/build-icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Village',
    short_name: 'Village',
    description: 'Community-built companion apps for the games you love.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f5f7',
    theme_color: '#15171c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the icon to jump straight into a game.
    shortcuts: GAMES.map((g) => ({ name: g.shortTitle, url: `/g/${g.id}`, icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] })),
  };
}
