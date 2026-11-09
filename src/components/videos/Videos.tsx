'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Flag, PictureInPicture2, Play, Plus, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react';
import { useVillager } from '@/components/useVillager';
import { REMOVAL_NOTE, deleteMinutesLeft, embedUrl, formatTime, parseTime, parseVideoLink, tallyText, thumbUrl, watchUrl, type VideoInfo, type VideoLink } from '@/lib/videos';
import { fetchVideoInfo, useVideoInfo, useVideoInfos, useVideos, type LiveVideo } from './useVideos';
import { addSlot, play, removeSlot, setMode, stop, useDock } from './dock';

// Videos on an entry (docs/blocks/videos.md). They play in YouTube's own privacy-enhanced
// player, only after a tap, and every one says who made it, as YouTube says. Two sizes:
//   big    an open guide: the top video as a big card ("See it done"), then the rest
//   small  a character's or item's card, or the entry panel: small rows; tapping one plays it
//          full width in place
// One video plays at a time, in the site's one player (VideoDock), which sits over the video's
// spot and pops out to a corner when you scroll away or tap "Pop out".

const REASONS = [
  { key: 'wrong', label: 'Wrong or out of date' },
  { key: 'spoiler', label: 'Unmarked spoiler' },
  { key: 'spam', label: 'Spam or off topic' },
  { key: 'rude', label: 'Rude or hurtful' },
  { key: 'other', label: 'Something else' },
];

/** The entry's id in the database. Cards are handed entries as EntryContent, but in the app it's
 *  the live Entry with its ref; samples and Workshop previews have none, so they show no videos. */
export const cardIdOf = (entry: object) => ('ref' in entry ? (entry as { ref?: { card?: string } }).ref?.card : undefined);

/** How many rows a small part shows before "N more". */
const SMALL_SHOWN = 3;

