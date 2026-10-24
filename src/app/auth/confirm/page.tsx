import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ConfirmPanel } from './ConfirmPanel';

export const metadata: Metadata = { title: 'Finish signing in' };

// Where emailed sign-in links land. Signing in waits for a button press, so email apps
// that pre-open links to scan them can't use the one-time link up.
export default function ConfirmPage() {
  return (
    <main className="mx-auto grid w-full max-w-md flex-1 place-items-center px-4 py-16">
      <section className="surface w-full rounded-2xl p-6 text-center">
        <Suspense><ConfirmPanel /></Suspense>
      </section>
    </main>
  );
}
