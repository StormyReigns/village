import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
import { PublicProfile } from './PublicProfile';

export async function generateMetadata({ params }: PageProps<'/u/[username]'>): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}`, robots: { index: false } };
}

const shell = 'mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6';

// A villager's public page (/u/lettuce_lena): their title, badges and what they've built.
// The URL (and the top bar, which reads it) load inside <Suspense> so the shell shows at once.
export default function VillagerPage({ params }: PageProps<'/u/[username]'>) {
  return (
    <Suspense fallback={<><TopBar /><main className={shell}><div className="mt-6 h-64 animate-pulse rounded-2xl bg-card" /></main></>}>
      <Loaded params={params} />
    </Suspense>
  );
}

async function Loaded({ params }: { params: PageProps<'/u/[username]'>['params'] }) {
  const { username } = await params;
  return (
    <>
      <TopBar actions={<AccountButton quiet dark />} />
      <main className={shell}>
        <PublicProfile username={decodeURIComponent(username)} />
      </main>
    </>
  );
}
