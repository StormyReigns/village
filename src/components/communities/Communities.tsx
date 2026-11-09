'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ExternalLink, Flag, Globe, MoreHorizontal, ThumbsDown, ThumbsUp, Trash2, Users, X } from 'lucide-react';
import { useVillager, canModerate } from '@/components/useVillager';
import { SignInPrompt } from '@/components/SignInPrompt';
import {
  INVITE_REASONS, countsText, iconUrl, initials, inviteUrl, readPaste, shortAddress, voteText, type InviteInfo,
} from '@/lib/communities';
import { lookOf, useCommunities, type CommunitiesData, type Community, type Look } from './useCommunities';

// Communities on a game's home (docs/blocks/discord.md, part 2): the Discord servers and other
// places players gather, best first. A Discord server shows Discord's own name, icon and counts;
// a plain link shows its typed name and address. Listing needs a moderator's approval.

/** A sheet over the page: from the bottom on phones, centered on computers. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[2rem] bg-card shadow-soft sm:rounded-[2rem]">
        <div className="flex items-center gap-3 px-5 pb-2 pt-5">
          <h2 className="min-w-0 flex-1 font-display text-2xl leading-tight">{label}</h2>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

/** A server's icon (a rounded square: servers aren't entries, so never a piece), or initials. */
function ServerIcon({ look, kind, name, size = 48 }: { look: Look | null; kind: Community['kind']; name: string; size?: number }) {
  const info = look && typeof look === 'object' && look.ok ? look : null;
  const src = info ? iconUrl(info, 96) : null;
  const box = 'grid shrink-0 place-items-center overflow-hidden rounded-xl';
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- Discord's own image server, small and fixed size
    return <img src={src} alt="" width={size} height={size} loading="lazy" className={box} style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" className={`${box} bg-ink font-display text-white`} style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {kind === 'link' ? <Globe size={size * 0.45} /> : look === 'loading' ? '' : initials(name)}
    </span>
  );
}

/** What a listing shows, from Discord for servers and from the listing for links. */
function view(c: Community, look: Look | null) {
  const info: Extract<InviteInfo, { ok: true }> | null = look && typeof look === 'object' && look.ok ? look : null;
  if (c.kind === 'link') return { name: c.name ?? shortAddress(c.url ?? ''), sub: shortAddress(c.url ?? ''), href: c.url ?? '#', action: 'Visit', verified: false };
  return {
    name: info?.name ?? c.name ?? 'Discord server', sub: info ? countsText(info.members, info.online) : 'Discord server',
    href: inviteUrl(c.invite ?? ''), action: 'Join', verified: Boolean(info?.verified),
  };
}

