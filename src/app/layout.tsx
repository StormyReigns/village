import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { VideoDock } from "@/components/videos/VideoDock";
import { ServiceWorker } from "@/components/ServiceWorker";
import { GamesProvider } from "@/components/GamesProvider";
import { getGames } from "@/lib/games-data";

// One family for everything (brand rules in CLAUDE.md): heavy for names, regular for reading.
const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin"] });

export const metadata: Metadata = {
  // Previews (Discord, Messages) need full addresses for their images.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://village-tawny-beta.vercel.app'),
  title: { default: "Village", template: "%s · Village" },
  description: "Community-built companion apps for the games you love.",
  openGraph: { siteName: "Village", title: "Village", description: "Community-built companion apps for the games you love." },
  twitter: { card: "summary_large_image" },
  // The phone app on iPhones: full screen from the home screen, with an ink status bar like the top bar.
  appleWebApp: { capable: true, title: "Village", statusBarStyle: "black" },
};

// Always light, even when the device is in dark mode.
// No site-wide theme color: shared Pages set their own, which Discord uses for the preview edge.
// "cover" makes iPhones say how much room their home swipe and rounded corners need
// (env(safe-area-inset-*) in CSS); without it that comes out as zero in the phone app, and
// the bottom bar sat right on the swipe. The body keeps clear of the sides in landscape.
export const viewport: Viewport = { colorScheme: "light", viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every game, from the database (docs/games.md), for the parts of the site that run in the browser. Cached.
  const games = await getGames();
  return (
    <html lang="en" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <GamesProvider games={games}>
        {children}
        {/* The one video player, so a video keeps playing while you scroll or change Pages. */}
        <VideoDock />
        {/* Offline reading for the phone app (public/sw.js). */}
        <ServiceWorker />
        </GamesProvider>
      </body>
    </html>
  );
}
