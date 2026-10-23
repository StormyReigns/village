'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import type { Villager } from './useVillager';

/** Tells every account button on the page to reload the profile after a change. */
export const PROFILE_CHANGED = 'village:profile-changed';

const field = 'w-full rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky';

/** Choose the name others see, and your @username. */
export function ProfileDialog({ villager, onClose }: { villager: Villager; onClose: () => void }) {
  const fresh = villager.username.startsWith('villager_');
  const [name, setName] = useState(villager.displayName);
  const [username, setUsername] = useState(fresh ? '' : villager.username);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const display = name.trim();
    const handle = username.trim().toLowerCase();
    if (display.length < 1 || display.length > 40) return setNote('Your name needs 1 to 40 characters.');
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) return setNote('Usernames are 3 to 24 letters, numbers or underscores, like lettuce_lena.');
    const db = browserClient();
    if (!db) return setNote("Couldn't reach the village. Try again in a moment.");
    setBusy(true);
    const { error } = await db.from('profiles').update({ display_name: display, username: handle }).eq('id', villager.id);
    setBusy(false);
    if (error) return setNote(/duplicate|unique/i.test(error.message) ? 'That username is taken. Try another.' : error.message);
    window.dispatchEvent(new Event(PROFILE_CHANGED));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Your name" onClick={(e) => e.stopPropagation()}
        className="rise w-full max-w-md rounded-t-[2rem] bg-card p-6 shadow-soft outline-none sm:rounded-[2rem]">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-2xl">{fresh ? 'Choose your name' : 'Your name'}</h2>
          <button onClick={onClose} className="ml-auto grid size-9 place-items-center rounded-full bg-card-2" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        {fresh && <p className="mb-3 text-sm text-muted">Right now you show up as @{villager.username}. Pick how other villagers will know you.</p>}
        <form onSubmit={save} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-bold">Name</span>
            <input value={name} onChange={(e) => { setName(e.target.value); setNote(''); }} maxLength={40} placeholder="Lena" className={field} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-bold">Username</span>
            <span className="flex items-center gap-1 rounded-2xl bg-card-2 pl-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
              <span className="text-muted">@</span>
              <input value={username} onChange={(e) => { setUsername(e.target.value.toLowerCase()); setNote(''); }} maxLength={24} placeholder="lettuce_lena"
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 outline-none placeholder:text-muted" />
            </span>
            <span className="text-xs text-muted">Letters, numbers and underscores. Shown on your Drafts and messages.</span>
          </label>
          <div className="mt-1 flex items-center gap-3">
            <button disabled={busy} className="rounded-full bg-leaf px-5 py-2.5 font-bold text-paper hover:opacity-90 disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2.5 font-bold text-muted hover:text-ink">Cancel</button>
          </div>
          {note && <p role="status" className="text-sm text-berry">{note}</p>}
        </form>
      </div>
    </div>
  );
}
