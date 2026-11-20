'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, ShieldCheck } from 'lucide-react';
import { GAMES } from '@/data/games';
import { Avatar } from '@/components/Avatar';
import { Tip } from '@/components/Tip';
import { useVillager } from '@/components/useVillager';
import { GameBadges, TitleChip, draftHref, titleOf, useStanding, type Standing, type TheirDraft } from '@/components/profile/standing';
import { browserClient } from '@/lib/supabase/browser';
import { AVATAR_BUCKET, avatarOf } from '@/lib/avatar';

interface Person { id: string; username: string; name: string; avatarUrl: string | null; picture: string | null; isFounder: boolean; joined: string }

/** Who has this username, or null if nobody does (undefined while looking). */
function usePerson(username: string) {
  const [person, setPerson] = useState<Person | null | undefined>(undefined);
  useEffect(() => {
    const db = browserClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- no database configured: nobody to find
    if (!db) { setPerson(null); return; }
    let cancelled = false;
    db.from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle()
      .then(({ data: p }) => {
        if (cancelled) return;
        setPerson(p ? {
          id: p.id as string, username: p.username as string, name: (p.display_name as string) || (p.username as string),
          avatarUrl: avatarOf(p), picture: (p.picture as string) ?? null, isFounder: Boolean(p.is_founder), joined: p.created_at as string,
        } : null);
      });
    return () => { cancelled = true; };
  }, [username]);
  return person;
}

const gameName = (id: string) => GAMES.find((g) => g.id === id)?.shortTitle ?? id;

