'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * "Sign in to …" for visitors: a link to the sign-in page that comes back here.
 * `back` adds to the return address, e.g. "?resume=1" to reopen a form afterwards.
 * `forWhat` tells the sign-in page why, e.g. "send your fix to Hingosh".
 */
export function SignInPrompt({ children, back = '', forWhat }: { children: React.ReactNode; back?: string; forWhat?: string }) {
  const path = (usePathname() || '/') + back;
  const why = forWhat ? `&for=${encodeURIComponent(forWhat)}` : '';
  return (
    <Link href={`/signin?next=${encodeURIComponent(path)}${why}`} className="gloss btn-primary inline-flex rounded-full px-4 py-2 text-sm font-bold">
      {children}
    </Link>
  );
}
