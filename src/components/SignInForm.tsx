'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';

function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Discord sign-in, plus an emailed one-time link. Used in the pop-up and on /signin. */
/** Asks Supabase which sign-in methods are switched on (a public settings endpoint). */
async function discordEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    const json = await res.json();
    return Boolean(json?.external?.discord);
  } catch {
    return true; // can't tell: let Supabase decide
  }
}

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'sent' | 'error'; text?: string }>({ kind: 'idle' });

  const discord = async () => {
    const db = browserClient();
    if (!db) return setStatus({ kind: 'error', text: "Sign-in isn't connected on this copy of the site." });
    setStatus({ kind: 'busy' });
    if (!(await discordEnabled())) return setStatus({ kind: 'error', text: "Discord sign-in isn't switched on yet. Use the email link for now." });
    const { error } = await db.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: callbackUrl(next) } });
    if (error) setStatus({ kind: 'error', text: /not enabled|provider/i.test(error.message) ? "Discord sign-in isn't switched on yet. Use the email link for now." : error.message });
  };

  const emailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setStatus({ kind: 'error', text: 'Enter your email address, like name@example.com.' });
    const db = browserClient();
    if (!db) return setStatus({ kind: 'error', text: "Sign-in isn't connected on this copy of the site." });
    setStatus({ kind: 'busy' });
    const { error } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callbackUrl(next) } });
    if (error) setStatus({ kind: 'error', text: /rate limit/i.test(error.message) ? 'Too many links sent recently. Try again in a little while.' : error.message });
    else setStatus({ kind: 'sent', text: `Check ${email.trim()} for a sign-in link. It works once, on this device.` });
  };

  return (
    <div className="grid gap-4">
      <button onClick={discord} disabled={status.kind === 'busy'}
        className="gloss rounded-full bg-[#5865F2] px-5 py-3 font-bold text-white shadow-soft hover:brightness-105">
        Continue with Discord
      </button>
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={emailLink} className="grid gap-2">
        <label htmlFor="signin-email" className="text-sm font-bold">Email me a sign-in link</label>
        <div className="flex gap-2">
          <input id="signin-email" type="email" autoComplete="email" value={email}
            onChange={(e) => { setEmail(e.target.value); if (status.kind === 'error') setStatus({ kind: 'idle' }); }}
            placeholder="name@example.com" aria-invalid={status.kind === 'error' || undefined}
            className="min-w-0 flex-1 rounded-full bg-card-2 px-4 py-2.5 outline-none ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-sky" />
          <button disabled={status.kind === 'busy'} className="btn-quiet inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-bold">
            <Mail size={16} aria-hidden="true" /> Send
          </button>
        </div>
      </form>
      {status.text && (
        <p role="status" className={'rounded-2xl px-4 py-3 text-sm ' + (status.kind === 'error' ? 'bg-berry-soft text-berry' : 'bg-leaf-soft text-leaf')}>{status.text}</p>
      )}
      <p className="text-xs text-muted">Signing in makes you a villager. You can chat, vote and post Drafts, and your contributions earn credit.</p>
    </div>
  );
}
