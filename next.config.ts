import type { NextConfig } from "next";

// Pictures people upload live in our Supabase storage. Next's optimizer serves them shrunk to the
// size a piece shows them at (src/components/Piece.tsx), sharp instead of scaled down in the browser.
// Only our own public storage is allowed; copies are kept for 31 days.
const storage = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL('/storage/v1/object/public/**', process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  images: {
    remotePatterns: storage ? [storage] : [],
    qualities: [75],
    minimumCacheTTL: 2678400,
  },
  partialPrefetching: true,
  // The phone app's service worker (public/sw.js) is always fetched fresh, so an update reaches
  // everyone on their next visit.
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
    ] }];
  },
  // The game app used to live at /g/<game>/p, and before that had block and card pages.
  async redirects() {
    return [
      { source: '/g/:game/p', destination: '/g/:game', permanent: false },
      { source: '/g/:game/p/:page', destination: '/g/:game/:page', permanent: false },
      { source: '/g/:game/b/:block', destination: '/g/:game', permanent: false },
      { source: '/g/:game/c/:card', destination: '/g/:game', permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
