import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

// One family for everything (brand rules in CLAUDE.md): heavy for names, regular for reading.
const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin"] });

export const metadata: Metadata = {
  // Previews (Discord, Messages) need full addresses for their images.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://village-tawny-beta.vercel.app'),
  title: { default: "Village", template: "%s · Village" },
  description: "Community-built companion apps for the games you love.",
  openGraph: { siteName: "Village", title: "Village", description: "Community-built companion apps for the games you love." },
  twitter: { card: "summary_large_image" },
};

// Always light, even when the device is in dark mode.
// No site-wide theme color: shared Pages set their own, which Discord uses for the preview edge.
export const viewport: Viewport = { colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
