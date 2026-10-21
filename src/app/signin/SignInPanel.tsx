'use client';

import { useSearchParams } from 'next/navigation';
import { SignInForm } from '@/components/SignInForm';

export function SignInPanel() {
  const params = useSearchParams();
  const raw = params.get('next');
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  const error = params.get('error');
  return (
    <>
      {error && (
        <p className="mb-4 rounded-2xl bg-berry-soft px-4 py-3 text-sm text-berry">
          That sign-in didn&apos;t go through{error === 'missing-code' ? '' : `: ${error}`}. Links work once and expire after an hour, so try again below.
        </p>
      )}
      <SignInForm next={next} />
    </>
  );
}
