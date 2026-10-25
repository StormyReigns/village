import type { Metadata } from 'next';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
import { Profile } from './Profile';

export const metadata: Metadata = { title: 'Your profile', robots: { index: false } };

// Your village profile: name, title (tenure and role), badges, what you've added, settings.
export default function ProfilePage() {
  return (
    <>
      <TopBar actions={<AccountButton quiet dark />} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <Profile />
      </main>
    </>
  );
}
