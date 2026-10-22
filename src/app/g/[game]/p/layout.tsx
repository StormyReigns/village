import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, Hammer, Sparkles } from 'lucide-react';
import { AccountButton } from '@/components/AccountButton';

// The new game app (Pages made of Blocks), shown as a preview beside the current one.
export default function AppLayout({ children, params }: LayoutProps<'/g/[game]/p'>) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Village square
        </Link>
        <div className="flex items-center gap-2">
          <Suspense fallback={<span className="h-9 w-28 rounded-full bg-card-2" />}>
            <WorkshopLink params={params} />
          </Suspense>
          <AccountButton />
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 rounded-2xl bg-sun-soft px-4 py-2 text-sm">
        <Sparkles size={16} className="shrink-0 text-sun" aria-hidden="true" />
        Preview of the new app layout.
      </p>
      {children}
    </main>
  );
}

async function WorkshopLink({ params }: { params: LayoutProps<'/g/[game]/p'>['params'] }) {
  const { game } = await params;
  return (
    <Link href={`/g/${game}/workshop`} className="btn-quiet inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
      <Hammer size={16} className="text-leaf" aria-hidden="true" /> Workshop
    </Link>
  );
}
