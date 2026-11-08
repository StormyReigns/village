'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Flag, MessageSquareText, Share2, Sparkles, Undo2, Users, UserRound, X } from 'lucide-react';
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
        ? <CommunityView title={title} tiers={tiers} shown={shown} community={community} data={data} color={color} ranked={ranked} onOpen={setSheet} onMine={toMine} />
        : <MineView title={title} tiers={tiers} shown={shown} data={data} community={community} color={color} ranked={ranked} block={block} ctx={ctx} />}

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

function CommunityView({ title, tiers, shown, community, data, color, ranked, onOpen, onMine }: {
  title: string; tiers: Tier[]; shown: Entry[]; community: Map<string, Community>; data: Data; color: string; ranked: Block;
  onOpen: (id: string) => void; onMine: () => void;
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
        <BoardHead title={title} sub={`${ranked.title}, ranked by everyone’s lists`} chip={chip} />
        {tiers.map((t, i) => (
          // Before anyone has ranked, the rows stay short so the empty board doesn't fill a phone.
          <TierRow key={t.key} t={t} i={i} n={tiers.length} color={color} compact={!any}>
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
        <p className="min-w-0 flex-1 text-muted">Built from everyone’s own lists: each piece sits in the tier most lists give it. Tap one to see why.</p>
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
          {c.settled && <Spread tiers={tiers} counts={counts ?? {}} color={color} />}
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

function Spread({ tiers, counts, color }: { tiers: Tier[]; counts: Counts; color: string }) {
  const n = tiers.reduce((s, t) => s + (counts[t.key] ?? 0), 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-card-2" aria-hidden="true">
        {tiers.map((t, i) => (counts[t.key] ? <span key={t.key} style={{ width: `${(counts[t.key] / n) * 100}%`, background: tierFill(i, tiers.length, color).background }} /> : null))}
      </div>
      <p className="mt-1 text-xs font-bold text-muted">{tiers.filter((t) => counts[t.key]).map((t) => `${t.label} ${counts[t.key]}`).join(' · ')}</p>
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

/** Where your list stands, for the board's header. */
function saveText(data: Data, placed: number): string {
  if (data.error) return data.error;
  if (!data.me) return placed ? 'Kept on this device. Sign in so it counts' : 'Sign in so your list counts';
  if (data.save === 'saving') return 'Saving…';
  return placed ? 'Saved. It counts toward Community' : 'It counts toward Community once you place a piece';
}

function MineView({ title, tiers, shown, data, community, color, ranked, block, ctx }: {
  title: string; tiers: Tier[]; shown: Entry[]; data: Data; community: Map<string, Community>; color: string; ranked: Block; block: Block; ctx: BlockContext;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
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

  const communityFill = () => setList(fromCommunity(shown.map((e) => e.id), (id) => community.get(id)?.tier ?? null));
  const hasCommunity = shown.some((e) => community.get(e.id)?.tier);

  return (
    // Room at the bottom while a piece is picked, so its bar never hides the last row.
    <div className={'mt-3' + (pickedEntry ? ' pb-40' : '')} ref={root}>
      <BoardCard>
        <BoardHead title={title} sub={saveText(data, placed)} chip={`${placed} of ${shown.length}`} />
        {placed === 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line/70 bg-card-2 px-3 py-2 text-sm">
            <p className="min-w-0 flex-1 text-muted">Tap a piece below, then tap a tier. Or press and drag it.</p>
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

      <div data-tier="" onClick={(ev) => { if (picked && pickedTier && !(ev.target as HTMLElement).closest('[data-id]')) drop(null); }}
        className={'mt-3 rounded-2xl border-2 border-dashed p-1.5 transition-colors ' + (over === '' ? 'border-signal bg-signal/10' : picked && pickedTier ? 'cursor-pointer border-signal/70' : 'border-line')}>
        <p className="px-1.5 pt-0.5 text-xs font-bold uppercase tracking-wide text-muted">Not placed · {tray.length}</p>
        {tray.length ? (
          <ul className="mt-0.5 flex flex-wrap gap-x-1">
            {tray.map((e) => <li key={e.id}><PieceButton e={e} block={ranked} color={color} outline picked={picked === e.id} data-id={e.id} onClick={() => pick(e.id)} {...handlers(e.id)} /></li>)}
          </ul>
        ) : <p className="px-1.5 pb-1 text-sm text-muted">Every piece is placed.</p>}
      </div>

      <MineFooter data={data} ctx={ctx} block={block} title={title} placed={placed} onClear={() => { setList({ rows: {}, reasons: {} }); setPicked(null); }} />

      {/* The picked piece's bar, pinned above the phone's tab bar: its tiers and its reason. */}
      {pickedEntry && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-6">
          <div role="toolbar" aria-label={`Place ${pickedEntry.name}`} className="rise mx-auto max-w-lg rounded-3xl bg-ink p-3 text-white shadow-soft">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-bold">{pickedEntry.name}{pickedTier ? ` · ${tiers.find((t) => t.key === pickedTier)?.label}` : ''}</p>
              {pickedTier && (
                <button type="button" onClick={() => setReasonOpen(!reasonOpen)} aria-expanded={reasonOpen}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-white/30 hover:ring-white">
                  <MessageSquareText size={13} aria-hidden="true" /> {list.reasons[pickedEntry.id] ? 'Reason' : 'Add a reason'}
                </button>
              )}
              <button type="button" onClick={() => setPicked(null)} aria-label="Done" className="grid size-8 place-items-center rounded-full bg-white/10 hover:bg-white/20"><Check size={16} aria-hidden="true" /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tiers.map((t) => (
                <button key={t.key} type="button" onClick={() => drop(t.key)} aria-pressed={pickedTier === t.key}
                  className={'min-w-11 flex-1 rounded-full px-2 py-2 text-sm font-extrabold ' + (pickedTier === t.key ? 'bg-signal text-ink' : 'bg-white/10 hover:bg-white/20')}>{t.label}</button>
              ))}
              {pickedTier && (
                <button type="button" onClick={() => drop(null)} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20">
                  <Undo2 size={13} aria-hidden="true" /> Not placed
                </button>
              )}
            </div>
            {reasonOpen && pickedTier && (
              <label className="mt-2 block">
                <span className="sr-only">Why {pickedEntry.name} is here</span>
                <input autoFocus value={list.reasons[pickedEntry.id] ?? ''} maxLength={REASON_MAX} placeholder={`Why ${pickedEntry.name} is here, in a line`}
                  onChange={(ev) => setList(setReason(list, pickedEntry.id, ev.target.value))}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') setReasonOpen(false); }}
                  className="w-full rounded-xl bg-white px-3 py-2 text-sm text-ink outline-none ring-2 ring-transparent focus:ring-signal" />
                <span className="mt-1 block text-[11px] text-white/70">Shown to others without your name. {REASON_MAX - (list.reasons[pickedEntry.id]?.length ?? 0)} left.</span>
              </label>
            )}
          </div>
        </div>
      )}
      {ghost}
    </div>
  );
}

function MineFooter({ data, ctx, block, title, placed, onClear }: { data: Data; ctx: BlockContext; block: Block; title: string; placed: number; onClear: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [sure, setSure] = useState(false);
  const shareIt = async () => {
    const r = await data.share();
    if (!r.id) { setNote(r.error ?? 'Couldn’t share it.'); return; }
    const url = window.location.origin + listPath(ctx.gameId, r.id);
    if (window.matchMedia('(pointer: coarse)').matches && navigator.share) {
      try { await navigator.share({ title: `My ${title} list`, url }); } catch { /* closed the share menu */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); setNote('Link copied. Paste it in Discord or Reddit: it shows a picture of your tiers.'); }
    catch { window.prompt('Copy this link:', url); }
  };
  const signIn = () => router.push(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search + '#' + block.id)}&for=${encodeURIComponent('save your tier list')}`);
  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {data.me ? (
          <button type="button" onClick={shareIt} disabled={!placed} className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40">
            <Share2 size={15} aria-hidden="true" /> Share my list
          </button>
        ) : data.me === null && (
          <button type="button" onClick={signIn} className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">Sign in so it counts</button>
        )}
        {data.shared && data.listId && (
          <span className="text-xs text-muted">Shared · <Link href={listPath(ctx.gameId, data.listId)} className="font-bold text-ink underline underline-offset-2">see it</Link> · <button type="button" onClick={() => { data.unshare(); setNote('Your list is private again.'); }} className="font-bold text-ink underline underline-offset-2">make it private</button></span>
        )}
        {placed > 0 && (sure
          ? <span className="ml-auto text-xs font-bold">Clear your whole list? <button type="button" onClick={() => { onClear(); setSure(false); }} className="text-berry underline underline-offset-2">Clear it</button> · <button type="button" onClick={() => setSure(false)} className="underline underline-offset-2">Keep it</button></span>
          : <button type="button" onClick={() => setSure(true)} className="ml-auto text-xs font-bold text-muted underline underline-offset-2 hover:text-ink">Start over</button>)}
      </div>
      {note && <p role="status" className="text-xs font-bold text-muted">{note}</p>}
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
