// Discord, the plain parts (docs/blocks/discord.md): checking a webhook address before it's
// saved, and what moderators see about one afterwards. The database checks the address again
// (public.set_discord_hook) and builds and sends the posts itself, so the link never leaves it.

/** Hosts Discord serves webhooks from. All are saved as discord.com. */
const HOSTS = ['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'];

/** Mirrors the check in public.set_discord_hook: https, a Discord host, /api/webhooks/<id>/<token>. */
const WEBHOOK = /^\/api\/(?:v\d+\/)?webhooks\/(\d{17,20})\/([A-Za-z0-9_-]{60,100})\/?$/;

export type WebhookCheck = { ok: true; url: string } | { ok: false; reason: string };

/** Reads a pasted webhook link. Returns the tidy address to save, or a plain reason it's not one. */
export function checkWebhook(raw: string): WebhookCheck {
  const text = raw.trim();
  if (!text) return { ok: false, reason: 'Paste the webhook link from Discord.' };
  let u: URL;
  try { u = new URL(text); } catch { return { ok: false, reason: 'That isn’t a link. Copy it with Discord’s “Copy Webhook URL” button.' }; }
  if (u.protocol !== 'https:' || !HOSTS.includes(u.hostname.toLowerCase())) {
    return { ok: false, reason: 'That isn’t a Discord link. It should start with https://discord.com/api/webhooks/' };
  }
  const m = WEBHOOK.exec(u.pathname);
  if (!m) {
    if (u.pathname.startsWith('/invite') || u.hostname === 'discord.gg') return { ok: false, reason: 'That’s an invite link. You need the channel’s webhook link (see the steps above).' };
    return { ok: false, reason: 'That Discord link isn’t a webhook. It should look like https://discord.com/api/webhooks/123…/abc…' };
  }
  return { ok: true, url: `https://discord.com/api/webhooks/${m[1]}/${m[2]}` };
}

/** What gets posted. Keys match public.discord_hooks.kinds. */
export const POST_KINDS = [
  { key: 'published', label: 'New in the app', hint: 'Published Drafts, gathered into one post when things go quiet' },
] as const;

export type PostKind = (typeof POST_KINDS)[number]['key'];

/** What moderators are told about a saved webhook (public.discord_hook_status). */
export interface HookStatus {
  last4: string;
  kinds: string[];
  status: 'ok' | 'broken';
  lastError: string | null;
  lastSentAt: string | null;
  updatedAt: string;
}

export function toHookStatus(r: Record<string, unknown> | null | undefined): HookStatus | null {
  if (!r || !r.last4) return null;
  return {
    last4: String(r.last4), kinds: Array.isArray(r.kinds) ? (r.kinds as string[]) : [],
    status: r.status === 'broken' ? 'broken' : 'ok', lastError: (r.last_error as string) ?? null,
    lastSentAt: (r.last_sent_at as string) ?? null, updatedAt: String(r.updated_at ?? ''),
  };
}

/** Database errors raised on purpose read as plain sentences; anything else gets a general one. */
export function friendlyError(e: { message?: string; code?: string } | null): string {
  if (!e) return '';
  if (e.code === 'P0001' && e.message) return e.message;
  if (e.code === 'PGRST202' || /discord_/.test(e.message ?? '') && /does not exist|Could not find/.test(e.message ?? '')) {
    return 'Discord posting isn’t switched on yet (its SQL hasn’t been run).';
  }
  return 'Something went wrong. Try again in a minute.';
}
