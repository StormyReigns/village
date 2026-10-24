'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, UserPen, X } from 'lucide-react';
import { hasPowers, seenAs, signOut, useAccount, type Villager } from './useVillager';
import { useViewAsSetting } from './viewAs';
import { ModPowers, ViewAsReminder } from './ModPowers';
import { SignInForm } from './SignInForm';
import { Avatar } from './Avatar';

/**
 * "Sign in" when signed out; your avatar with a small menu when signed in. Moderators
 * also get their powers menu beside it, and see what the "see it as" choice shows.
 */
export function AccountButton() {
  const real = useAccount();
  const view = useViewAsSetting();
  if (!hasPowers(real)) return <Account villager={real} />;
  return (
    <div className="flex items-center gap-2">
      <ModPowers view={view} />
      <Account villager={seenAs(real, view)} />
      <ViewAsReminder view={view} />
    </div>
  );
}

function Account({ villager }: { villager: Villager | null | undefined }) {
  const path = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setMenu(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, menu]);

  if (villager === undefined) return <span className="inline-block h-9 w-20 rounded-full bg-card-2" aria-hidden="true" />;

  if (!villager) {
    return (
      <>
        <button onClick={() => setOpen(true)} className="gloss btn-primary rounded-full px-4 py-2 text-sm font-bold">Sign in</button>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(false)}>
            <div role="dialog" aria-modal="true" aria-label="Sign in" onClick={(e) => e.stopPropagation()}
              className="rise w-full max-w-md rounded-t-[2rem] bg-card p-6 shadow-soft sm:rounded-[2rem]">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="font-display text-2xl">Join the village</h2>
                <button onClick={() => setOpen(false)} className="ml-auto grid size-9 place-items-center rounded-full bg-card-2" aria-label="Close"><X size={18} aria-hidden="true" /></button>
              </div>
              <SignInForm next={path} />
            </div>
          </div>
        )}
      </>
    );
  }

  // A new account still has its placeholder name (villager_1a2b3c4d) until they pick one.
  const fresh = villager.username.startsWith('villager_');
  return (
    <div ref={box} className="relative">
      <button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={`Signed in as ${villager.displayName}`}
        className="btn-quiet flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-bold">
        <span className="relative">
          <Avatar name={villager.displayName} url={villager.avatarUrl} />
          {fresh && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-berry ring-2 ring-card" aria-hidden="true" />}
        </span>
        <span className="max-w-28 truncate">{villager.displayName}</span>
      </button>
      {menu && (
        <div className="surface pop absolute right-0 z-40 mt-2 w-56 rounded-2xl p-2 text-sm">
          <p className="px-3 py-2">
            <span className="block font-bold">{villager.displayName}</span>
            <span className="block text-muted">@{villager.username}{villager.isFounder ? ' · Founder' : ''}</span>
          </p>
          <Link href="/me" onClick={() => setMenu(false)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-bold hover:bg-card-2">
            <UserPen size={16} aria-hidden="true" /> {fresh ? 'Choose your name' : 'Your profile'}
            {fresh && <span className="ml-auto size-2 rounded-full bg-berry" aria-hidden="true" />}
          </Link>
          <button onClick={async () => { await signOut(); setMenu(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-bold hover:bg-card-2">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
