import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