/** A short list of Drafts: published ones open their entry in the app, others the Draft itself. */
function DraftList({ drafts, data, tag }: { drafts: TheirDraft[]; data: Standing | null; tag: (d: TheirDraft) => React.ReactNode }) {
  return (
    <ul className="mt-3 grid gap-1.5">
      {drafts.map((d) => (
        <li key={d.id}>
          <Link href={draftHref(d, data)} className="flex items-center gap-3 rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line hover:ring-ink">
            <span className="min-w-0 flex-1 truncate font-bold">{d.title}</span>
            <span className="shrink-0 text-xs text-muted">{gameName(d.game_id)}</span>
            {tag(d)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * For moderators: take down someone's picture, with a reason they'll read in their inbox. Their
 * initials show instead, and they can upload another (remove_picture, 20261125000000).
 */
function TakeDown({ person, onDone }: { person: Person; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = browserClient();
    if (!db) return;
    setBusy(true);
    const { error: err } = await db.rpc('remove_picture', { who: person.id, reason });
    if (!err && person.picture && person.picture !== 'none') await db.storage.from(AVATAR_BUCKET).remove([person.picture]);
    setBusy(false);
    // PGRST202: the function isn't there yet (its SQL hasn't been run).
    if (err) setError(err.code === 'PGRST202' ? 'Taking pictures down is almost ready: the database needs one more update.' : err.message);
    else onDone();
  };
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-quiet inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
        <ShieldCheck size={15} aria-hidden="true" /> Take down picture
      </button>
    );
  }
  return (
    <form onSubmit={go} className="grid w-full gap-2 rounded-2xl bg-card-2 p-3 ring-1 ring-line">
      <label className="grid gap-1 text-sm">
        <span className="font-bold">Why? {person.name} will read this in their inbox.</span>
        <input autoFocus value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} maxLength={300}
          placeholder="Not suitable for everyone" className="rounded-2xl bg-card px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-ink" />
      </label>
      {error && <p role="alert" className="text-sm text-berry">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-quiet rounded-full px-4 py-1.5 text-sm font-bold">Cancel</button>
        <button disabled={busy || reason.trim().length < 3} className="btn-primary rounded-full px-4 py-1.5 text-sm font-bold disabled:opacity-60">
          {busy ? 'Taking it down…' : 'Take it down'}
        </button>
      </div>
    </form>
  );
}

/**
 * A villager's public page: who they are, their title and badges, and what they've built. Anyone
 * can open it, signed in or not, by tapping a name in a Workshop chat. Your own shows a way to
 * edit it (on /me, which also has your settings).
 */
export function PublicProfile({ username }: { username: string }) {
  const person = usePerson(username);
  const me = useVillager();
  const [data] = useStanding(person?.id);
  const [joined, setJoined] = useState('');
  // A moderator just took their picture down.
  const [takenDown, setTakenDown] = useState(false);
  // Dates are worked out in the browser, so the page can be prerendered.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- formatting a date in the visitor's language
    if (person) setJoined(new Date(person.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  }, [person]);

  if (person === undefined) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-card" />;
  if (person === null) {
    return (
      <section className="surface mt-6 rounded-2xl p-8 text-center">
        <h1 className="font-display text-3xl">No villager by that name</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">Nobody goes by @{username} here. They may have changed their username.</p>
        <Link href="/" className="btn-quiet mt-5 inline-flex rounded-full px-4 py-2 text-sm font-bold">Village square</Link>
      </section>
    );
  }

  const you = me?.id === person.id;
  const { harvests } = titleOf(data);
  // A removal that went through is a harvest, but not something to show as in the app.
  const shipped = data?.drafts.filter((d) => d.status === 'stable' && d.action !== 'remove') ?? [];
  const waiting = data?.drafts.filter((d) => ['checking', 'open', 'approved', 'preview'].includes(d.status)) ?? [];
  // Hiding the Planted count hides what's waiting from everyone else, not from you.
  const showWaiting = you || !data?.hidePlanted;

  return (
    <div className="mt-4 grid gap-7">
      <section className="surface flex flex-wrap items-center gap-4 rounded-2xl p-5 sm:p-6">
        <Avatar name={person.name} url={takenDown ? null : person.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl leading-tight">{person.name}</h1>
          <p className="text-muted">@{person.username}{joined && ` · in the village since ${joined}`}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <TitleChip data={data} tip="Their title: how long they've been around, then what they've built" />
            {person.isFounder && (
              <Tip text="Matt, who started the village. He earns his title like everyone else" tint="sun">
                <span className="rounded-full bg-sun-soft px-2.5 py-1 text-xs font-bold text-sun">Founder</span>
              </Tip>
            )}
          </p>
        </div>
        {you && (
          <Link href="/me" className="btn-quiet inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
            <Pencil size={15} aria-hidden="true" /> Edit your profile
          </Link>
        )}
        {me?.isModerator && !you && person.avatarUrl && !takenDown && (
          <TakeDown person={person} onDone={() => setTakenDown(true)} />
        )}
      </section>

      {data && (
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            { n: harvests, label: harvests === 1 ? 'change in the app' : 'changes in the app' },
            { n: data.weeks, label: data.weeks === 1 ? 'active week' : 'active weeks' },
            { n: data.votes, label: data.votes === 1 ? 'vote cast' : 'votes cast' },
          ].map((x) => (
            <div key={x.label} className="surface rounded-2xl px-2 py-3">
              <dt className="sr-only">{x.label}</dt>
              <dd><span className="block font-display text-2xl">{x.n}</span><span className="text-xs text-muted">{x.label}</span></dd>
            </div>
          ))}
        </dl>
      )}

      <section className="surface rounded-2xl p-5 sm:p-6">
        <h2 className="font-display text-2xl">Badges</h2>
        {!data ? <p className="mt-3 text-sm text-muted">Loading…</p>
          : <div className="mt-3"><GameBadges data={data} planted={showWaiting} only you={you} /></div>}
        {data && !data.drafts.some((d) => d.status !== 'removed') && (
          <p className="mt-3 text-sm text-muted">{you ? 'You haven’t' : `${person.name} hasn’t`} added to a game yet.</p>
        )}
      </section>

      {shipped.length > 0 && (
        <section className="surface rounded-2xl p-5 sm:p-6">
          <h2 className="font-display text-2xl">In the app</h2>
          <p className="text-sm text-muted">Their newest changes that reached a game&apos;s app.</p>
          <DraftList drafts={shipped.slice(0, 10)} data={data} tag={(d) => data?.live.has(d.id) && (
            <Tip text="This version is the one in the app right now" tint="leaf"><span className="shrink-0 rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-bold text-leaf">Live</span></Tip>
          )} />
        </section>
      )}

      {showWaiting && waiting.length > 0 && (
        <section className="surface rounded-2xl p-5 sm:p-6">
          <h2 className="font-display text-2xl">Waiting in the Workshop</h2>
          <p className="text-sm text-muted">Drafts open for votes. A vote or a source helps them along.</p>
          <DraftList drafts={waiting.slice(0, 10)} data={data} tag={() => <span className="shrink-0 rounded-full bg-sky-soft px-2 py-0.5 text-xs font-bold text-sky">Open</span>} />
        </section>
      )}

      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Village square
      </Link>
    </div>
  );
}
