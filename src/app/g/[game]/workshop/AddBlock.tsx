'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Info } from 'lucide-react';
import type { BlockType, Page, Tint } from '@/data/pages';
import type { RouteOption } from '@/components/app/EntryPanel';
import { BlockView, type BlockContext } from '@/components/app/Blocks';
import { BlockIcon } from '@/components/Icon';
import { Piece } from '@/components/Piece';
import { Tip } from '@/components/Tip';
import { EditorShell } from './EditorShell';
import { browserClient } from '@/lib/supabase/browser';
import { appChanged } from '@/app/actions';
import { BLOCK_TYPES, RANKABLE, SYMBOLS, blockTypeInfo, keyFrom } from '@/lib/block-types';
import { samplePage } from '@/lib/sample-game';
import { plannerRosters } from '@/lib/planner';
import { DEFAULT_TIERS } from '@/lib/tiers';

/** The eight Page colors, in the order Pages usually take them (CLAUDE.md, Brand rules). */
const TINTS: Tint[] = ['berry', 'indigo', 'sun', 'plum', 'sky', 'teal', 'leaf', 'slate'];
const TINT_NAMES: Record<Tint, string> = { berry: 'Berry', indigo: 'Indigo', sun: 'Sun', plum: 'Plum', sky: 'Sky', teal: 'Teal', leaf: 'Leaf', slate: 'Slate' };

const input = 'w-full rounded-xl px-3 py-2 text-sm outline-none placeholder:text-muted';
const label = 'text-sm font-bold';

/** What's typed so far, kept on the device (until a Builder can submit it as a Draft). */
interface Form {
  type: BlockType | null;
  title: string;
  icon: string | null;
  intro: string;
  byRoute: boolean;
  pageId: string | null;
  pageTitle: string;
  pageShort: string;
  pageIcon: string | null;
  tint: Tint | null;
  ranks: string;
  roster: string;
  classes: string;
  size: string;
}

const EMPTY: Form = { type: null, title: '', icon: null, intro: '', byRoute: false, pageId: null, pageTitle: '', pageShort: '', pageIcon: null, tint: null, ranks: '', roster: '', classes: '', size: '' };

const readForm = (key: string): Form | null => {
  try { const v = localStorage.getItem(key); return v ? { ...EMPTY, ...JSON.parse(v) } : null; } catch { return null; }
};
const writeForm = (key: string, f: Form) => { try { localStorage.setItem(key, JSON.stringify(f)); } catch { /* storage off */ } };
const forgetForm = (key: string) => { try { localStorage.removeItem(key); } catch { /* storage off */ } };

/**
 * Adding a Block to a Page, or a new Page with its first Block (from the "+" after the Page tabs).
 * The Block type is a dropdown at the top left; moving through it shows each type's example on the
 * right, from a made-up game. Once a type is picked, the example wears the Builder's choices (its
 * name, symbol, intro and the Page's color), so the preview is their work from the first change.
 * Moderators add it straight away. Anyone else can fill it in and keep it on their device:
 * suggesting a Page or Block for votes comes with its database step (slice 2).
 */
