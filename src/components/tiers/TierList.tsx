'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Flag, MessageSquareText, Plus, Send, Share2, Sparkles, Undo2, Users, UserRound, X } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import { sharePath } from '@/data/pages/links';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import {
  MIN_LISTS, REASON_MAX, communityText, communityTier, fromCommunity, inLimits, place, placedCount, setReason, tierFill, tierOf, tiersOf, titleOf,
  type Community, type Counts, type Tier,
} from '@/lib/tiers';
import { EntryPanel } from '@/components/app/EntryPanel';
import { symbolFor } from '@/components/app/symbols';
import { initials, useOpenEntry } from '@/components/app/entries';
import { useVisible, type BlockContext } from '@/components/app/blockParts';
import { BoardCard, BoardHead, TierRow } from './BoardParts';
import { reportReason, useReasons, useTierList } from './useTierList';

type Tab = 'community' | 'mine';

/** Where a shared list opens: /g/<game>/tiers/<list id>. */
export const listPath = (gameId: string, listId: string) => `/g/${gameId}/tiers/${listId}`;

/**
 * A Tier list Block (docs/blocks/tier-lists.md): the pieces of another Block on this Page in
 * tiers, under the list's title ("MVP" unless the builders named it). Community (the default)
 * shows each piece in the median tier of everyone's lists; My list is your own: tap a piece, then
 * a tier (or drag it), with a one-line reason if you like. Saved on this device, and to your
 * account when signed in, where it counts toward Community.
 */
