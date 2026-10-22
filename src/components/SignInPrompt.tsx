'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** "Sign in to …" for visitors: a link to the sign-in page that comes back here. */
export function SignInPrompt({ children }: { children: React.ReactNode }) {
  const path = usePathname() || '/';
  return (
    <Link href={`/signin?next=${encodeURIComponent(path)}`} className="gloss btn-primary inline-flex rounded-full px-4 py-2 text-sm font-bold">
      {children}
    </Link>
  );
}