export function AddBlock({ gameId, pages, routes, mod, startPage, newPage, onClose, onAdded }: {
  gameId: string; pages: Page[]; routes: RouteOption[];
  mod: boolean;
  /** The Page that was open, for a Block. */
  startPage: string | null;
  /** A new Page, with its first Block. */
  newPage: boolean;
  onClose: () => void;
  onAdded: (pageId: string) => void;
}) {
  const router = useRouter();
  const draftKey = `village:${newPage ? 'add-page' : 'add-block'}:${gameId}`;
  const [saved] = useState(() => readForm(draftKey));
  const usedTints = new Set(pages.map((p) => p.tint));
  const [form, setForm] = useState<Form>(() => saved ?? {
    ...EMPTY,
    pageId: newPage ? null : (startPage && pages.some((p) => p.id === startPage) ? startPage : pages[0]?.id ?? null),
    tint: newPage ? TINTS.find((t) => !usedTints.has(t)) ?? 'leaf' : null,
  });
  const set = (p: Partial<Form>) => { setForm((f) => ({ ...f, ...p })); setNote(''); };
  const [note, setNote] = useState(saved ? 'Picked up where you left off.' : '');
  const [busy, setBusy] = useState(false);
  // The type list starts open, so the first thing to do is right there.
  const [open, setOpen] = useState(!saved?.type);
  const [peek, setPeek] = useState<BlockType | null>(null);

  const page = newPage ? null : pages.find((p) => p.id === form.pageId) ?? null;
  const allBlocks = pages.flatMap((p) => p.blocks.map((b) => ({ ...b, page: p })));
  const rankable = (page?.blocks ?? []).filter((b) => RANKABLE.includes(b.type));
  const rosters = allBlocks.filter((b) => b.type === 'characters');
  const classBlocks = allBlocks.filter((b) => b.type === 'classes');
  // Why a type can't be picked here, if it can't.
  const blocked = (t: BlockType): string | null =>
    t === 'tierlist' && !rankable.length ? (newPage ? 'Ranks a Characters, Items or Classes Block on the same Page, so add one of those first' : `Needs a Characters, Items or Classes Block on ${page?.title ?? 'this Page'} to rank`)
    : t === 'planner' && !rosters.length ? 'Needs a Characters Block in this game to pick a party from'
    : null;

  const type = form.type;
  const info = type ? blockTypeInfo(type) : null;
  const shownType = peek ?? type;
  const shownInfo = shownType ? blockTypeInfo(shownType) : null;
  const tint: Tint = (newPage ? form.tint : page?.tint) ?? 'leaf';
  const blockIcon = form.icon ?? info?.icon ?? 'BookOpen';
  const pageIcon = form.pageIcon ?? blockIcon;
  const ranks = rankable.some((b) => b.id === form.ranks) ? form.ranks : rankable[0]?.id ?? '';
  const roster = rosters.some((b) => b.id === form.roster) ? form.roster : rosters[0]?.id ?? '';
  const pageTitle = newPage ? form.pageTitle : page?.title ?? '';
  const short = form.pageShort.trim() || form.pageTitle.trim().split(/\s+/)[0] || '';

  // The preview: while moving through the list, that type's plain example; once picked, the example
  // with the Builder's choices on it.
  const preview = (() => {
    if (!shownType) return null;
    const mine = shownType === type;
    const { page: p, block } = samplePage({
      type: shownType,
      title: mine ? form.title || info?.name || '' : shownInfo?.name ?? '',
      icon: mine ? blockIcon : shownInfo?.icon ?? 'BookOpen',
      intro: mine ? form.intro : '',
      tint,
      pageTitle: pageTitle || 'New Page',
      pageIcon: newPage ? pageIcon : page?.icon ?? 'BookOpen',
    });
    const ctx: BlockContext = {
      gameId, page: p, pageTitle: p.title, tint, route: 'all', routes: [], spoilers: false,
      onShowSpoilers: () => {}, rosters: plannerRosters([p], p),
    };
    return { block, ctx, page: p };
  })();

  const dirty = JSON.stringify(form) !== JSON.stringify(saved ?? { ...EMPTY, pageId: form.pageId, tint: form.tint });

  const problem = (): string | null => {
    if (newPage && !form.pageTitle.trim()) return 'Give the Page a name.';
    if (newPage && !/[a-z0-9]/i.test(form.pageTitle)) return 'The Page\'s name needs at least one letter or number.';
    if (!newPage && !page) return 'Pick the Page it goes on.';
    if (!type) return 'Pick a Block type.';
    if (blocked(type)) return blocked(type);
    return null;
  };

  const add = async () => {
    const p = problem();
    if (p) { setNote(p); return; }
    const db = browserClient();
    if (!db) { setNote('Sign in first.'); return; }
    setBusy(true);
    // Every Page and Block key in the game, including ones the Workshop doesn't list (Tier lists), so
    // the new ones don't clash; and the last places, so the new ones go at the end.
    const [pg, bl] = await Promise.all([
      db.from('app_pages').select('page_key, position').eq('game_id', gameId),
      db.from('game_blocks').select('block_key, position').eq('game_id', gameId),
    ]);
    if (pg.error || bl.error) { setBusy(false); setNote(`Couldn't add it: ${(pg.error ?? bl.error)!.message}`); return; }
    const unique = (base: string, taken: Set<string>) => {
      const start = base.length >= 2 ? base : `${base || 'new'}-page`.slice(0, 40);
      let key = start;
      for (let n = 2; taken.has(key); n++) key = `${start}-${n}`;
      return key;
    };
    const last = (rows: { position: number }[]) => rows.reduce((m, r) => Math.max(m, r.position), -1) + 1;

    let pageKey = page?.id ?? '';
    if (newPage) {
      pageKey = unique(keyFrom(form.pageTitle), new Set((pg.data ?? []).map((r) => r.page_key as string)));
      const { error } = await db.from('app_pages').insert({
        game_id: gameId, page_key: pageKey, title: form.pageTitle.trim(), short: short.slice(0, 24), icon: pageIcon, tint, blurb: '', position: last(pg.data ?? []),
      });
      if (error) { setBusy(false); setNote(`Couldn't add the Page: ${error.message}`); return; }
    }
    const title = form.title.trim() || info!.name;
    const blockKey = unique(keyFrom(title), new Set((bl.data ?? []).map((r) => r.block_key as string)));
    const size = Number(form.size);
    const { error } = await db.from('game_blocks').insert({
      game_id: gameId, block_key: blockKey, title, position: last(bl.data ?? []), page_key: pageKey, type, icon: blockIcon,
      intro: form.intro.trim() || null,
      filters: type === 'characters' ? ['Role or class'] : type === 'items' ? ['Type'] : type === 'classes' ? ['Tier'] : [],
      by_route: Boolean(routes.length && form.byRoute && type !== 'guide' && type !== 'tierlist'),
      tier_setup: type === 'tierlist' ? { ranks, tiers: DEFAULT_TIERS } : null,
      plan_setup: type === 'planner' ? {
        roster, ...(form.classes && classBlocks.some((b) => b.id === form.classes) ? { classes: form.classes } : {}),
        ...(size > 0 ? { size: Math.min(100, Math.round(size)) } : {}),
      } : null,
    });
    if (error) {
      // Don't leave an empty Page behind.
      if (newPage) await db.from('app_pages').delete().eq('game_id', gameId).eq('page_key', pageKey);
      setBusy(false);
      setNote(`Couldn't add the Block: ${error.message}`);
      return;
    }
    forgetForm(draftKey);
    await appChanged(gameId);
    router.refresh();
    setBusy(false);
    onAdded(pageKey);
  };

  const keep = () => { writeForm(draftKey, form); setNote('Kept on this device. It\'s here the next time you open this.'); };
  const what = newPage ? 'Page' : 'Block';

  return (
    <EditorShell
      label={newPage ? 'New Page' : 'Add a Block'}
      title={newPage ? (form.pageTitle.trim() ? `New Page: ${form.pageTitle.trim()}` : 'New Page') : `Add a Block${page ? ` to ${page.title}` : ''}`}
      titleExtra={
        <Tip text={newPage ? 'A Page is a topic in the app, like Units or World. It gets a color and a symbol, and at least one Block.' : 'A Block is one part of a Page, like a list of characters or a tier list. Pick a type, and the example shows what it looks like filled in.'}>
          <button type="button" aria-label={`What a ${what} is`} className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
            <Info size={17} aria-hidden="true" />
          </button>
        </Tip>
      }
      actions={mod ? (
        <button type="button" onClick={add} disabled={busy} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
          {busy ? 'Adding…' : newPage ? 'Add Page' : 'Add Block'}
        </button>
      ) : (
        <button type="button" onClick={keep} aria-label="Keep on this device" className="rounded-full bg-card px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">
          <span className="sm:hidden">Keep</span><span className="hidden sm:inline">Keep on this device</span>
        </button>
      )}
      note={note && <p role="status" className={/^(Kept|Picked)/.test(note) ? 'text-leaf' : 'text-berry'}>{note}</p>}
      onClose={onClose}
      dirty={dirty}
      onSaveDraft={() => { writeForm(draftKey, form); onClose(); }}
      onDiscard={() => { forgetForm(draftKey); onClose(); }}
      draftHint={`Save draft keeps this new ${what} on this device, ready the next time you open it. Discard throws it away.`}
      tint={tint}
      sheetExtra={shownType ? <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-bold text-muted ring-1 ring-line">Example entries</span> : undefined}
      editor={
        <>
          {/* The type, first and at the top left. */}
          <TypePicker type={type} open={open} setOpen={setOpen} peek={peek} setPeek={setPeek} blocked={blocked}
            onPick={(t) => { set({ type: t }); setOpen(false); setPeek(null); }} />

          {newPage ? (
            <fieldset className="grid gap-3 rounded-2xl bg-card/70 p-3 ring-1 ring-line">
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">The Page</legend>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="grid gap-1">
                  <span className={label}>Name <span className="text-berry">*</span></span>
                  <input value={form.pageTitle} maxLength={40} onChange={(e) => set({ pageTitle: e.target.value })} placeholder="Units, World, Story…" className={input} />
                </label>
                <label className="grid gap-1">
                  <span className={label}>Short name <span className="font-normal text-muted">(phone bar)</span></span>
                  <input value={form.pageShort} maxLength={12} onChange={(e) => set({ pageShort: e.target.value })} placeholder={short || 'One word'} className={input} />
                </label>
              </div>
              <div className="grid gap-1">
                <span className={label}>Color</span>
                <div role="radiogroup" aria-label="Page color" className="flex flex-wrap gap-2">
                  {TINTS.map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={form.tint === t} onClick={() => set({ tint: t })}
                      aria-label={`${TINT_NAMES[t]}${usedTints.has(t) ? ', used by another Page' : ''}`} title={`${TINT_NAMES[t]}${usedTints.has(t) ? ' (used by another Page)' : ''}`}
                      className={'relative grid size-9 place-items-center rounded-full ring-offset-2 ' + (form.tint === t ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line')}
                      style={{ background: `var(--${t})` }}>
                      {form.tint === t && <Check size={16} className="text-white" aria-hidden="true" />}
                      {usedTints.has(t) && form.tint !== t && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-card ring-2 ring-card" style={{ boxShadow: 'inset 0 0 0 3px var(--muted)' }} />}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted">Each Page has its own color. A dot means another Page has it already.</span>
              </div>
              <SymbolPicker value={pageIcon} color={`var(--${tint})`} onPick={(s) => set({ pageIcon: s })} label="Page symbol" />
            </fieldset>
          ) : (
            <div className="grid gap-1">
              <span className={label}>On the Page</span>
              <div role="radiogroup" aria-label="Page" className="flex flex-wrap gap-1.5">
                {pages.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={p.id === form.pageId} onClick={() => set({ pageId: p.id })}
                    className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (p.id === form.pageId ? 'bg-ink text-paper ring-ink' : 'bg-card ring-line hover:ring-ink')}>
                    <BlockIcon name={p.icon} size={14} style={{ color: p.id === form.pageId ? undefined : `var(--${p.tint})` }} /> {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type && (
            <fieldset className="grid gap-3 rounded-2xl bg-card/70 p-3 ring-1 ring-line">
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">The Block</legend>
              <label className="grid gap-1">
                <span className={label}>Name</span>
                <input value={form.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} placeholder={`${info?.name}, or your game's word: ${info?.example}`} className={input} />
              </label>
              <label className="grid gap-1">
                <span className={label}>A line about it <span className="font-normal text-muted">(optional)</span></span>
                <input value={form.intro} maxLength={200} onChange={(e) => set({ intro: e.target.value })} placeholder="What's here, in a sentence" className={input} />
              </label>
              <SymbolPicker value={blockIcon} color={`var(--${tint})`} onPick={(s) => set({ icon: s })} label="Block symbol" />

              {type === 'tierlist' && rankable.length > 0 && (
                <label className="grid gap-1">
                  <span className={label}>What it ranks</span>
                  <select value={ranks} onChange={(e) => set({ ranks: e.target.value })} className={input}>
                    {rankable.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                  </select>
                </label>
              )}
              {type === 'planner' && rosters.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1">
                    <span className={label}>Party from</span>
                    <select value={roster} onChange={(e) => set({ roster: e.target.value })} className={input}>
                      {rosters.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.page.title})</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className={label}>Class steps from</span>
                    <select value={form.classes} onChange={(e) => set({ classes: e.target.value })} className={input}>
                      <option value="">None</option>
                      {classBlocks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className={label}>Party size</span>
                    <input type="number" min={1} max={100} value={form.size} onChange={(e) => set({ size: e.target.value })} placeholder="No limit" className={input} />
                  </label>
                </div>
              )}
              {routes.length > 0 && type !== 'guide' && type !== 'tierlist' && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={form.byRoute} onChange={(e) => set({ byRoute: e.target.checked })} className="mt-0.5 size-4 accent-[var(--color-ink)]" />
                  <span><span className="font-bold">Changes with the route.</span> Entries can belong to some routes, and players pick theirs.</span>
                </label>
              )}
              <p className="text-xs text-muted">
                {type === 'characters' || type === 'items' || type === 'classes' || type === 'guide'
                  ? `It starts with the usual ${info?.name} fields. Once it's added, Set up renames, adds or switches them off.`
                  : type === 'planner' ? 'Gear slots and the next-step line are in Set up once it\'s added.'
                  : type === 'tierlist' ? 'It starts with S, A, B, C and D. Players rank, and every list counts toward the community tier.'
                  : 'A first version: it works, and gets a proper design pass later.'}
              </p>
            </fieldset>
          )}

          {!mod && (
            <p className="rounded-2xl bg-sky-soft px-3 py-2.5 text-sm">
              Adding a Page or Block changes the app for everyone, so for now a moderator adds it.{' '}
              Suggesting one for votes is coming soon. Until then, fill it in, keep it on this device, and share the idea in the chat.
            </p>
          )}
        </>
      }
      preview={preview ? (
        <div className="grid gap-3" inert>
          {/* The Page as players meet it: its symbol in a piece, and its name. */}
          {newPage && (
            <div className="flex items-center gap-3">
              <Piece size={44} color={`var(--${tint})`}><span className="text-white"><BlockIcon name={pageIcon} size={15} strokeWidth={2.4} /></span></Piece>
              <h3 className="font-display text-xl">{preview.page.title}</h3>
            </div>
          )}
          <div className="rounded-[1.25rem] bg-card ring-1 ring-line">
            <BlockView block={preview.block} ctx={preview.ctx} />
          </div>
          <p className="text-xs text-muted">
            {shownType === type ? 'Example entries from a made-up game, laid out by your choices. Real entries replace them once they\'re added.' : `${shownInfo?.name}: ${shownInfo?.question}`}
          </p>
        </div>
      ) : (
        <div className="grid min-h-40 place-items-center rounded-2xl bg-card/70 px-4 py-8 text-center text-sm text-muted ring-1 ring-line">
          Pick a Block type, and an example of it shows here.
        </div>
      )}
    />
  );
}

/** The Block type, as a dropdown. Moving through it (hover or arrow keys) shows that type's example. */
function TypePicker({ type, open, setOpen, peek, setPeek, blocked, onPick }: {
  type: BlockType | null; open: boolean; setOpen: (v: boolean) => void;
  peek: BlockType | null; setPeek: (t: BlockType | null) => void;
  blocked: (t: BlockType) => string | null; onPick: (t: BlockType) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const info = type ? blockTypeInfo(type) : null;
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setPeek(null); } };
    // Escape closes the list first, wherever focus is, before it would close the editor.
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); setPeek(null); } };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc, true); };
  }, [open, setOpen, setPeek]);
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); setPeek(type ?? BLOCK_TYPES[0].type); return; }
    if (!open) return;
    const i = BLOCK_TYPES.findIndex((t) => t.type === (peek ?? type));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = BLOCK_TYPES[(i + (e.key === 'ArrowDown' ? 1 : -1) + BLOCK_TYPES.length) % BLOCK_TYPES.length];
      setPeek(next.type);
    } else if (e.key === 'Enter' && peek) {
      e.preventDefault();
      if (!blocked(peek)) onPick(peek);
    }
  };
  return (
    <div ref={box} className="relative" onKeyDown={onKey}>
      <span className="mb-1 block text-sm font-bold">Block type</span>
      <button type="button" onClick={() => { setOpen(!open); setPeek(null); }} aria-haspopup="listbox" aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2 text-left shadow-[inset_0_0_0_1.5px_var(--ink)] focus-visible:shadow-[inset_0_0_0_1.5px_var(--ink),0_0_0_3px_var(--signal)] focus-visible:outline-none">
        {info ? (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2"><BlockIcon name={info.icon} size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold leading-tight">{info.name}</span>
              <span className="block truncate text-xs text-muted">{info.question}</span>
            </span>
          </>
        ) : <span className="flex-1 py-1.5 font-bold text-muted">Pick a Block type</span>}
        <ChevronDown size={18} className={'shrink-0 transition ' + (open ? 'rotate-180' : '')} aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" aria-label="Block types" className="absolute inset-x-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-2xl bg-card p-1 shadow-soft ring-1 ring-ink"
          onMouseLeave={() => setPeek(null)}>
          {BLOCK_TYPES.map((t) => {
            const why = blocked(t.type);
            const on = (peek ?? type) === t.type;
            return (
              <li key={t.type} role="option" aria-selected={type === t.type} aria-disabled={Boolean(why)}
                onMouseEnter={() => setPeek(t.type)} onClick={() => { if (!why) onPick(t.type); }}
                className={'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ' + (on ? 'bg-card-2' : '') + (why ? ' cursor-default' : '')}>
                <span className={'grid size-9 shrink-0 place-items-center rounded-full ' + (type === t.type ? 'bg-signal text-ink' : 'bg-card-2')}><BlockIcon name={t.icon} size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className={'flex items-center gap-1.5 font-bold leading-tight' + (why ? ' text-muted' : '')}>
                    {t.name}
                    {t.firstVersion && <span className="rounded-full bg-card-2 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-muted ring-1 ring-line">First version</span>}
                  </span>
                  <span className="block text-xs text-muted">{why ?? t.question}</span>
                </span>
                {type === t.type && <Check size={16} className="shrink-0" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A small grid of symbols; the chosen one sits in a piece, as it will in the app. */
function SymbolPicker({ value, color, onPick, label: name }: { value: string; color: string; onPick: (s: string) => void; label: string }) {
  return (
    <div className="grid gap-1">
      <span className={label}>Symbol</span>
      <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1">
        {SYMBOLS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={value === s} aria-label={s} onClick={() => onPick(s)}
            className={'grid size-9 place-items-center rounded-full ' + (value === s ? '' : 'text-muted hover:bg-card hover:text-ink')}>
            {value === s ? <Piece size={34} color={color}><span className="text-white"><BlockIcon name={s} size={14} strokeWidth={2.4} /></span></Piece> : <BlockIcon name={s} size={17} />}
          </button>
        ))}
      </div>
    </div>
  );
}