export function TierList({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const setup = block.tierSetup;
  const ranked = ctx.page.blocks.find((b) => b.id === setup?.ranks);
  if (!ranked) return <p className="mt-3 text-sm text-muted">This tier list ranks a Block that isn’t on this Page yet.</p>;
  return <Board block={block} ranked={ranked} ctx={ctx} />;
}

function Board({ block, ranked, ctx }: { block: Block; ranked: Block; ctx: BlockContext }) {
  const tiers = useMemo(() => tiersOf(block.tierSetup), [block.tierSetup]);
  const title = titleOf(block.tierSetup);
  const { shown: visible } = useVisible(ranked, ctx);
  const shown = useMemo(() => visible.filter((e) => inLimits(e, block.tierSetup)), [visible, block.tierSetup]);
  const data = useTierList(ctx.gameId, block.id, shown, tiers);
  const params = useSearchParams();
  // ?mine=<block> opens your own list ("Make your own" on a shared list).
  const [tab, setTab] = useState<Tab>('community');
  const mineAsked = params.get('mine') === block.id;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- following the address
    if (mineAsked) setTab('mine');
  }, [mineAsked]);
  const color = `var(--${ctx.tint})`;
  // A card's "Community tier" pill opens this Block with that piece's sheet (?t=block.entry).
  const [sheet, setSheet] = useState<string | null>(null);
  // A tier's letter in Community opens everyone placed there.
  const [tierSheet, setTierSheet] = useState<string | null>(null);
  const asked = params.get('t');
  useEffect(() => {
    const [b, id] = asked?.split('.') ?? [];
    if (b === block.id && id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- following the address
      setSheet(id);
      document.getElementById(block.id)?.scrollIntoView({ block: 'start' });
    }
  }, [asked, block.id]);
  const community = useMemo(() => new Map(shown.map((e) => [e.id, communityTier(data.counts.get(e.id), tiers)])), [shown, data.counts, tiers]);
  const sheetEntry = shown.find((e) => e.id === sheet);
  const { open, set, close } = useOpenEntry();
  const [ob, oid] = open?.split('.') ?? [];
  const opened = ob === block.id ? shown.find((e) => e.id === oid) : undefined;
  const toMine = () => { setTab('mine'); document.getElementById(block.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };

  return (
    <>
      <div role="tablist" aria-label="Whose tiers" className="mt-4 inline-flex rounded-full bg-card-2 p-0.5 text-sm font-bold ring-1 ring-line">
        {([['community', 'Community', Users], ['mine', 'My list', UserRound]] as const).map(([t, label, Icon]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ' + (tab === t ? 'bg-signal text-ink' : 'text-muted hover:text-ink')}>
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === 'community'
        ? <CommunityView title={title} shareUrl={sharePath(ctx.gameId, ctx.page, block)} tiers={tiers} shown={shown} community={community} data={data} color={color} ranked={ranked} onOpen={setSheet} onTier={setTierSheet} onMine={toMine} />
        : <MineView title={title} tiers={tiers} shown={shown} data={data} community={community} color={color} ranked={ranked} block={block} ctx={ctx} />}

      {tierSheet && tiers.some((t) => t.key === tierSheet) && (
        <TierSheet t={tiers.find((t) => t.key === tierSheet)!} i={tiers.findIndex((t) => t.key === tierSheet)} tiers={tiers} shown={shown} counts={data.counts}
          ranked={ranked} color={color} title={title} onPick={(id) => { setTierSheet(null); setSheet(id); }} onClose={() => setTierSheet(null)} />
      )}
      {sheetEntry && (
        <PieceSheet e={sheetEntry} ranked={ranked} tiers={tiers} counts={data.counts.get(sheetEntry.id)} c={community.get(sheetEntry.id)!} color={color}
          gameId={ctx.gameId} blockKey={block.id} meId={data.me?.id} mine={tierOf(data.list, sheetEntry.id)}
          onClose={() => { setSheet(null); if (asked) { const url = new URL(window.location.href); url.searchParams.delete('t'); window.history.replaceState({ villageEntry: Boolean(window.history.state?.villageEntry) }, '', url); } }}
          onCard={() => { setSheet(null); set(`${block.id}.${sheetEntry.id}`); }}
          onPlace={(t) => { data.setList(place(data.list, sheetEntry.id, t)); setSheet(null); setTab('mine'); }} />
      )}
      {opened && (
        <EntryPanel entry={opened} block={ranked} list={shown} route={ctx.route} routes={ctx.routes} gameId={ctx.gameId}
          sharePath={sharePath(ctx.gameId, ctx.page, ranked, opened)} color={color}
          onGo={(e) => set(`${block.id}.${e.id}`, 'replace')} onClose={close} />
      )}
    </>
  );
}

/** What's in a piece: its picture, else its group's symbol, else initials. */
function Mark({ e, block, px }: { e: Entry; block: Block; px: number }) {
  if (e.icon) return null;
  const symbol = symbolFor(e, block);
  return symbol ? <BlockIcon name={symbol} size={Math.round(px * 0.24)} strokeWidth={2.4} /> : <>{initials(e.name)}</>;
}

const PIECE = 48;

/**
 * One piece with its name under it, like an app icon. `outline` is a piece not placed yet (the
 * split outline, with its picture inside when it has one); `snap` plays the brand's snap as a
 * piece turns solid in a tier.
 */
function PieceButton({ e, block, color, outline = false, picked = false, snap = false, onClick, ...rest }: {
  e: Entry; block: Block; color: string; outline?: boolean; picked?: boolean; snap?: boolean; onClick?: () => void;
} & React.HTMLAttributes<HTMLButtonElement> & { 'data-id'?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={picked} aria-label={e.name}
      className={'group flex w-[3.6rem] shrink-0 select-none sm:w-16 flex-col items-center gap-0.5 rounded-xl p-0.5 [-webkit-touch-callout:none] ' + (picked ? 'bg-signal' : 'hover:bg-black/5')} {...rest}>
      <span className={'transition ' + (picked ? '-translate-y-0.5' : 'group-hover:-translate-y-0.5')}>
        {outline ? <Piece size={PIECE} outline image={e.icon}><Mark e={e} block={block} px={PIECE} /></Piece>
          : <Piece size={PIECE} color={color} image={e.icon} snap={snap}><Mark e={e} block={block} px={PIECE} /></Piece>}
      </span>
      <span className={'w-full truncate text-center text-[11px] leading-tight ' + (picked ? 'font-bold text-ink' : 'text-ink')}>{e.name}</span>
    </button>
  );
}

// --------------------------------------------------------------------------- Community

function CommunityView({ title, tiers, shown, community, data, color, ranked, shareUrl, onOpen, onTier, onMine }: {
  title: string; shareUrl: string; tiers: Tier[]; shown: Entry[]; community: Map<string, Community>; data: Data; color: string; ranked: Block;
  onOpen: (id: string) => void; onTier: (tier: string) => void; onMine: () => void;
}) {
  const { state, total } = data;
  if (state === 'missing') return <p className="mt-3 rounded-xl bg-card-2 p-3 text-sm text-muted">The community list turns on soon. You can already make <button type="button" onClick={onMine} className="font-bold text-ink underline underline-offset-2">your own</button>.</p>;
  if (state === 'offline') return <p className="mt-3 rounded-xl bg-card-2 p-3 text-sm text-muted">Couldn’t reach the village to count the lists. <button type="button" onClick={onMine} className="font-bold text-ink underline underline-offset-2">Your own list</button> still works.</p>;
  const any = shown.some((e) => community.get(e.id)?.tier);
  const leaning = shown.some((e) => { const c = community.get(e.id); return c?.tier && !c.settled; });
  const chip = state === 'loading' ? 'Counting…' : total ? `${total} ${total === 1 ? 'list' : 'lists'}` : 'No lists yet';
  return (
    <div className="mt-3 grid gap-3">
      <BoardCard>
        <BoardHead title={title} sub={`${ranked.title}, ranked by everyone’s lists`} chip={chip}
          action={<HeaderShare label={`Share the community’s ${title} list`} getUrl={async () => window.location.origin + shareUrl} />} />
        {tiers.map((t, i) => (
          // Before anyone has ranked, the rows stay short so the empty board doesn't fill a phone.
          <TierRow key={t.key} t={t} i={i} n={tiers.length} color={color} compact={!any} onTab={any ? () => onTier(t.key) : undefined}>
            {/* Settled pieces first, solid; pieces still leaning (under 5 lists) after them, as split outlines. */}
            {shown.filter((e) => community.get(e.id)?.tier === t.key)
              .sort((a, b) => Number(Boolean(community.get(b.id)?.settled)) - Number(Boolean(community.get(a.id)?.settled)))
              .map((e) => (
                <li key={e.id}><PieceButton e={e} block={ranked} color={color} outline={!community.get(e.id)?.settled} onClick={() => onOpen(e.id)} /></li>
              ))}
          </TierRow>
        ))}
        {leaning && (
          <p className="flex items-center gap-2 border-t border-line/70 px-3 py-1.5 text-xs text-muted">
            <Piece size={16} outline /> Outlined pieces are still leaning: fewer than {MIN_LISTS} lists have placed them.
          </p>
        )}
      </BoardCard>
      <HowItWorks empty={state === 'ready' && !any} placed={placedCount(data.list)} signedIn={Boolean(data.me)} onMine={onMine} />
    </div>
  );
}

/**
 * How the community list is built, said plainly: everyone ranks in My list, and each piece lands
 * in the tier most lists give it. Three steps on an empty board; one line once there are lists.
 */
function HowItWorks({ empty, placed, signedIn, onMine }: { empty: boolean; placed: number; signedIn: boolean; onMine: () => void }) {
  const cta = placed ? 'Edit my list' : empty ? 'Make the first list' : 'Add my list';
  if (!empty) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card-2 px-3 py-2.5 text-sm">
        <p className="min-w-0 flex-1 text-muted">Built from everyone’s own lists: each piece sits in the tier most lists give it. Tap a tier’s letter or a piece for the numbers.</p>
        <button type="button" onClick={onMine} className="btn-primary shrink-0 rounded-full px-4 py-1.5 text-sm font-bold">{cta}</button>
      </div>
    );
  }
  const steps = [
    ['Make your list', 'Open My list and put each piece in a tier. Tap a piece, then a tier.'],
    [signedIn ? 'It counts' : 'Sign in', signedIn ? 'You’re signed in, so your list counts as soon as you make it.' : 'Your list counts once you’re signed in. Until then it stays on this device.'],
    ['The community decides', `Each piece moves up here, into the tier most lists give it. After ${MIN_LISTS} lists it’s settled.`],
  ];
  return (
    <div className="rounded-2xl bg-card-2 p-3">
      <p className="text-sm font-extrabold">How the community list is built</p>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">
        {steps.map(([head, text], i) => (
          <li key={head} className="flex gap-2.5 rounded-xl bg-card p-2.5 ring-1 ring-line">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-extrabold text-signal">{i + 1}</span>
            <span className="min-w-0 text-sm"><span className="block font-bold">{head}</span><span className="text-muted">{text}</span></span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onMine} className="btn-primary mt-3 rounded-full px-5 py-2 text-sm font-bold">{cta}</button>
    </div>
  );
}

/** A piece from the community list: its tier, how the lists split, and why people put it there. */
function PieceSheet({ e, ranked, tiers, counts, c, color, gameId, blockKey, meId, mine, onClose, onCard, onPlace }: {
  e: Entry; ranked: Block; tiers: Tier[]; counts?: Counts; c: Community; color: string; gameId: string; blockKey: string; meId?: string;
  mine: string | null; onClose: () => void; onCard: () => void; onPlace: (tier: string) => void;
}) {
  const reasons = useReasons(gameId, blockKey, e.ref?.card);
  const text = communityText(c, tiers);
  const label = (k: string) => tiers.find((t) => t.key === k)?.label ?? k;
  useEffect(() => {
    const esc = (k: KeyboardEvent) => { if (k.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${e.name} in the community tiers`} onClick={(ev) => ev.stopPropagation()}
        className="rise flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[2rem] bg-card shadow-soft sm:rounded-[2rem]">
        <div className="flex items-center gap-3 px-5 pb-2 pt-5">
          <Piece size={52} color={color} image={e.icon}><Mark e={e} block={ranked} px={52} /></Piece>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold leading-tight">{e.name}</h2>
            <p className="text-sm text-muted">{text ? <>Community tier: <span className="font-bold text-ink">{text}</span>{c.settled && <> · {c.lists} lists</>}</> : 'Nobody has placed it yet'}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="grid min-h-0 gap-4 overflow-y-auto px-5 pb-5">
          {/* How the lists split; only once there are 5, like every opinion count. */}
          <Spread tiers={tiers} counts={counts ?? {}} color={color} />
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Why people put it there</h3>
            {reasons === null ? <p className="mt-1 text-sm text-muted">Loading…</p>
              : reasons.length === 0 ? <p className="mt-1 text-sm text-muted">No reasons yet. Add one when you place it in your list.</p>
              : <ul className="mt-1 grid gap-1.5">{reasons.map((r) => <ReasonRow key={r.id} r={r} label={label(r.tier)} meId={meId} />)}</ul>}
          </section>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{mine ? `In your list: ${label(mine)}. Move it to` : 'Put it in your list'}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tiers.map((t) => (
                <button key={t.key} type="button" onClick={() => onPlace(t.key)} aria-pressed={mine === t.key}
                  className={'min-w-11 rounded-full px-3 py-1.5 text-sm font-extrabold ring-1 ' + (mine === t.key ? 'bg-signal text-ink ring-signal' : 'ring-line hover:ring-ink')}>{t.label}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={onCard} className="justify-self-start rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">Open {e.name}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * How the lists placed one piece: a bar for every tier with how many lists put it there. Counts
 * show once 5 lists have placed it, like every opinion count; before that, only where it's leaning.
 */
function Spread({ tiers, counts, color }: { tiers: Tier[]; counts: Counts; color: string }) {
  const n = tiers.reduce((s, t) => s + (counts[t.key] ?? 0), 0);
  if (n < MIN_LISTS) {
    return <p className="rounded-xl bg-card-2 px-3 py-2 text-sm text-muted">Fewer than {MIN_LISTS} lists have placed it so far. The counts show once {MIN_LISTS} have.</p>;
  }
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Where the lists put it · {n} lists</h3>
      <ul className="mt-1.5 grid gap-1">
        {tiers.map((t, i) => {
          const f = tierFill(i, tiers.length, color);
          const c = counts[t.key] ?? 0;
          return (
            <li key={t.key} className="flex items-center gap-2 text-sm">
              <span className="grid h-6 w-8 shrink-0 place-items-center rounded-md text-xs font-extrabold" style={{ background: f.background, color: f.white ? '#fff' : 'var(--ink)' }}>{t.label}</span>
              <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-card-2">
                <span className="block h-full rounded-full" style={{ width: `${(c / n) * 100}%`, background: f.background }} />
              </span>
              <span className="w-16 shrink-0 text-right text-xs font-bold tabular-nums">{c} {c === 1 ? 'list' : 'lists'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * One tier in the community list: everyone any list put there, most often first, with how many
 * lists did (once a piece has 5). Tapping one opens its sheet.
 */
function TierSheet({ t, i, tiers, shown, counts, ranked, color, title, onPick, onClose }: {
  t: Tier; i: number; tiers: Tier[]; shown: Entry[]; counts: Map<string, Counts>; ranked: Block; color: string; title: string;
  onPick: (id: string) => void; onClose: () => void;
}) {
  useEffect(() => {
    const esc = (k: KeyboardEvent) => { if (k.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const f = tierFill(i, tiers.length, color);
  const totalOf = (id: string) => tiers.reduce((s, x) => s + (counts.get(id)?.[x.key] ?? 0), 0);
  const here = shown.map((e) => ({ e, n: counts.get(e.id)?.[t.key] ?? 0, total: totalOf(e.id) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || b.n / (b.total || 1) - a.n / (a.total || 1) || a.e.name.localeCompare(b.e.name));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${t.label} tier in the community’s ${title} list`} onClick={(ev) => ev.stopPropagation()}
        className="rise flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[2rem] bg-card shadow-soft sm:rounded-[2rem]">
        <div className="flex items-center gap-3 px-5 pb-3 pt-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl font-extrabold" style={{ background: f.background, color: f.white ? '#fff' : 'var(--ink)' }}>{t.label}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold leading-tight">{t.label} tier · {title}</h2>
            <p className="text-sm text-muted">Everyone the community’s lists put in {t.label}, most often first</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">
          {here.length === 0 ? <p className="rounded-xl bg-card-2 p-3 text-sm text-muted">No list has put anyone in {t.label} yet.</p> : (
            <ul className="grid gap-1">
              {here.map(({ e, n, total }) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 rounded-xl px-1.5 py-1.5 text-left hover:bg-card-2">
                    <Piece size={40} color={color} image={e.icon}><Mark e={e} block={ranked} px={40} /></Piece>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{e.name}</span>
                      {total >= MIN_LISTS ? (
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-card-2"><span className="block h-full rounded-full" style={{ width: `${(n / total) * 100}%`, background: f.background }} /></span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-muted">{n} of {total} lists</span>
                        </span>
                      ) : <span className="block text-xs text-muted">Fewer than {MIN_LISTS} lists so far</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const REPORTS = [{ key: 'rude', label: 'Rude' }, { key: 'spam', label: 'Spam' }, { key: 'spoiler', label: 'Spoiler' }, { key: 'other', label: 'Something else' }] as const;

function ReasonRow({ r, label, meId }: { r: { id: string; text: string; mine: boolean }; label: string; meId?: string }) {
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  return (
    <li className="rounded-xl bg-card-2 px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        <span className="shrink-0 rounded-md bg-card px-1.5 text-xs font-extrabold ring-1 ring-line">{label}</span>
        <span className="min-w-0 flex-1 break-words">{r.text}</span>
        {r.mine ? <span className="shrink-0 text-xs text-muted">Yours</span> : meId && !note && (
          <button type="button" onClick={() => setReporting(!reporting)} aria-label="Report this reason" aria-expanded={reporting}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-card hover:text-ink"><Flag size={13} aria-hidden="true" /></button>
        )}
      </div>
      {reporting && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
          {REPORTS.map((x) => (
            <button key={x.key} type="button" className="rounded-full bg-card px-2.5 py-1 font-bold ring-1 ring-line hover:ring-ink"
              onClick={async () => { const err = await reportReason(r.id, x.key, meId); setReporting(false); setNote(err ?? 'Thanks. A moderator will take a look.'); }}>{x.label}</button>
          ))}
        </div>
      )}
      {note && <p role="status" className="mt-1 text-xs font-bold text-muted">{note}</p>}
    </li>
  );
}

// --------------------------------------------------------------------------- My list

type Data = ReturnType<typeof useTierList>;

/** Where the list you're looking at stands, for the board's header. */
function saveText(data: Data, placed: number): string {
  if (data.error) return data.error;
  if (data.unique) return data.save === 'saving' ? 'Saving…' : 'Your own list. It doesn’t count toward Community';
  if (!data.me) return placed ? 'Kept on this device' : 'Your list for the community’s';
  if (data.save === 'saving') return 'Saving…';
  if (!data.submitted) return placed ? 'Saved. Submit it below so it counts' : 'Your list for the community’s';
  return data.changed ? 'Changed since you submitted it' : 'Submitted. It counts toward Community';
}

/** Shares a link from the ink header: the phone's share menu, else copied. */
function HeaderShare({ label, getUrl }: { label: string; getUrl: () => Promise<string | null> }) {
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2600);
    return () => clearTimeout(t);
  }, [note]);
  const go = async () => {
    const url = await getUrl();
    if (!url) return;
    if (window.matchMedia('(pointer: coarse)').matches && navigator.share) {
      try { await navigator.share({ title: label, url }); } catch { /* closed the share menu */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); setNote('Link copied'); } catch { window.prompt('Copy this link:', url); }
  };
  return (
    <span className="relative shrink-0">
      <button type="button" onClick={go} aria-label={label} title={label}
        className={'grid size-9 place-items-center rounded-full transition ' + (note ? 'bg-leaf text-white' : 'bg-white/10 text-white hover:bg-white/20')}>
        {note ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
      </button>
      {note && <span role="status" className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white shadow-soft">{note}</span>}
    </span>
  );
}

/**
 * Where the tray sits: above the phone's tab bar (however tall it is), full width; on a computer at
 * the bottom, lined up with the board's column. Measured whenever the tray appears (the tab bar may
 * only arrive after the page has loaded) and when the window changes size.
 */
function useTrayPlace(board: React.RefObject<HTMLDivElement | null>, showing: boolean) {
  const [place, setPlace] = useState<React.CSSProperties>({ bottom: 0 });
  useEffect(() => {
    if (!showing) return;
    const measure = () => {
      const bar = [...document.querySelectorAll<HTMLElement>('nav')].find((n) => getComputedStyle(n).position === 'fixed' && n.offsetHeight > 0);
      const bottom = bar ? Math.max(0, Math.round(window.innerHeight - bar.getBoundingClientRect().top)) : 0;
      const r = board.current?.getBoundingClientRect();
      setPlace(window.innerWidth >= 1024 && r ? { bottom, left: Math.round(r.left), width: Math.round(r.width), right: 'auto' } : { bottom });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [board, showing]);
  return place;
}

/** The tray's height in pixels, remembered on this device. */
const TRAY_MIN = 128;
const TRAY_START = 212;
function useTrayHeight() {
  const [h, setH] = useState(TRAY_START);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('village:tierTrayHeight'));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
      if (saved >= TRAY_MIN) setH(Math.min(saved, Math.round(window.innerHeight * 0.75)));
    } catch { /* storage unavailable */ }
  }, []);
  const set = (next: number) => {
    const v = Math.round(Math.max(TRAY_MIN, Math.min(next, window.innerHeight * 0.75)));
    setH(v);
    try { localStorage.setItem('village:tierTrayHeight', String(v)); } catch { /* storage unavailable */ }
  };
  return [h, set] as const;
}

/**
 * The tray's grab handle: drag it up or down to resize, tap it to switch between short and tall,
 * or use the arrow keys.
 */
function TrayHandle({ height, onHeight }: { height: number; onHeight: (h: number) => void }) {
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const tall = () => Math.round(window.innerHeight * 0.6);
  return (
    <div className="flex shrink-0 cursor-ns-resize touch-none justify-center pb-1.5 pt-2"
      onPointerDown={(e) => { drag.current = { y: e.clientY, h: height, moved: false }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* still works */ } }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
        if (d.moved) onHeight(d.h + (d.y - e.clientY));
      }}
      onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) onHeight(height < tall() - 20 ? tall() : TRAY_START); }}
      onPointerCancel={() => { drag.current = null; }}>
      <button type="button" role="separator" aria-orientation="horizontal" aria-label="Tray size: drag, tap, or use the arrow keys"
        onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); onHeight(height + 40); } if (e.key === 'ArrowDown') { e.preventDefault(); onHeight(height - 40); } }}
        className="grid h-4 w-16 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-signal">
        <span className="block h-1.5 w-10 rounded-full bg-muted/40" />
      </button>
    </div>
  );
}

