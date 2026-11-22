'use client';

import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChartBarBig, ImagePlus, Maximize2, Plus, Trophy, X } from 'lucide-react';
import type { Villager } from '@/components/useVillager';
import { messagePath } from '@/lib/links';
import { endsIn, isOpen, LENGTHS, MAX_CHOICES, MAX_LABEL, result, tally, voterLine } from '@/lib/polls';
import { imageUrl, type ChatMessage, type WorkshopData } from '../useWorkshop';
import { clock, useAction } from './bits';
import { ChatLinks, MessageText } from './Chat';
import { Lightbox } from './Lightbox';

// Chat polls (docs/chat.md, Matt 2026-11-21): "Design A or Design B?". The card in the chat, and
// the form that opens in the message box.

/**
 * The time now, ticking every half minute so "ends in 3m" counts down, and once more right when
 * the poll ends (also when it's ended early), so it closes on time.
 */
function useNow(endsAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms > 2 ** 31 - 1) return;
    const t = setTimeout(() => setNow(Date.now()), Math.max(0, ms) + 50);
    return () => clearTimeout(t);
  }, [endsAt]);
  return now;
}

/**
 * A poll in the chat: the question, then the choices (rows of words, or picture tiles side by side),
 * each with a bar, its count and who picked it. One tap votes; tapping another moves your vote;
 * tapping yours takes it back. Counts show to everyone from the start. Once it ends, the winner
 * gets a trophy and the choices stop taking taps.
 */
