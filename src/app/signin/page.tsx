import { Suspense } from 'react';
import type { Metadata } from 'next';
import { TopBar } from '@/components/Logo';
import { SignInPanel } from './SignInPanel';

export const metadata: Metadata = { title: 'Sign in' };

// A full page for signing in, used when a sign-in link fails or someone lands here directly.
export default function SignInPage() {
  return (
    <>
    <TopBar />
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
      <section className="surface rounded-2xl p-6">
        <h1 className="font-display text-3xl">Join the village</h1>
        <div className="mt-4">
          <Suspense><SignInPanel /></Suspense>
        </div>
      </section>
    </main>
    </>
  );
}
