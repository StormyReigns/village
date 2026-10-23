import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

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
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
