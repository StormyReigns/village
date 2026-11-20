import type { Metadata } from 'next';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
import { InboxPage } from './InboxPage';

export const metadata: Metadata = { title: 'Inbox', robots: { index: false } };

// Your whole inbox (docs/inbox.md): the bell in the top bar is the quick look, this is everything.
export default function Inbox() {
  return (
    <>
      <TopBar actions={<AccountButton quiet dark />} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <InboxPage />
      </main>
    </>
  );
}
