'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, CircleAlert, Send, Unplug } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { POST_KINDS, checkWebhook, friendlyError, toHookStatus, type HookStatus } from '@/lib/discord';

// Moderators connect a game to one Discord channel (docs/blocks/discord.md). Shown on the Notice
// Board. The webhook link is a secret: once saved it's never shown again, only "…last 4". The
// database checks the link, keeps it where nobody can read it, and sends the posts itself.

type Load = { state: 'loading' } | { state: 'off' } | { state: 'ready'; hook: HookStatus | null };

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function DiscordCard({ gameId, gameName }: { gameId: string; gameName: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    const db = browserClient();
    if (!db) { setLoad({ state: 'off' }); return; }
    const { data, error: e } = await db.rpc('discord_hook_status', { g: gameId });
    // Before the SQL is run the function isn't there: show nothing rather than a broken card.
    if (e) { setLoad({ state: 'off' }); return; }
    setLoad({ state: 'ready', hook: toHookStatus((data as Record<string, unknown>[] | null)?.[0]) });
  }, [gameId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once from the database
  useEffect(() => { refresh(); }, [refresh]);

  async function call(fn: string, args: Record<string, unknown>, done?: string) {
    const db = browserClient();
    if (!db) return false;
    setBusy(true); setError(''); setNote('');
    const { error: e } = await db.rpc(fn, args);
    setBusy(false);
    if (e) { setError(friendlyError(e)); return false; }
    if (done) setNote(done);
    await refresh();
    return true;
  }

  async function save() {
    const checked = checkWebhook(link);
    if (!checked.ok) { setError(checked.reason); return; }
    if (await call('set_discord_hook', { g: gameId, link: checked.url }, 'Connected. Send a test to see it in your channel.')) {
      setLink(''); setOpen(false);
    }
  }

  if (load.state !== 'ready') return null;
  const hook = load.hook;
  const editing = !hook || open;

  return (
    <section aria-label="Discord" className="surface mt-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Send size={16} className="text-muted" aria-hidden="true" />
        <h3 className="font-bold">Post updates to your Discord</h3>
        {hook && (
          <span className={'rounded-full px-2 py-0.5 text-xs font-bold ' + (hook.status === 'ok' ? 'bg-leaf-soft text-leaf' : 'bg-berry-soft text-berry')}>
            {hook.status === 'ok' ? 'Connected' : 'Not working'} · …{hook.last4}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        When Drafts are published, Village posts one short list to a channel you choose, with links back to the {gameName} app. It waits until things go quiet, so a busy Market Day is one post. It never pings anyone.
      </p>

      {hook && (
        <div className="mt-3 grid gap-2 text-sm">
          {hook.lastError && (
            <p className="flex items-start gap-1.5 rounded-xl bg-berry-soft px-3 py-2 text-berry">
              <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {hook.lastError}
            </p>
          )}
          <p className="text-muted">
            {hook.lastSentAt ? `Last posted ${ago(hook.lastSentAt)}.` : 'Nothing posted yet.'}
          </p>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">What gets posted</legend>
            {POST_KINDS.map((k) => {
              const on = hook.kinds.includes(k.key);
              return (
                <label key={k.key} className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={on} disabled={busy} className="mt-1 size-4 accent-[var(--ink)]"
                    onChange={() => call('set_discord_kinds', { g: gameId, k: on ? hook.kinds.filter((x) => x !== k.key) : [...hook.kinds, k.key] })} />
                  <span><span className="font-bold">{k.label}</span> <span className="text-muted">· {k.hint}</span></span>
                </label>
              );
            })}
          </fieldset>
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" disabled={busy || hook.status !== 'ok'} onClick={() => call('discord_send_test', { g: gameId }, 'Test sent. It shows up in your channel within a minute.')}
              className="btn-primary rounded-full px-3 py-1.5 text-sm font-bold disabled:opacity-50">Send a test</button>
            <button type="button" disabled={busy} onClick={() => { setOpen((o) => !o); setError(''); }}
              className="btn-quiet inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold">
              Use a different link <ChevronDown size={14} className={open ? 'rotate-180' : ''} aria-hidden="true" />
            </button>
            <button type="button" disabled={busy}
              onClick={() => { if (window.confirm('Stop posting to Discord? Village forgets the link.')) call('remove_discord_hook', { g: gameId }, 'Disconnected. Nothing more will be posted.'); }}
              className="btn-quiet inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold">
              <Unplug size={14} aria-hidden="true" /> Disconnect
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 grid gap-2 text-sm">
          <ol className="grid list-decimal gap-0.5 pl-5 text-muted">
            <li>In Discord, open the channel’s settings (the gear by its name).</li>
            <li>Integrations → Webhooks → New Webhook.</li>
            <li>Copy Webhook URL, and paste it here.</li>
          </ol>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label className="sr-only" htmlFor="discord-link">Webhook link</label>
            <input id="discord-link" value={link} onChange={(e) => { setLink(e.target.value); setError(''); }}
              placeholder="https://discord.com/api/webhooks/…" autoComplete="off" spellCheck={false}
              className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-signal" />
            <button type="submit" disabled={busy || !link.trim()} className="btn-primary rounded-full px-4 py-2 font-bold disabled:opacity-50">
              {hook ? 'Replace' : 'Connect'}
            </button>
          </form>
          <p className="text-xs text-muted">Keep this link private: anyone who has it can post in that channel. Once saved, Village never shows it again, not even to moderators.</p>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-sm font-bold text-berry">{error}</p>}
      {note && <p role="status" className="mt-2 flex items-center gap-1.5 text-sm font-bold text-leaf"><Check size={14} aria-hidden="true" /> {note}</p>}
    </section>
  );
}
