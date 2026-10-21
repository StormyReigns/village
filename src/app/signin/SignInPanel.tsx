'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignInForm } from '@/components/SignInForm';

export function SignInPanel() {
  const params = useSearchParams();
  const raw = params.get('next');
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  const [error, setError] = useState(params.get('error'));

  // Some failed links put Supabase's reason after a "#" instead, which servers never see.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const reason = hash.get('error_description') || hash.get('error_code');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL fragment after hydration
    if (reason) setError(reason);
  }, []);

  return (
    <>
      {error && (
        <p className="mb-4 rounded-2xl bg-berry-soft px-4 py-3 text-sm text-berry">
          That sign-in didn&apos;t go through
          {error === 'missing-code' ? ': the link came back without its one-time code.' : `: ${error}.`}{' '}
          Links work once, in the same browser you asked from, and expire after an hour. Try again below.
        </p>
      )}
      <SignInForm next={next} />
    </>
  );
}
