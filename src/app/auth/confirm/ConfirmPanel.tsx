'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/browser';

const TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

export function ConfirmPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const tokenHash = params.get('token_hash');
  // Supabase's default email template sends a one-time code instead (works in the same browser).
  const code = params.get('code');
  const reason = params.get('error_description') || params.get('error_code');
  const typeParam = params.get('type') as EmailOtpType | null;
  const type: EmailOtpType = typeParam && TYPES.includes(typeParam) ? typeParam : 'email';
  const raw = params.get('next');
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  const [state, setState] = useState<{ kind: 'ready' | 'busy' | 'error'; text?: string }>({ kind: 'ready' });

  if (!tokenHash && !code) {
    return (
      <>
        <h1 className="font-display text-2xl">{reason ? "That link didn't work" : 'This link is incomplete'}</h1>
        <p className="mt-2 text-muted">{reason ? `Supabase says: ${reason}.` : "It's missing its sign-in code."} Ask for a new link and open it straight from the email.</p>
        <Link href={`/signin?next=${encodeURIComponent(next)}`} className="gloss btn-primary mt-5 inline-block rounded-full px-5 py-2.5 font-bold">Get a new link</Link>
      </>
    );
  }

  const finish = async () => {
    const db = browserClient();
    if (!db) return setState({ kind: 'error', text: "Sign-in isn't connected on this copy of the site." });
    setState({ kind: 'busy' });
    const { error } = tokenHash
      ? await db.auth.verifyOtp({ token_hash: tokenHash, type })
      : await db.auth.exchangeCodeForSession(code!);
    if (error) return setState({ kind: 'error', text: error.message });
    router.replace(next);
  };

  return (
    <>
      <h1 className="font-display text-2xl">Finish signing in</h1>
      <p className="mt-2 text-muted">One tap and you&apos;re in.</p>
      <button onClick={finish} disabled={state.kind === 'busy'} className="gloss btn-primary mt-5 rounded-full px-6 py-3 font-bold">
        {state.kind === 'busy' ? 'Signing in…' : 'Sign me in'}
      </button>
      {state.kind === 'error' && (
        <p role="status" className="mt-4 rounded-2xl bg-berry-soft px-4 py-3 text-sm text-berry">
          {state.text}. The link may have expired or already been used.{' '}
          <Link href={`/signin?next=${encodeURIComponent(next)}`} className="font-bold underline">Get a new one</Link>.
        </p>
      )}
    </>
  );
}