function Row({ c, look, children }: { c: Community; look: Look | null; children?: React.ReactNode }) {
  const v = view(c, look);
  return (
    <div className="flex items-start gap-3">
      <ServerIcon look={look} kind={c.kind} name={v.name} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 font-bold leading-tight">
          <span className="min-w-0 break-words">{v.name}</span>
          {v.verified && <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-soft px-1.5 py-0.5 text-[11px] font-bold text-sky"><BadgeCheck size={12} aria-hidden="true" /> Official</span>}
        </p>
        <p className="text-xs text-muted">{v.sub}</p>
        <p className="mt-0.5 text-sm">{c.pitch}</p>
        {children}
      </div>
      <a href={v.href} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${v.action} ${v.name} (opens ${c.kind === 'discord' ? 'Discord' : 'the site'})`}
        className="btn-primary inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold">
        {v.action} <ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>
  );
}

const REPORTS = [
  { key: 'wrong', label: 'Dead link or not about this game' },
  { key: 'spam', label: 'Spam or an advert' },
  { key: 'rude', label: 'Rude or unsafe' },
  { key: 'other', label: 'Something else' },
] as const;

/** Recommend, Not for me, and a "⋯" for reporting or taking it down. */
function Votes({ c, data, meId, mod }: { c: Community; data: CommunitiesData; meId: string | null; mod: boolean }) {
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState('');
  const mine = data.mine.get(c.id);
  const own = c.listedBy === meId;
  const tally = voteText(c.ups, c.downs);
  const btn = (on: boolean) => 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ' + (on ? 'bg-signal text-ink' : 'btn-quiet');
  return (
    <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
      {own ? <span className="text-xs text-muted">You listed this</span> : meId ? (
        <>
          <button type="button" aria-pressed={mine === 1} onClick={() => data.vote(c.id, 1)} className={btn(mine === 1)}><ThumbsUp size={12} aria-hidden="true" /> Recommend</button>
          <button type="button" aria-pressed={mine === -1} onClick={() => data.vote(c.id, -1)} className={btn(mine === -1)}><ThumbsDown size={12} aria-hidden="true" /> Not for me</button>
        </>
      ) : null}
      <span className="text-xs text-muted">{tally ?? (c.ups + c.downs > 0 ? 'A few votes so far' : '')}</span>
      {meId && (
        <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="More" className="ml-auto grid size-7 place-items-center rounded-full text-muted hover:bg-card-2">
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      )}
      {note && <span role="status" className="w-full text-xs font-bold text-leaf">{note}</span>}
      {menu && (
        <div className="pop absolute right-0 top-8 z-10 grid w-64 gap-0.5 rounded-2xl bg-card p-1.5 text-sm">
          {(own || mod) && (
            <button type="button" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left font-bold text-berry hover:bg-card-2"
              onClick={async () => { if (!window.confirm('Take this listing down?')) return; setMenu(false); const e = await data.remove(c.id); setNote(e ?? ''); }}>
              <Trash2 size={14} aria-hidden="true" /> {mod && !own ? 'Take it down' : 'Remove my listing'}
            </button>
          )}
          {!own && <p className="flex items-center gap-1.5 px-2.5 pt-1 text-xs font-bold uppercase tracking-wide text-muted"><Flag size={12} aria-hidden="true" /> Report</p>}
          {!own && REPORTS.map((r) => (
            <button key={r.key} type="button" className="rounded-xl px-2.5 py-1.5 text-left hover:bg-card-2"
              onClick={async () => { setMenu(false); const e = await data.report(c.id, r.key); setNote(e ?? 'Reported. A moderator will look.'); }}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The card on a game's home: the top three, "See all", and "List yours". */
export function CommunitiesCard({ gameId, gameName }: { gameId: string; gameName: string }) {
  const me = useVillager();
  const meId = me?.id ?? null;
  const data = useCommunities(gameId, meId);
  const [sheet, setSheet] = useState<'all' | 'list' | null>(null);
  if (!data.ready || data.missing) return null;
  const top = data.shown.slice(0, 3);

  return (
    <section aria-label="Communities" className="surface rounded-2xl p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        <Users size={13} aria-hidden="true" /> Communities
      </p>
      {top.length === 0 ? (
        <p className="mt-2 text-sm">
          Got a Discord or a subreddit for {gameName}?{' '}
          <button type="button" onClick={() => setSheet('list')} className="font-bold underline">List it</button>
        </p>
      ) : (
        <>
          <ul className="mt-3 grid gap-4">
            {top.map((c) => <li key={c.id}><Row c={c} look={data.lookFor(c)} /></li>)}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
            <button type="button" onClick={() => setSheet('all')} className="underline">
              {data.shown.length > 3 ? `See all ${data.shown.length}` : 'Recommend or report'}
            </button>
            <button type="button" onClick={() => setSheet('list')} className="text-muted underline">List your community</button>
          </div>
        </>
      )}
      {sheet === 'all' && <AllSheet data={data} gameId={gameId} gameName={gameName} meId={meId} mod={canModerate(me, gameId)} onList={() => setSheet('list')} onClose={() => setSheet(null)} />}
      {sheet === 'list' && <ListSheet data={data} gameName={gameName} meId={meId} onClose={() => setSheet(null)} />}
    </section>
  );
}

function AllSheet({ data, gameName, meId, mod, onList, onClose }: {
  data: CommunitiesData; gameId: string; gameName: string; meId: string | null; mod: boolean; onList: () => void; onClose: () => void;
}) {
  const yours = data.all.filter((c) => c.listedBy === meId && c.status !== 'live');
  return (
    <Sheet label={`${gameName} communities`} onClose={onClose}>
      <p className="text-sm text-muted">Where players hang out, best first. Recommend the ones you like.</p>
      <ul className="mt-4 grid gap-5">
        {data.shown.map((c) => (
          <li key={c.id}><Row c={c} look={data.lookFor(c)}><Votes c={c} data={data} meId={meId} mod={mod} /></Row></li>
        ))}
      </ul>
      {yours.length > 0 && (
        <div className="mt-5 grid gap-2 border-t border-line pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Your listings</p>
          {yours.map((c) => (
            <p key={c.id} className="text-sm">
              <span className="font-bold">{c.name ?? c.invite ?? c.url}</span>{' '}
              {c.status === 'waiting' ? <span className="text-muted">· waiting for a moderator</span>
                : <span className="text-berry">· not listed{c.declineReason ? `: ${c.declineReason}` : ''}</span>}
            </p>
          ))}
        </div>
      )}
      <button type="button" onClick={onList} className="btn-primary mt-5 rounded-full px-4 py-2 text-sm font-bold">List your community</button>
    </Sheet>
  );
}

/** Paste an invite or link, see it as it will look, add a one-line pitch, send for approval. */
function ListSheet({ data, gameName, meId, onClose }: { data: CommunitiesData; gameName: string; meId: string | null; onClose: () => void }) {
  const [paste, setPaste] = useState('');
  const [name, setName] = useState('');
  const [pitch, setPitch] = useState('');
  const [look, setLook] = useState<Look | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const read = readPaste(paste);
  const code = read.kind === 'discord' ? read.invite : '';
  const asked = useRef('');

  // Ask Discord about the invite as soon as one is pasted.
  useEffect(() => {
    asked.current = code;
    /* eslint-disable react-hooks/set-state-in-effect -- shows "loading" while Discord answers */
    if (!code) { setLook(null); return; }
    setLook('loading');
    /* eslint-enable react-hooks/set-state-in-effect */
    lookOf(code).then((l) => { if (asked.current === code) setLook(l); });
  }, [code]);

  if (sent) {
    return (
      <Sheet label="Sent for approval" onClose={onClose}>
        <p className="text-sm">A moderator will look at it soon. You’ll hear in your inbox (the bell at the top) when it’s listed.</p>
        <button type="button" onClick={onClose} className="btn-primary mt-4 rounded-full px-4 py-2 text-sm font-bold">Done</button>
      </Sheet>
    );
  }

  const info = look && typeof look === 'object' ? look : null;
  const ready = pitch.trim().length >= 3 && (
    (read.kind === 'discord' && info?.ok) || (read.kind === 'link' && name.trim().length >= 2));
  const preview: Community | null = read.kind === 'bad' ? null : {
    id: 'preview', gameId: '', kind: read.kind, invite: read.kind === 'discord' ? read.invite : null,
    url: read.kind === 'link' ? read.url : null, name: name.trim() || null, pitch: pitch.trim() || 'Your one line goes here',
    listedBy: '', status: 'waiting', declineReason: null, createdAt: '', ups: 0, downs: 0,
  };

  async function send() {
    if (!ready) return;
    setBusy(true); setError('');
    const e = await data.submit(read.kind === 'discord'
      ? { kind: 'discord', invite: read.invite, name: info?.ok ? info.name : '', pitch }
      : { kind: 'link', url: read.url, name, pitch });
    setBusy(false);
    if (e) setError(e); else setSent(true);
  }

  return (
    <Sheet label="List your community" onClose={onClose}>
      <p className="text-sm text-muted">A Discord server, a subreddit or a forum for {gameName}. A moderator checks it before it shows.</p>
      <label className="mt-4 block text-sm font-bold" htmlFor="community-link">Discord invite or link</label>
      <input id="community-link" value={paste} onChange={(e) => { setPaste(e.target.value); setError(''); }} autoComplete="off" spellCheck={false}
        placeholder="discord.gg/… or https://reddit.com/r/…"
        className="mt-1 w-full rounded-xl bg-card px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-signal" />
      {paste.trim() && read.kind === 'bad' && <p className="mt-1 text-sm text-berry">{read.reason}</p>}
      {read.kind === 'discord' && <p className="mt-1 text-xs text-muted">Use an invite that never expires: Invite People → Edit invite link → Expire after: Never.</p>}
      {read.kind === 'discord' && look === 'unreachable' && <p className="mt-1 text-sm text-berry">Couldn’t reach Discord. Try again in a minute.</p>}
      {read.kind === 'discord' && info && !info.ok && <p className="mt-1 text-sm text-berry">{INVITE_REASONS[info.reason]}</p>}

      {read.kind === 'link' && (
        <>
          <label className="mt-3 block text-sm font-bold" htmlFor="community-name">Its name</label>
          <input id="community-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="r/FortunesWeave"
            className="mt-1 w-full rounded-xl bg-card px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-signal" />
        </>
      )}
      {read.kind !== 'bad' && (
        <>
          <label className="mt-3 block text-sm font-bold" htmlFor="community-pitch">One line about it</label>
          <input id="community-pitch" value={pitch} maxLength={100} onChange={(e) => setPitch(e.target.value)} placeholder="Co-op runs every Friday, spoiler-free channels"
            className="mt-1 w-full rounded-xl bg-card px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-signal" />
          <p className="mt-0.5 text-right text-xs text-muted">{pitch.length}/100</p>
        </>
      )}

      {preview && (read.kind === 'link' || info?.ok) && (
        <div className="mt-3 rounded-2xl bg-card-2 p-3 ring-1 ring-line">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Is this the one?</p>
          <Row c={preview} look={look} />
        </div>
      )}

      <div className="mt-4">
        {meId ? (
          <button type="button" disabled={!ready || busy} onClick={send} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">
            {busy ? 'Sending…' : 'Send for approval'}
          </button>
        ) : <SignInPrompt forWhat="list your community">Sign in to send it</SignInPrompt>}
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-bold text-berry">{error}</p>}
    </Sheet>
  );
}

export { Row as CommunityRow };