export function PollCard({ m, me, live, small = false }: { m: ChatMessage; me: Villager | null | undefined; live: WorkshopData; small?: boolean }) {
  const poll = m.poll!;
  const links = useContext(ChatLinks);
  const now = useNow(poll.endsAt);
  const { run, busy, error } = useAction();
  const [viewing, setViewing] = useState<number | null>(null);
  const votes = live.pollVotes.get(m.id) ?? [];
  const open = isOpen(poll, now);
  const { counts, names, total, leaders } = tally(poll, votes.map((v) => (v.by === me?.id ? { ...v, name: 'You' } : v)));
  const mine = me ? votes.find((v) => v.by === me.id)?.choice ?? null : null;
  const pictures = poll.options.some((o) => o.image);
  const canVote = open && Boolean(me) && !m.removed;
  const canEnd = open && Boolean(me) && (me?.id === m.author.id || live.mod);
  const shownPictures = poll.options.flatMap((o) => (o.image ? [{ url: imageUrl(o.image.path), name: `village-${links?.gameId ?? 'chat'}-${m.id}-${o.label.replace(/[^\w-]+/g, '-').slice(0, 30)}.${o.image.path.split('.').pop()}` }] : []));

  const choose = (i: number) => { if (canVote && !busy) run(() => live.votePoll(m.id, i)); };
  const pct = (i: number) => (total ? Math.round((counts[i] / total) * 100) : 0);

  return (
    <div role="group" aria-label="Poll" className="mt-0.5 grid max-w-md gap-1.5">
      <p className={'flex items-start gap-1.5 break-words font-bold ' + (small ? 'text-sm' : 'text-[15px] leading-snug')}>
        <ChartBarBig size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0"><span className="sr-only">Poll: </span><MessageText body={m.body} /></span>
      </p>
      {/* On a touch screen the row keeps room on the right for its buttons; the choices sit below
          them, so they take the full width. */}
      <ul className={'[@media(hover:none)]:-mr-17 ' + (pictures ? 'grid grid-cols-2 gap-1.5' : 'grid gap-1')}>
        {poll.options.map((o, i) => {
          const picked = mine === i;
          const won = !open && leaders.includes(i);
          const who = voterLine(names[i]);
          const label = `${o.label}: ${counts[i]} ${counts[i] === 1 ? 'vote' : 'votes'}${picked ? ', your vote' : ''}${won ? (leaders.length > 1 ? ', tied first' : ', the winner') : ''}`;
          const bar = (
            <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
              <span className={'block h-full rounded-full transition-[width] ' + (picked ? 'bg-signal' : 'bg-ink/30')} style={{ width: `${pct(i)}%` }} />
            </span>
          );
          const line = (
            <span className="flex items-center gap-1.5">
              {picked && <Check size={14} className="shrink-0" aria-hidden="true" />}
              {won && <Trophy size={14} className="shrink-0 text-sun" aria-hidden="true" />}
              <span className={'min-w-0 flex-1 truncate ' + (won || picked ? 'font-bold' : '')}>{o.label}</span>
              <span className="shrink-0 tabular-nums text-muted">{counts[i]}</span>
            </span>
          );
          const ring = picked ? 'ring-2 ring-signal' : 'ring-1 ring-line ' + (canVote ? 'hover:ring-ink' : '');
          return (
            <li key={i} className="relative min-w-0">
              <button type="button" onClick={() => choose(i)} disabled={!canVote} aria-pressed={picked} aria-label={label}
                title={who ? `Picked by ${names[i].join(', ')}` : undefined}
                className={'block w-full overflow-hidden rounded-lg bg-card text-left text-sm disabled:cursor-default ' + ring}>
                {o.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- a villager's picture from our own storage
                  <img src={imageUrl(o.image.path)} alt="" loading="lazy" className="aspect-[4/3] w-full bg-card-2 object-cover"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                )}
                <span className="block px-2.5 py-1.5">
                  {line}
                  {bar}
                  {who && <span className="mt-0.5 block truncate text-[11px] text-muted">{who}</span>}
                </span>
              </button>
              {o.image && (
                <button type="button" onClick={() => setViewing(shownPictures.findIndex((p) => p.url === imageUrl(o.image!.path)))}
                  aria-label={`See the picture for ${o.label} full size`}
                  className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md bg-ink/70 text-paper hover:bg-ink">
                  <Maximize2 size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
        {open ? <span>{total} {total === 1 ? 'vote' : 'votes'} · {endsIn(poll, now)}</span> : <span className="font-bold text-ink">{result(poll, votes)}</span>}
        {open && me === null && <span>· Sign in to vote</span>}
        {canEnd && (
          <>
            <span aria-hidden="true">·</span>
            <button type="button" disabled={busy} onClick={() => run(() => live.closePoll(m.id))} className="font-bold text-ink underline underline-offset-2 hover:text-berry disabled:opacity-50">
              End poll now
            </button>
          </>
        )}
      </p>
      {error && <p role="status" className="text-sm text-berry">{error}</p>}
      {viewing !== null && viewing >= 0 && (
        <Lightbox start={viewing} by={m.author.name} when={clock(m.createdAt)} onClose={() => setViewing(null)}
          messageLink={links ? location.origin + messagePath(links.gameId, m.id) : location.href} pictures={shownPictures} />
      )}
    </div>
  );
}

/** A choice being written in the message box: its name, and a picture if one was added. */
export interface DraftChoice { label: string; file?: File; preview?: string }

/**
 * The poll part of the message box: 2 to 4 choices, each with an optional picture, and how long it
 * runs. The question is whatever is typed in the box above.
 */
export function PollForm({ choices, onChoices, hours, onHours, onRemove }: {
  choices: DraftChoice[]; onChoices: (c: DraftChoice[]) => void;
  hours: number; onHours: (h: number) => void; onRemove: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const forChoice = useRef(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // A choice just added gets the cursor as soon as it's on screen.
  const focusAdded = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focusAdded.current === null) return;
    inputs.current[focusAdded.current]?.focus();
    focusAdded.current = null;
  }, [choices.length]);
  const set = (i: number, c: Partial<DraftChoice>) => onChoices(choices.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const drop = (i: number) => {
    if (choices[i].preview) URL.revokeObjectURL(choices[i].preview!);
    onChoices(choices.filter((_, j) => j !== i));
  };
  const add = () => {
    if (choices.length >= MAX_CHOICES) return;
    focusAdded.current = choices.length;
    onChoices([...choices, { label: '' }]);
  };
  const dropPicture = (i: number) => {
    if (choices[i].preview) URL.revokeObjectURL(choices[i].preview!);
    set(i, { file: undefined, preview: undefined });
  };

  return (
    <div className="grid gap-1.5 border-t border-line/70 px-2.5 py-2">
      <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file || !file.type.startsWith('image/')) return;
          const i = forChoice.current;
          if (choices[i]?.preview) URL.revokeObjectURL(choices[i].preview!);
          set(i, { file, preview: URL.createObjectURL(file) });
        }} />
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
        <ChartBarBig size={14} className="shrink-0" aria-hidden="true" /> <span className="min-w-0 truncate">Poll · type the question above</span>
        <button type="button" onClick={onRemove} className="ml-auto shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 font-bold text-muted hover:bg-card-2 hover:text-ink">Remove poll</button>
      </p>
      <ol className="grid gap-1.5">
        {choices.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {c.preview ? (
              <span className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview before upload */}
                <img src={c.preview} alt={`Picture for choice ${i + 1}`} className="size-8 rounded-md object-cover ring-1 ring-line" />
                <button type="button" onClick={() => dropPicture(i)} aria-label={`Remove the picture from choice ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-ink text-paper ring-2 ring-card">
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => { forChoice.current = i; picker.current?.click(); }} aria-label={`Add a picture to choice ${i + 1}`}
                title="Add a picture" className="grid size-8 shrink-0 place-items-center rounded-md text-muted ring-1 ring-line hover:text-ink hover:ring-ink">
                <ImagePlus size={15} aria-hidden="true" />
              </button>
            )}
            <input ref={(el) => { inputs.current[i] = el; }} value={c.label} maxLength={MAX_LABEL} onChange={(e) => set(i, { label: e.target.value })}
              onKeyDown={(e) => {
                // Enter moves to the next choice (adding one if there's room) instead of sending.
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (i + 1 < choices.length) inputs.current[i + 1]?.focus();
                else add();
              }}
              placeholder={i === 0 ? 'Design A' : i === 1 ? 'Design B' : `Choice ${i + 1}`} aria-label={`Choice ${i + 1}`}
              className="h-8 min-w-0 flex-1 rounded-md bg-card px-2.5 text-sm ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-signal" />
            {choices.length > 2 && (
              <button type="button" onClick={() => drop(i)} aria-label={`Remove choice ${i + 1}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-card-2 hover:text-ink">
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-1.5">
        {choices.length < MAX_CHOICES && (
          <button type="button" onClick={add} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-bold text-muted border border-dashed border-line hover:border-ink hover:text-ink">
            <Plus size={13} aria-hidden="true" /> Add a choice
          </button>
        )}
        <span role="radiogroup" aria-label="How long it runs" className="ml-auto inline-flex items-center gap-1">
          <span className="text-xs text-muted">Ends in</span>
          {LENGTHS.map((l) => (
            <button key={l.hours} type="button" role="radio" aria-checked={hours === l.hours} onClick={() => onHours(l.hours)}
              className={'h-7 rounded-full px-2.5 text-xs font-bold ring-1 ' + (hours === l.hours ? 'bg-signal text-ink ring-signal' : 'text-muted ring-line hover:text-ink hover:ring-ink')}>
              {l.label}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
