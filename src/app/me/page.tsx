import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { AccountButton } from '@/components/AccountButton';
import { Profile } from './Profile';

export const metadata: Metadata = { title: 'Your profile', robots: { index: false } };

// Your village profile: name, title (tenure and role), badges, what you've added, settings.
export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Village square
        </Link>
        <AccountButton />
      </div>
      <Profile />
    </main>
  );
}