function useSignIn(blockId: string) {
  const router = useRouter();
  return (what: string) => router.push(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search + '#' + blockId)}&for=${encodeURIComponent(what)}`);
}

/** Your lists: the main one for the Block's reason (it can count), your unique ones, and "New list". */
function ListPicker({ data, title, block }: { data: Data; title: string; block: Block }) {
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const signIn = useSignIn(block.id);
  const chip = (on: boolean) => 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (on ? 'bg-ink text-white ring-ink' : 'bg-card ring-line hover:ring-ink');
  const create = async () => {
    const err = await data.createUnique(name);
    if (err) { setNote(err); return; }
    setMaking(false); setName(''); setNote(null);
  };
  return (
    <div className="mt-3">
      <div role="group" aria-label="Your lists" className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => data.choose('main')} aria-pressed={data.active === 'main'} className={chip(data.active === 'main')}>
          <Users size={14} aria-hidden="true" /> {title}
        </button>
        {data.uniques.map((u) => (
          <button key={u.id} type="button" onClick={() => data.choose(u.id)} aria-pressed={data.active === u.id} className={chip(data.active === u.id)}>{u.title}</button>
        ))}
        {!making && (
          <button type="button" onClick={() => (data.me ? setMaking(true) : signIn('make a list of your own'))}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-dashed border-line px-3 py-1 text-sm font-bold text-muted hover:border-ink hover:text-ink">
            <Plus size={14} aria-hidden="true" /> Create a unique list
          </button>
        )}
      </div>
      {making && (
        <form onSubmit={(ev) => { ev.preventDefault(); create(); }} className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-card-2 p-2.5">
          <label className="min-w-48 flex-1">
            <span className="sr-only">Title</span>
            <input autoFocus value={name} onChange={(ev) => setName(ev.target.value)} maxLength={40} placeholder="Its title, like “Hottest” or “Most interesting”"
              className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-signal" />
          </label>
          <button type="submit" disabled={!name.trim()} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40">Start it</button>
          <button type="button" onClick={() => { setMaking(false); setName(''); setNote(null); }} className="rounded-full px-3 py-2 text-sm font-bold text-muted hover:text-ink">Cancel</button>
          <p className="w-full text-xs text-muted">A list of your own, from scratch. It’s yours to share; it doesn’t count toward the community’s {title} list.</p>
          {note && <p role="status" className="w-full text-xs font-bold text-berry">{note}</p>}
        </form>
      )}
    </div>
  );
}

function MineView({ title, tiers, shown, data, community, color, ranked, block, ctx }: {
  title: string; tiers: Tier[]; shown: Entry[]; data: Data; community: Map<string, Community>; color: string; ranked: Block; block: Block; ctx: BlockContext;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [trayHeight, setTrayHeight] = useTrayHeight();
  // The piece just placed snaps solid (the brand's one motion), once.
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 700);
    return () => clearTimeout(t);
  }, [fresh]);
  const { list, setList } = data;
  const byId = useMemo(() => new Map(shown.map((e) => [e.id, e])), [shown]);
  const tray = shown.filter((e) => !tierOf(list, e.id));
  const pickedEntry = picked ? byId.get(picked) : undefined;
  const pickedTier = picked ? tierOf(list, picked) : null;
  const placed = placedCount(list);
  const listTitle = data.unique?.title ?? title;
  const signIn = useSignIn(block.id);

  // A different list: nothing stays picked.
  const [seenList, setSeenList] = useState(data.active);
  if (seenList !== data.active) { setSeenList(data.active); setPicked(null); }

  const pick = (id: string) => { setReasonOpen(false); setPicked(picked === id ? null : id); };
  const drop = (tier: string | null, before?: string) => {
    if (!picked) return;
    const at = tier && before ? (list.rows[tier] ?? []).filter((x) => x !== picked).indexOf(before) : undefined;
    if (tier && tierOf(list, picked) !== tier) setFresh(picked);
    setList(place(list, picked, tier, at !== undefined && at >= 0 ? at : undefined));
    if (!tier) setPicked(null);
  };
  /** A tap on a piece: pick it, or with another piece picked, put that one just before it. */
  const tapPiece = (id: string) => {
    if (picked && picked !== id && tierOf(list, id)) { drop(tierOf(list, id), id); setPicked(null); return; }
    pick(id);
  };

  const root = useRef<HTMLDivElement>(null);
  const { handlers, over, ghost } = useDrag(root, (id, tier, before) => {
    if (tier && tierOf(list, id) !== tier) setFresh(id);
    setList(place(list, id, tier, tier && before ? Math.max(0, (list.rows[tier] ?? []).filter((x) => x !== id).indexOf(before)) : undefined));
    setPicked(null);
  });

  // The tray slides up from the bottom while the board is on screen.
  const [inView, setInView] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '-72px 0px -140px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const trayPlace = useTrayPlace(board, inView || Boolean(pickedEntry));

  const communityFill = () => setList(fromCommunity(shown.map((e) => e.id), (id) => community.get(id)?.tier ?? null));
  const hasCommunity = data.active === 'main' && shown.some((e) => community.get(e.id)?.tier);
  const shareUrl = async () => {
    if (!data.me) { signIn('share your tier list'); return null; }
    const r = await data.share();
    return r.id ? window.location.origin + listPath(ctx.gameId, r.id) : null;
  };

  return (
    // Room at the bottom for the tray, so the last tier can scroll above it.
    <div ref={root} style={{ paddingBottom: trayHeight + 16 }}>
      <ListPicker data={data} title={title} block={block} />
      <div ref={board}>
      <BoardCard className="mt-3">
        <BoardHead title={listTitle} sub={saveText(data, placed)} chip={`${placed} of ${shown.length}`}
          action={<HeaderShare label={`Share my ${listTitle} list`} getUrl={shareUrl} />} />
        {placed === 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line/70 bg-card-2 px-3 py-2 text-sm">
            <p className="w-full text-muted sm:w-auto sm:min-w-0 sm:flex-1">Tap a piece in the tray below, then tap a tier. Or press and drag it.</p>
            {hasCommunity && (
              <button type="button" onClick={communityFill} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-bold ring-1 ring-line hover:ring-ink">
                <Sparkles size={14} aria-hidden="true" /> Start from the community’s
              </button>
            )}
          </div>
        )}
        {tiers.map((t, i) => {
          const row = (list.rows[t.key] ?? []).map((id) => byId.get(id)).filter(Boolean) as Entry[];
          const target = Boolean(picked) && pickedTier !== t.key;
          return (
            <TierRow key={t.key} t={t} i={i} n={tiers.length} color={color} data-tier={t.key} glow={over === t.key ? 'on' : target ? 'target' : undefined}
              onClick={(ev) => { if (picked && !(ev.target as HTMLElement).closest('[data-id]')) { drop(t.key); setPicked(null); } }}>
              {row.map((e) => (
                <li key={e.id} className="relative">
                  <PieceButton e={e} block={ranked} color={color} picked={picked === e.id} snap={fresh === e.id} data-id={e.id} onClick={() => tapPiece(e.id)} {...handlers(e.id)} />
                  {list.reasons[e.id] && <MessageSquareText size={11} className="pointer-events-none absolute -right-0.5 -top-0.5 rounded-full bg-card p-px text-muted" aria-label="Has a reason" />}
                </li>
              ))}
              {/* Only in an empty row: in a full one the yellow edge says it, and the row doesn't jump. */}
              {target && !row.length && <li className="grid h-[4.3rem] place-items-center px-2 text-xs font-bold text-muted">Tap to put {pickedEntry?.name} here</li>}
            </TierRow>
          );
        })}
      </BoardCard>
      </div>

      {data.active === 'main'
        ? <SubmitBar data={data} title={title} placed={placed} onSignIn={() => signIn('submit your tier list')} />
        : <UniqueBar data={data} />}
      <ListFooter data={data} ctx={ctx} placed={placed} onClear={() => { setList({ rows: {}, reasons: {} }); setPicked(null); }} />

      {/* The tray: a sheet that slides up from the bottom (above the phone's tab bar) while the
          board is on screen. Drag its handle to make it taller or shorter. Its top row never
          changes shape: what's picked, then the tier buttons and three small tools. */}
      {(inView || pickedEntry) && (
        <div data-tier="" className="fixed inset-x-0 z-40 px-2 lg:px-0" style={trayPlace}
          onClick={(ev) => { if (picked && pickedTier && !(ev.target as HTMLElement).closest('[data-id],button,input')) drop(null); }}>
          <div className={'rise mx-auto flex max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-card shadow-[0_-10px_30px_rgba(21,23,28,0.18)] ring-1 transition-colors lg:max-w-none ' + (over === '' ? 'ring-2 ring-signal' : 'ring-line')}
            style={{ height: trayHeight }}>
            <TrayHandle height={trayHeight} onHeight={setTrayHeight} />
            <div className="px-2.5 pb-1.5">
              <div className="flex items-center gap-2 pb-1 text-xs">
                <p className="shrink-0 font-bold uppercase tracking-wide text-muted">Not placed · {tray.length}</p>
                <p className={'min-w-0 flex-1 truncate text-right ' + (pickedEntry ? 'font-bold text-ink' : 'text-muted')}>
                  {pickedEntry ? `${pickedEntry.name}${pickedTier ? ` · ${tiers.find((t) => t.key === pickedTier)?.label}` : ''}` : tray.length ? 'Tap a piece, then a tier' : ''}
                </p>
              </div>
              <div role="toolbar" aria-label={pickedEntry ? `Place ${pickedEntry.name}` : 'Tiers'} className="flex items-center gap-1">
                {tiers.map((t, i) => {
                  const f = tierFill(i, tiers.length, color);
                  return (
                    <button key={t.key} type="button" onClick={() => drop(t.key)} disabled={!pickedEntry} aria-pressed={pickedTier === t.key}
                      className={'h-9 min-w-0 flex-1 rounded-xl text-sm font-extrabold transition disabled:opacity-35 ' + (pickedTier === t.key ? 'ring-2 ring-signal ring-offset-1' : '')}
                      style={{ background: f.background, color: f.white ? '#fff' : 'var(--ink)' }}>{t.label}</button>
                  );
                })}
                <span className="mx-0.5 h-6 w-px shrink-0 bg-line" aria-hidden="true" />
                <button type="button" onClick={() => drop(null)} disabled={!pickedTier} aria-label="Back to Not placed" title="Back to Not placed"
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-card-2 text-ink disabled:opacity-35"><Undo2 size={16} aria-hidden="true" /></button>
                <button type="button" onClick={() => setReasonOpen(!reasonOpen)} disabled={!pickedTier} aria-expanded={reasonOpen} aria-label="Why it's here" title="Why it's here"
                  className={'relative grid size-9 shrink-0 place-items-center rounded-xl disabled:opacity-35 ' + (reasonOpen ? 'bg-ink text-white' : 'bg-card-2 text-ink')}>
                  <MessageSquareText size={16} aria-hidden="true" />
                  {pickedEntry && list.reasons[pickedEntry.id] && <span className="absolute right-1 top-1 size-2 rounded-full bg-signal" aria-hidden="true" />}
                </button>
                <button type="button" onClick={() => setPicked(null)} disabled={!pickedEntry} aria-label="Done" title="Done"
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-white disabled:opacity-35"><Check size={16} aria-hidden="true" /></button>
              </div>
              {reasonOpen && pickedEntry && pickedTier && (
                <label className="mt-1.5 block">
                  <span className="sr-only">Why {pickedEntry.name} is here</span>
                  <input autoFocus value={list.reasons[pickedEntry.id] ?? ''} maxLength={REASON_MAX} placeholder={`Why ${pickedEntry.name} is here, in a line`}
                    onChange={(ev) => setList(setReason(list, pickedEntry.id, ev.target.value))}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') setReasonOpen(false); }}
                    className="w-full rounded-xl bg-card-2 px-3 py-2 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-signal" />
                  <span className="mt-0.5 block text-[11px] text-muted">{data.active === 'main' ? 'Shown to others without your name once you submit. ' : ''}{REASON_MAX - (list.reasons[pickedEntry.id]?.length ?? 0)} left.</span>
                </label>
              )}
            </div>
            {tray.length ? (
              <ul className="flex min-h-0 flex-1 flex-wrap content-start gap-x-1 overflow-y-auto overscroll-contain border-t border-line/70 px-2 pb-2 pt-1">
                {tray.map((e) => <li key={e.id}><PieceButton e={e} block={ranked} color={color} outline picked={picked === e.id} data-id={e.id} onClick={() => pick(e.id)} {...handlers(e.id)} /></li>)}
              </ul>
            ) : <p className="border-t border-line/70 px-3 py-3 text-sm text-muted">Every piece is placed.</p>}
          </div>
        </div>
      )}
      {ghost}
    </div>
  );
}

/**
 * Submitting your main list: it counts toward the community's list as it is when you submit;
 * changes after that count when you submit again. Withdrawing takes it back.
 */
function SubmitBar({ data, title, placed, onSignIn }: { data: Data; title: string; placed: number; onSignIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const run = async (fn: () => Promise<string | null>, done: string) => {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    setNote(err ?? done);
  };
  let body: React.ReactNode;
  if (data.me === undefined) return null;
  if (!data.me) {
    body = (
      <>
        <p className="min-w-0 flex-1 text-sm text-muted">Sign in to submit your list. Then it counts toward the community’s {title} list.</p>
        <button type="button" onClick={onSignIn} className="btn-primary shrink-0 rounded-full px-4 py-2 text-sm font-bold">Sign in to submit</button>
      </>
    );
  } else if (!data.submitted) {
    body = (
      <>
        <p className="min-w-0 flex-1 text-sm text-muted">Happy with it? Submit it and it counts toward the community’s {title} list. Changes after that count when you submit again.</p>
        <button type="button" disabled={!placed || busy} onClick={() => run(data.submit, 'Submitted. Thanks! It counts toward the community’s list now.')}
          className="btn-primary inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40">
          <Send size={15} aria-hidden="true" /> Submit to community
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf text-white"><Check size={14} strokeWidth={3} aria-hidden="true" /></span>
          <span className="text-muted">{data.changed ? 'You’ve changed your list since you submitted it. The community still counts the old one.' : 'Submitted. It counts toward the community’s list.'}</span>
        </p>
        {data.changed && (
          <button type="button" disabled={busy} onClick={() => run(data.submit, 'Changes submitted.')} className="btn-primary inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40">
            <Send size={15} aria-hidden="true" /> Submit changes
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => run(data.withdraw, 'Withdrawn. Your list no longer counts; it’s still here.')} className="shrink-0 text-xs font-bold text-muted underline underline-offset-2 hover:text-ink">Withdraw</button>
      </>
    );
  }
  return (
    <div className="mt-3 rounded-2xl bg-card-2 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{body}</div>
      {note && <p role="status" className="mt-2 text-xs font-bold text-muted">{note}</p>}
    </div>
  );
}

/** A unique list: rename or delete it. */
function UniqueBar({ data }: { data: Data }) {
  const u = data.unique!;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(u.title);
  const [sure, setSure] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="mt-3 rounded-2xl bg-card-2 p-3 text-sm">
      {renaming ? (
        <form onSubmit={async (ev) => { ev.preventDefault(); const err = await data.renameUnique(u.id, name); setNote(err); if (!err) setRenaming(false); }} className="flex flex-wrap items-center gap-2">
          <input autoFocus value={name} onChange={(ev) => setName(ev.target.value)} maxLength={40} aria-label="Title"
            className="min-w-48 flex-1 rounded-xl bg-card px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-signal" />
          <button type="submit" disabled={!name.trim()} className="btn-primary rounded-full px-4 py-2 font-bold disabled:opacity-40">Save</button>
          <button type="button" onClick={() => { setRenaming(false); setName(u.title); }} className="rounded-full px-3 py-2 font-bold text-muted hover:text-ink">Cancel</button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-muted">A list of your own. Share it from the top; it doesn’t count toward Community.</p>
          <button type="button" onClick={() => setRenaming(true)} className="font-bold underline underline-offset-2">Rename</button>
          {sure
            ? <span className="font-bold">Delete “{u.title}”? <button type="button" onClick={async () => setNote(await data.deleteUnique(u.id))} className="text-berry underline underline-offset-2">Delete it</button> · <button type="button" onClick={() => setSure(false)} className="underline underline-offset-2">Keep it</button></span>
            : <button type="button" onClick={() => setSure(true)} className="font-bold text-muted underline underline-offset-2 hover:text-ink">Delete list</button>}
        </div>
      )}
      {note && <p role="status" className="mt-2 text-xs font-bold text-berry">{note}</p>}
    </div>
  );
}

/** Below the list: whether its link is shared, and starting over. */
function ListFooter({ data, ctx, placed, onClear }: { data: Data; ctx: BlockContext; placed: number; onClear: () => void }) {
  const [sure, setSure] = useState(false);
  const [note, setNote] = useState('');
  if (!placed && !data.shared) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs">
      {data.shared && data.listId && (
        <span className="text-muted">Its link is shared · <Link href={listPath(ctx.gameId, data.listId)} className="font-bold text-ink underline underline-offset-2">see it</Link> · <button type="button" onClick={() => { data.unshare(); setNote('The link is private again.'); }} className="font-bold text-ink underline underline-offset-2">make it private</button></span>
      )}
      {note && <span role="status" className="font-bold text-muted">{note}</span>}
      {placed > 0 && (sure
        ? <span className="ml-auto font-bold">Clear this whole list? <button type="button" onClick={() => { onClear(); setSure(false); }} className="text-berry underline underline-offset-2">Clear it</button> · <button type="button" onClick={() => setSure(false)} className="underline underline-offset-2">Keep it</button></span>
        : <button type="button" onClick={() => setSure(true)} className="ml-auto font-bold text-muted underline underline-offset-2 hover:text-ink">Start over</button>)}
    </div>
  );
}

// --------------------------------------------------------------------------- dragging

/**
 * Press-and-drag for pieces: straight away with a mouse, after a short press by touch (so a
 * swipe still scrolls the page). Rows mark themselves with data-tier ('' is the tray); pieces
 * with data-id, so a drop on a piece lands just before it.
 */
function useDrag(root: React.RefObject<HTMLDivElement | null>, onDrop: (id: string, tier: string | null, before?: string) => void) {
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; html: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const s = useRef<{ id: string; x: number; y: number; timer?: ReturnType<typeof setTimeout>; on: boolean; moved: boolean; el?: HTMLElement } | null>(null);
  const drop = useRef(onDrop);
  useEffect(() => { drop.current = onDrop; });

  // While dragging by touch, the page mustn't scroll under the finger.
  useEffect(() => {
    const stop = (ev: TouchEvent) => { if (s.current?.on) ev.preventDefault(); };
    document.addEventListener('touchmove', stop, { passive: false });
    return () => document.removeEventListener('touchmove', stop);
  }, []);

  const targetAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const row = el?.closest<HTMLElement>('[data-tier]');
    if (!row || !root.current?.contains(row)) return null;
    return { tier: row.dataset.tier ?? '', before: el?.closest<HTMLElement>('[data-id]')?.dataset.id };
  };

  const start = (id: string, x: number, y: number, el: HTMLElement) => {
    const st = s.current;
    if (!st || st.id !== id) return;
    st.on = true;
    setGhost({ id, x, y, html: el.outerHTML });
    navigator.vibrate?.(10);
  };

  // Moves and the drop are followed on the whole window, so a fast drag that leaves the piece
  // behind (or a finger that slides off it) still lands.
  const follow = (pointerId: number) => {
    const move = (ev: PointerEvent) => {
      const st = s.current;
      if (!st || ev.pointerId !== pointerId) return;
      const far = Math.hypot(ev.clientX - st.x, ev.clientY - st.y) > 8;
      if (!st.on) {
        if (!far) return;
        if (ev.pointerType === 'mouse') start(st.id, ev.clientX, ev.clientY, st.el!);
        else { clearTimeout(st.timer); s.current = null; stop(); return; } // a swipe: let the page scroll
      }
      st.moved = true;
      setGhost((g) => (g ? { ...g, x: ev.clientX, y: ev.clientY } : g));
      const t = targetAt(ev.clientX, ev.clientY);
      setOver(t ? t.tier : null);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const st = s.current;
      s.current = null;
      stop();
      setGhost(null);
      setOver(null);
      if (!st) return;
      clearTimeout(st.timer);
      if (!st.on || !st.moved) return; // a tap: the button's click handles it
      const t = targetAt(ev.clientX, ev.clientY);
      if (t) drop.current(st.id, t.tier || null, t.before !== st.id ? t.before : undefined);
      // The click that follows a drag isn't a tap.
      const swallow = (c: MouseEvent) => { c.stopPropagation(); c.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 50);
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (s.current) clearTimeout(s.current.timer);
      s.current = null;
      stop();
      setGhost(null);
      setOver(null);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const handlers = (id: string) => ({
    onPointerDown: (ev: React.PointerEvent<HTMLButtonElement>) => {
      if (ev.button !== 0) return;
      const el = ev.currentTarget;
      s.current = { id, x: ev.clientX, y: ev.clientY, on: false, moved: false, el };
      if (ev.pointerType !== 'mouse') {
        const { clientX, clientY } = ev;
        s.current.timer = setTimeout(() => start(id, clientX, clientY, el), 280);
      }
      follow(ev.pointerId);
    },
    onContextMenu: (ev: React.MouseEvent) => { if (s.current) ev.preventDefault(); },
  });

  const ghostEl = ghost ? (
    <div aria-hidden="true" className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110 opacity-90 drop-shadow-lg"
      style={{ left: ghost.x, top: ghost.y }} dangerouslySetInnerHTML={{ __html: ghost.html }} />
  ) : null;

  return { handlers, over, ghost: ghostEl };
}
