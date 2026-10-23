'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * "Sign in to …" for visitors: a link to the sign-in page that comes back here.
 * `back` adds to the return address, e.g. "?resume=1" to reopen a form afterwards.
 */
export function SignInPrompt({ children, back = '' }: { children: React.ReactNode; back?: string }) {
  const path = (usePathname() || '/') + back;
  return (
    <Link href={`/signin?next=${encodeURIComponent(path)}`} className="gloss btn-primary inline-flex rounded-full px-4 py-2 text-sm font-bold">
      {children}
    </Link>
  );
}
