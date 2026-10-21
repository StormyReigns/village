import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { SignInPanel } from './SignInPanel';

export const metadata: Metadata = { title: 'Sign in' };

// A full page for signing in, used when a sign-in link fails or someone lands here directly.
export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Village square
      </Link>
      <section className="surface mt-4 rounded-[2rem] p-6">
        <h1 className="font-display text-3xl">Join the village</h1>
        <div className="mt-4">
          <Suspense><SignInPanel /></Suspense>
        </div>
      </section>
    </main>
  );
}
