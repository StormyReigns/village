import Link from 'next/link';
import { Compass } from 'lucide-react';
import { TopBar } from '@/components/Logo';

export default function NotFound() {
  return (
    <>
    <TopBar />
    <main className="mx-auto grid w-full max-w-md flex-1 place-items-center px-4 py-16">
      <div className="surface grid justify-items-center gap-3 rounded-2xl p-8 text-center">
        <span className="gloss grid size-14 place-items-center rounded-2xl bg-sky text-white"><Compass aria-hidden="true" /></span>
        <h1 className="font-display text-3xl">This path leads nowhere</h1>
        <p className="text-muted">That page isn&apos;t in the village. It may have moved, or the game isn&apos;t here yet.</p>
        <Link href="/" className="gloss btn-primary mt-2 rounded-full px-5 py-2.5 font-bold">Back to the village square</Link>
      </div>
    </main>
    </>
  );
}
