'use client';

import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import type { Villager } from './useVillager';

/** Tells every account button on the page to reload the profile after a change. */
export const PROFILE_CHANGED = 'village:profile-changed';

const field = 'w-full rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky';

/** Choose the name others see, and your @username. Used on the profile page. */
export function ProfileForm({ villager, onSaved }: { villager: Villager; onSaved?: () => void }) {
  const fresh = villager.username.startsWith('villager_');
  const [name, setName] = useState(villager.displayName);
  const [username, setUsername] = useState(fresh ? '' : villager.username);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const display = name.trim();
    const handle = username.trim().toLowerCase();
    if (display.length < 1 || display.length > 40) return setNote({ ok: false, text: 'Your name needs 1 to 40 characters.' });
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) return setNote({ ok: false, text: 'Usernames are 3 to 24 letters, numbers or underscores, like lettuce_lena.' });
    const db = browserClient();
    if (!db) return setNote({ ok: false, text: "Couldn't reach the village. Try again in a moment." });
    setBusy(true);
    const { error } = await db.from('profiles').update({ display_name: display, username: handle }).eq('id', villager.id);
    setBusy(false);
    if (error) return setNote({ ok: false, text: /duplicate|unique/i.test(error.message) ? 'That username is taken. Try another.' : error.message });
    setNote({ ok: true, text: 'Saved.' });
    window.dispatchEvent(new Event(PROFILE_CHANGED));
    onSaved?.();
  };

  return (
    <form onSubmit={save} className="grid gap-3">
      {fresh && <p className="text-sm text-muted">Right now you show up as @{villager.username}. Pick how other villagers will know you.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-bold">Name</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setNote(null); }} maxLength={40} placeholder="Lena" className={field} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold">Username</span>
          <span className="flex items-center gap-1 rounded-2xl bg-card-2 pl-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
            <span className="text-muted">@</span>
            <input value={username} onChange={(e) => { setUsername(e.target.value.toLowerCase()); setNote(null); }} maxLength={24} placeholder="lettuce_lena"
              className="min-w-0 flex-1 bg-transparent py-2 pr-3 outline-none placeholder:text-muted" />
          </span>
        </label>
      </div>
      <p className="text-xs text-muted">Usernames are letters, numbers and underscores. They show on your Drafts and messages.</p>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-full bg-leaf px-5 py-2 font-bold text-paper hover:opacity-90 disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
        {note && <p role="status" className={'text-sm ' + (note.ok ? 'text-leaf' : 'text-berry')}>{note.text}</p>}
      </div>
    </form>
  );
}