export function Videos({ cardId, size, name, label, color, className = '' }: {
  /** The entry's id in the database. Samples and starter entries without one show nothing. */
  cardId?: string;
  size: 'big' | 'small';
  /** The entry's name, for "Add a video about Cai". */
  name: string;
  /** The part's heading. */
  label?: string;
  /** The heading's color: the Page color on cards, like their other parts. */
  color?: string;
  className?: string;
}) {
  const me = useVillager();
  const data = useVideos(cardId, me?.id);
  const dock = useDock();
  const [more, setMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const infos = useVideoInfos(data.videos.map((v) => v.youtubeId));
  if (!cardId || data.state === 'missing' || data.state === 'offline') return null;
  // A video YouTube says is gone or blocked isn't shown, so the next one moves up.
  const videos = data.videos.filter((v) => !gone(infos[v.youtubeId]));
  // Nothing yet while loading, so the card doesn't show "Add a video" and then jump.
  if (data.state === 'loading') return null;

  const heading = label ?? (size === 'big' ? 'See it done' : 'Videos');
  // Moderators take any video down; whoever added it gets their first hour (VideoCard).
  const canRemove = (v: LiveVideo) => Boolean(me && me.isModerator && (me.modGames.includes(null) || me.modGames.includes(v.gameId)));
  const shared = { me, data, canRemove };

  const top = videos[0];
  const rest = size === 'big' ? videos.slice(1) : videos;
  const shownRest = size === 'big' ? (more ? rest : []) : (more ? rest : rest.slice(0, SMALL_SHOWN));
  const hidden = rest.length - shownRest.length;

  return (
    <section aria-label={heading} className={'grid gap-2 ' + className}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted" style={color ? { color } : undefined}>{heading}</h3>
      {size === 'big' && top && <VideoCard v={top} {...shared} />}
      {shownRest.length > 0 && (
        <ul className="grid gap-2">
          {shownRest.map((v) => (
            <li key={v.id}>
              {dock.now?.id === v.id ? <VideoCard v={v} {...shared} onClose={stop} /> : <VideoRow v={v} />}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {hidden > 0 && (
          <button type="button" onClick={() => setMore(true)} className="btn-quiet rounded-full px-3 py-1.5 text-sm font-bold">
            {hidden} more {hidden === 1 ? 'video' : 'videos'}
          </button>
        )}
        <button type="button" onClick={() => setAdding(true)}
          className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ' + (videos.length ? 'text-muted hover:text-ink' : 'btn-quiet')}>
          <Plus size={14} aria-hidden="true" /> Add a video
        </button>
      </div>
      {adding && <AddVideo name={name} signedIn={Boolean(me)} already={videos.map((v) => v.youtubeId)} onAdd={data.add} onClose={() => setAdding(false)} />}
    </section>
  );
}

type Shared = { me: ReturnType<typeof useVillager>; data: ReturnType<typeof useVideos>; canRemove: (v: LiveVideo) => boolean };

/** The thumbnail with a play button. Once tapped, the site's one player (VideoDock) sits over
 *  this spot; while it's in the corner, the spot says so and can bring it back. */
function Player({ v, title }: { v: LiveVideo; title: string }) {
  const dock = useDock();
  const playing = dock.now?.id === v.id;
  // React 19 ref cleanup: the spot is handed to the player while it's on the page.
  const slot = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    addSlot(el);
    return () => removeSlot(el);
  }, []);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink">
      {playing && !dock.host ? (
        // No VideoDock on this page: play in place, as before.
        <iframe src={embedUrl(v.youtubeId, v.start)} title={title} className="absolute inset-0 size-full" loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : playing ? (
        <div ref={slot} className="absolute inset-0">
          {dock.mode !== 'inline' && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail, shown as YouTube serves it */}
              <img src={thumbUrl(v.youtubeId)} alt="" className="size-full object-cover opacity-30" />
              <span className="absolute inset-0 grid place-content-center justify-items-center gap-2 p-3 text-center text-paper">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold"><PictureInPicture2 size={16} aria-hidden="true" /> Playing in the corner</span>
                <button type="button" onClick={() => setMode('inline')} className="btn-primary rounded-full px-3 py-1.5 text-sm font-bold">Bring it back</button>
              </span>
            </>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => play({ id: v.id, youtubeId: v.youtubeId, start: v.start, title })} aria-label={`Play ${title}`} className="group absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail, shown as YouTube serves it */}
          <img src={thumbUrl(v.youtubeId)} alt="" className="size-full object-cover" loading="lazy" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full bg-signal text-ink shadow-soft transition group-hover:scale-105">
              <Play size={28} fill="currentColor" aria-hidden="true" className="translate-x-0.5" />
            </span>
          </span>
          {v.start > 0 && <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-bold text-paper">Starts at {formatTime(v.start)}</span>}
        </button>
      )}
    </div>
  );
}

/** "by Channel": the creator's name, linking to their channel. */
function Credit({ info, className = '' }: { info: Extract<VideoInfo, { ok: true }>; className?: string }) {
  const name = <span className="font-bold text-ink">{info.channel}</span>;
  return (
    <span className={className}>
      by {info.channelUrl ? <a href={info.channelUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-ink">{name}</a> : name}
    </span>
  );
}

/** YouTube couldn't be reached: say so, with the link. A video YouTube says is gone or only
 *  allowed on YouTube isn't shown at all (gone() below), so there's never a broken player. */
function Unreachable({ v }: { v: LiveVideo }) {
  return (
    <p className="text-sm text-muted">
      Couldn’t reach YouTube to load this video.{' '}
      <a href={watchUrl(v.youtubeId, v.start)} target="_blank" rel="noopener noreferrer" className="font-bold underline">Watch on YouTube</a>
    </p>
  );
}

/** YouTube said the video is private, taken down, or not allowed outside YouTube. */
const gone = (info: VideoInfo | null | undefined) => Boolean(info && !info.ok);

/** A video as a big card: the player, the credit, the votes. */
function VideoCard({ v, me, data, canRemove, onClose }: Shared & { v: LiveVideo; onClose?: () => void }) {
  const info = useVideoInfo(v.youtubeId);
  const dock = useDock();
  const inPlace = dock.now?.id === v.id && dock.host && dock.mode === 'inline';
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const ok = info && info.ok ? info : null;
  const title = ok?.title ?? 'A video';
  const tally = tallyText(v);
  const own = Boolean(me && v.addedBy === me.id);
  const minutesLeft = useMinutesLeft(own ? v.createdAt : null);
  if (gone(info)) return null;

  return (
    <div className="grid gap-2">
      {info === null ? <Unreachable v={v} /> : <Player v={v} title={title} />}
      {ok && (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-bold leading-snug">{ok.title}</p>
            <p className="text-sm text-muted">
              <Credit info={ok} />
              {v.start > 0 && <> · from {formatTime(v.start)}</>}
              {tally && <> · {tally}</>}
            </p>
          </div>
          {inPlace && (
            // Keeps playing in a corner while you scroll on, or open another Page.
            <button type="button" onClick={() => setMode('pinned')} title="Keep it playing in the corner while you scroll"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card-2 px-3 py-1.5 text-sm font-bold hover:bg-line">
              <PictureInPicture2 size={15} aria-hidden="true" /> Pop out
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close the video" className="grid size-8 shrink-0 place-items-center rounded-full bg-card-2 hover:bg-line"><X size={16} aria-hidden="true" /></button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {own ? <span className="px-1 text-xs font-bold text-muted">You added this</span> : (
          <>
            <Vote on={v.mine === 1} signedIn={Boolean(me)} label="This helped" icon={<ThumbsUp size={14} aria-hidden="true" />}
              onClick={async () => setNote((await data.vote(v.id, 1)) ?? '')} />
            <Vote on={v.mine === -1} signedIn={Boolean(me)} label="Didn’t help" icon={<ThumbsDown size={14} aria-hidden="true" />}
              onClick={async () => setNote((await data.vote(v.id, -1)) ?? '')} />
          </>
        )}
        <a href={watchUrl(v.youtubeId, v.start)} target="_blank" rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold text-muted hover:text-ink">
          Watch on YouTube <ExternalLink size={13} aria-hidden="true" />
        </a>
        {me && !own && (data.reported.has(v.id)
          ? <span className="px-1 text-xs font-bold text-muted">Reported</span>
          : (
            <button type="button" onClick={() => setReporting(!reporting)} aria-label="Report this video" aria-expanded={reporting}
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><Flag size={14} aria-hidden="true" /></button>
          ))}
        {canRemove(v) ? (
          // Moderators: any video, any time.
          <button type="button" aria-label="Take this video down" title="Take it down"
            onClick={async () => { if (window.confirm('Take this video down? It leaves this entry for everyone.')) setNote((await data.remove(v.id)) ?? ''); }}
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><Trash2 size={14} aria-hidden="true" /></button>
        ) : own && minutesLeft > 0 ? (
          // Whoever added it: their own call for the first hour.
          <button type="button"
            onClick={async () => { if (window.confirm(`Delete this video? You can delete it yourself for ${minutesLeft} more ${minutesLeft === 1 ? 'minute' : 'minutes'}.`)) setNote((await data.remove(v.id)) ?? ''); }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-muted hover:bg-card-2 hover:text-ink">
            <Trash2 size={13} aria-hidden="true" /> Delete · {minutesLeft} min left
          </button>
        ) : own && (data.reported.has(v.id) ? (
          <span className="px-1 text-xs font-bold text-muted">Removal requested</span>
        ) : (
          // After the hour, others may rely on it: a moderator decides.
          <button type="button"
            onClick={async () => {
              if (!window.confirm('Ask the moderators to take this video down?')) return;
              setNote((await data.report(v.id, 'other', REMOVAL_NOTE)) ?? 'Sent. A moderator will take a look.');
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-muted hover:bg-card-2 hover:text-ink">
            <Flag size={13} aria-hidden="true" /> Request removal
          </button>
        ))}
      </div>
      {reporting && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="w-full font-bold text-muted">What’s wrong with it?</span>
          {REASONS.map((r) => (
            <button key={r.key} type="button" className="rounded-full bg-card-2 px-2.5 py-1 font-bold ring-1 ring-line hover:ring-ink"
              onClick={async () => { const err = await data.report(v.id, r.key); setReporting(false); setNote(err ?? 'Thanks. A moderator will take a look.'); }}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {note && <p role="status" className="text-xs font-bold text-muted">{note}</p>}
    </div>
  );
}

/** Minutes left to delete your own video, counted down while the card is open (0 for others). */
function useMinutesLeft(createdAt: string | null): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!createdAt) return;
    const tick = () => setLeft(deleteMinutesLeft(createdAt, Date.now()));
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [createdAt]);
  return createdAt ? left : 0;
}

function Vote({ on, signedIn, label, icon, onClick }: { on: boolean; signedIn: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  const cls = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ' + (on ? 'bg-signal text-ink' : 'btn-quiet');
  if (!signedIn) {
    return <SignInLink className={cls} what="vote on videos">{icon} {label}</SignInLink>;
  }
  return <button type="button" aria-pressed={on} onClick={onClick} className={cls}>{icon} {label}</button>;
}

/** "Sign in" that comes back to this exact spot (the open entry is in the address). */
function SignInLink({ className, what, children }: { className: string; what: string; children: React.ReactNode }) {
  const router = useRouter();
  const go = (e: React.MouseEvent) => {
    // Read where we are at the tap, so the open entry (?e=…) comes back after signing in.
    e.preventDefault();
    router.push(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}&for=${encodeURIComponent(what)}`);
  };
  return <Link href="/signin" onClick={go} className={className}>{children}</Link>;
}

/** A video as a small row: a thumbnail, the title and who made it. Tapping plays it. */
function VideoRow({ v }: { v: LiveVideo }) {
  const info = useVideoInfo(v.youtubeId);
  const ok = info && info.ok ? info : null;
  const onPlay = () => play({ id: v.id, youtubeId: v.youtubeId, start: v.start, title: ok?.title ?? 'A video' });
  if (gone(info)) return null;
  if (info === null) return <Unreachable v={v} />;
  const tally = tallyText(v);
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onPlay} aria-label={`Play ${ok?.title ?? 'the video'}`}
        className="group relative aspect-video w-[120px] shrink-0 overflow-hidden rounded-xl bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail, shown as YouTube serves it */}
        <img src={thumbUrl(v.youtubeId)} alt="" className="size-full object-cover" loading="lazy" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-8 place-items-center rounded-full bg-signal text-ink transition group-hover:scale-105">
            <Play size={14} fill="currentColor" aria-hidden="true" className="translate-x-px" />
          </span>
        </span>
      </button>
      <div className="min-w-0 flex-1">
        {ok ? (
          <>
            <button type="button" onClick={onPlay} className="line-clamp-2 text-left text-sm font-bold leading-snug hover:underline">{ok.title}</button>
            <p className="truncate text-xs text-muted">
              <Credit info={ok} />
              {v.start > 0 && <> · from {formatTime(v.start)}</>}
              {tally && <> · {tally}</>}
            </p>
          </>
        ) : (
          <div className="grid gap-1.5" aria-hidden="true"><div className="h-3.5 w-3/4 rounded bg-card-2" /><div className="h-3 w-1/2 rounded bg-card-2" /></div>
        )}
      </div>
    </div>
  );
}

/** Add a video: paste a link, see it as players will (with YouTube's credit), pick the moment. */
function AddVideo({ name, signedIn, already, onAdd, onClose }: {
  name: string; signedIn: boolean; already: string[];
  onAdd: (youtubeId: string, start: number) => Promise<string | null>; onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [link, setLink] = useState<VideoLink | null>(null);
  const [info, setInfo] = useState<VideoInfo | null | undefined>(undefined);
  const [startText, setStartText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const read = (value: string) => {
    setText(value);
    setError('');
    const l = parseVideoLink(value);
    setLink(l);
    setInfo(undefined);
    setStartText(l && l.start > 0 ? formatTime(l.start) : '');
    if (l) fetchVideoInfo(l.id).then((i) => setInfo((cur) => (parseVideoLink(value)?.id === l.id ? i : cur)));
  };

  const start = startText.trim() ? parseTime(startText) : 0;
  const isAlready = Boolean(link && already.includes(link.id));
  const ready = Boolean(link && info && info.ok && start !== null && !isAlready);

  const submit = async () => {
    if (!link || !ready || start === null) return;
    setBusy(true);
    const err = await onAdd(link.id, start);
    setBusy(false);
    if (err) setError(err); else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Add a video" onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[2rem] bg-card shadow-soft sm:rounded-[2rem]">
        <div className="flex items-center gap-3 px-5 pb-2 pt-5">
          <h2 className="min-w-0 flex-1 font-display text-2xl leading-tight">Add a video</h2>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="grid min-h-0 gap-3 overflow-y-auto px-5 pb-5">
          <p className="text-sm text-muted">A YouTube video that helps with <span className="font-bold text-ink">{name}</span>. It plays in YouTube’s own player, so the creator keeps the view.</p>
          <label className="grid gap-1">
            <span className="text-sm font-bold">YouTube link</span>
            <input autoFocus value={text} onChange={(e) => read(e.target.value)} inputMode="url" placeholder="https://youtu.be/…"
              className="rounded-xl bg-card-2 px-3 py-2.5 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-signal" />
          </label>
          {text.trim() && !link && <p className="text-sm text-muted">That doesn’t look like a link to a YouTube video. Copy it from the Share button under the video.</p>}
          {link && info === undefined && <p className="text-sm text-muted">Asking YouTube who made it…</p>}
          {link && info === null && <p className="text-sm text-muted">Couldn’t reach YouTube. Check your connection and try again.</p>}
          {link && info && !info.ok && (
            <p className="text-sm text-muted">{info.reason === 'blocked' ? 'The creator only allows this video on YouTube, so it can’t play here.' : 'That video isn’t available: it may be private or taken down.'}</p>
          )}
          {link && info && info.ok && (
            <div className="grid gap-2 rounded-2xl bg-card-2 p-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">Is this the one?</span>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
                <img src={thumbUrl(link.id)} alt="" className="aspect-video w-[120px] shrink-0 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold leading-snug">{info.title}</p>
                  <p className="truncate text-xs text-muted"><Credit info={info} /></p>
                </div>
              </div>
              {isAlready && <p className="text-sm font-bold">It’s already on {name}.</p>}
            </div>
          )}
          {link && info && info.ok && !isAlready && (
            <label className="grid gap-1">
              <span className="text-sm font-bold">Start at <span className="font-normal text-muted">(optional)</span></span>
              <input value={startText} onChange={(e) => setStartText(e.target.value)} placeholder="0:00" inputMode="numeric"
                className="w-28 rounded-xl bg-card-2 px-3 py-2 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-signal" />
              <span className="text-xs text-muted">{start === null ? 'Write it like 4:32.' : 'Skip to the part that helps, like 4:32.'}</span>
            </label>
          )}
          {error && <p role="alert" className="text-sm font-bold text-berry">{error}</p>}
          <div className="flex justify-end">
            {signedIn ? (
              <button type="button" disabled={!ready || busy} onClick={submit} className="btn-primary rounded-full px-5 py-2 font-bold disabled:opacity-50">
                {busy ? 'Adding…' : 'Add video'}
              </button>
            ) : (
              <SignInLink className="btn-primary inline-flex rounded-full px-5 py-2 font-bold" what="add a video">Sign in to add it</SignInLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
