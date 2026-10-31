'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import type { Block, Entry, EntryContent, Page, Route, Section } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { SignInPrompt } from '@/components/SignInPrompt';
import { ScrollRow } from '@/components/ScrollRow';
import type { Villager } from '@/components/useVillager';
import { EntryDetails, EntryIcon, type RouteOption } from '@/components/app/EntryPanel';
import { CharacterCard } from '@/components/app/CharacterCard';
import { entryText } from '@/components/app/entries';
import { rank } from '@/lib/search';
import { fieldsOf } from '@/lib/fields';
import { CharacterInputs } from './CharacterInputs';
import { SHEET, SheetHandle, useWide } from './split';
import { changesBetween } from './changes';
import { clearUnsent, hasWriting, saveUnsent, type Unsent } from './unsent';
import type { NewDraft } from './useWorkshop';

/** Where the form opens: a Block to add to, optionally the entry being fixed, and the one
 *  part of it to fix ("description", "routes", "section:Where to get it") from an app pencil. */
export interface FormStart { blockId: string; entryId?: string; field?: string; theory?: boolean }

/** What happened when a Draft was sent, for the Workshop's thank-you note. */
export interface Posted { pageId: string; blockId: string; entryId?: string; draftId?: string; name: string }

// Suggested "+" section labels for each Block type, before the Block has its own.
const DEFAULT_LABELS: Record<Block['type'], string[]> = {
  collection: ['Where to find it', 'Tips', 'Wiki link'],
  guide: ['Steps', 'Tip'],
  checklist: ['Before'],
  timeline: [],
  characters: [],
};

const DESCRIPTION_LABEL: Record<Block['type'], string> = {
  collection: 'Description',
  guide: 'Intro (optional)',
  checklist: 'How not to miss it',
  timeline: 'What happens (spoiler-light)',
  characters: 'Description',
};

const blank = (): EntryContent => ({ name: '', sections: [], categories: {} });

/** Copies an entry's content so the form can change it freely. */
function contentOf(e: Entry): EntryContent {
  const copy: Partial<Entry> = JSON.parse(JSON.stringify(e));
  delete copy.id;
  delete copy.ref;
  return { ...copy, name: copy.name ?? '', sections: copy.sections ?? [], categories: copy.categories ?? {} };
}

/** Trims everything and drops what's empty, so Drafts stay tidy. */
function clean(c: EntryContent): EntryContent {
  const t = (s?: string) => s?.trim() || undefined;
  const sections = c.sections.map((s) => ({ label: s.label.trim(), text: s.text.trim() })).filter((s) => s.label && s.text);
  const categories = Object.fromEntries(Object.entries(c.categories).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  const perRoute = Object.fromEntries(Object.entries(c.perRoute ?? {})
    .map(([r, ss]) => [r, (ss ?? []).map((s) => ({ label: s.label.trim(), text: s.text.trim() })).filter((s) => s.label && s.text)])
    .filter(([, ss]) => (ss as Section[]).length));
  return {
    ...c,
    name: c.name.trim(),
    description: t(c.description),
    stat: t(c.stat),
    stats: c.stats && Object.keys(c.stats).length ? c.stats : undefined,
    sections,
    categories,
    perRoute: Object.keys(perRoute).length ? perRoute : undefined,
    routes: c.routes?.length ? c.routes : undefined,
    spoiler: c.spoiler || undefined,
    flag: c.flag || undefined,
    source: undefined, // the Draft keeps its own source
  };
}

const input = 'w-full rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky';

export function EntryForm({ gameId, pages, routes, start, restore, me, postDraft, onClose, onPosted, onDiscard }: {
  gameId: string; pages: Page[]; routes: RouteOption[]; start: FormStart; restore?: Unsent | null; me: Villager | null | undefined;
  postDraft: (d: NewDraft) => Promise<{ error?: string; id?: string }>; onClose: () => void; onPosted: (p: Posted) => void; onDiscard: () => void;
}) {
  const blocks = useMemo(() => pages.flatMap((p) => p.blocks.map((b) => ({ ...b, page: p }))), [pages]);
  const [blockId, setBlockId] = useState(start.blockId);
  const block = blocks.find((b) => b.id === blockId) ?? blocks[0];
  const [fixing, setFixing] = useState<Entry | undefined>(() => block?.entries.find((e) => e.id === start.entryId));
  const [content, setContent] = useState<EntryContent>(() => {
    if (restore) return restore.content;
    const c = fixing ? contentOf(fixing) : blank();
    // From an "Add it" invitation: start the missing part, empty, ready to fill in.
    const label = start.field?.startsWith('section:') ? start.field.slice(8) : null;
    if (label && !c.sections.some((s) => s.label === label)) c.sections = [...c.sections, { label, text: '' }];
    // From "Share a theory": it's marked as not confirmed yet.
    if (start.theory) c.flag = 'unconfirmed';
    return c;
  });
  const [source, setSource] = useState(restore?.source ?? '');
  // From an app pencil: show just that part, with the rest folded under "Edit other parts".
  const [showAll, setShowAll] = useState(!start.field || !fixing);
  const [focusSection] = useState(() => start.field?.startsWith('section:') ? content.sections.findIndex((s) => s.label === start.field!.slice(8)) : -1);
  const [renamingRoutes, setRenamingRoutes] = useState(false);
  const show = (part: string) => showAll || start.field === part;
  // The part being fixed is highlighted, and is where the form scrolls to.
  const hl = (part: string) => (!showAll && start.field === part ? ' rounded-2xl bg-sun-soft/50 p-2.5 ring-2 ring-sun' : '');
  const fid = (part: string) => (!showAll && start.field === part ? 'fix-focus' : undefined);
  useEffect(() => {
    // Bring the part being fixed (or, coming back from signing in, the submit button) into view.
    const id = restore ? 'entry-actions' : !showAll ? 'fix-focus' : null;
    if (!id) return;
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (!restore) el?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the form opens
  }, []);

  // Keep what's been written on this device, so signing in partway doesn't lose it.
  // A fix only counts once it differs from what's in the app.
  useEffect(() => {
    const worth = fixing
      ? Boolean(source.trim()) || JSON.stringify(clean(content)) !== JSON.stringify(clean(contentOf(fixing)))
      : hasWriting(content, source);
    if (worth) saveUnsent(gameId, { blockId, entryId: fixing?.id, content, source });
  }, [gameId, blockId, fixing, content, source]);
  const [find, setFind] = useState('');
  // Characters on a phone: the form on top, the preview on a sheet underneath (see split.tsx).
  const [sheet, setSheet] = useState<number>(SHEET.start);
  const wide = useWide();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!block) return null;
  const page = block.page;
  const set = (patch: Partial<EntryContent>) => { setContent((c) => ({ ...c, ...patch })); setNote(''); };
  const choose = (b: string) => { setBlockId(b); setFixing(undefined); setContent(blank()); setNote(''); };
  const fix = (e: Entry) => { setFixing(e); setContent(contentOf(e)); setFind(''); setNote(''); };

  // Labels and values this Block already uses, offered as suggestions so they stay consistent.
  const labels = [...new Set([...block.entries.flatMap((e) => e.sections.map((s) => s.label)), ...DEFAULT_LABELS[block.type]])];
  const values = (k: string) => [...new Set(block.entries.map((e) => e.categories[k]).filter(Boolean))];
  const routeLabel = block.entries.flatMap((e) => Object.values(e.perRoute ?? {}).flat()).map((s) => s.label)[0];
  const showStat = block.type === 'collection' && (block.look === 'rows' || block.statName || block.entries.some((e) => e.stat));
  const byRoute = block.byRoute && routes.length > 0;

  const cleaned = clean(content);
  const changes = fixing ? changesBetween(contentOf(fixing), cleaned, block, routes) : [];
  const unchanged = Boolean(fixing) && changes.length === 0;

  // A blank box takes that stat away; the numbers keep the Block's own order.
  const setStat = (key: string, v: string) => {
    const next = { ...content.stats };
    if (v.trim() === '' || !Number.isFinite(Number(v))) delete next[key]; else next[key] = Number(v);
    set({ stats: Object.keys(next).length ? next : undefined });
  };
  // Characters: each field is asked for by name; its value is the section (or tag) under the field's key.
  const people = block.type === 'characters';
  const fieldKeys = new Set(people ? fieldsOf(block).map((f) => f.key) : []);
  const setField = (key: string, text: string) => set({ sections: content.sections.some((s) => s.label === key)
    ? content.sections.map((s) => (s.label === key ? { ...s, text } : s)) : [...content.sections, { label: key, text }] });
  const setSection = (i: number, patch: Partial<Section>) => set({ sections: content.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const currentRouteLabel = Object.values(content.perRoute ?? {}).flat()[0]?.label ?? routeLabel;
  const perRouteText = (r: Route) => content.perRoute?.[r]?.[0]?.text ?? '';
  const setPerRoute = (r: Route, text: string) => {
    const label = Object.values(content.perRoute ?? {}).flat()[0]?.label || routeLabel || 'Note';
    set({ perRoute: { ...content.perRoute, [r]: [{ label, text }] } });
  };
  const setPerRouteLabel = (label: string) =>
    set({ perRoute: Object.fromEntries(routes.map((r) => [r.key, [{ label, text: perRouteText(r.key) }]])) });
  const toggleRoute = (r: Route) => {
    const now = content.routes?.length ? content.routes : routes.map((o) => o.key);
    // Taking an entry off a route hides it for those players, so check first.
    const label = routes.find((o) => o.key === r)?.label ?? r;
    if (now.includes(r) && !window.confirm(`Take "${content.name || 'this entry'}" off ${label}'s route? Players on that route won't see it.`)) return;
    const next = now.includes(r) ? now.filter((x) => x !== r) : [...now, r];
    set({ routes: next.length === routes.length ? undefined : next });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleaned.name) { setNote('Give it a name first.'); document.getElementById('entry-name')?.focus(); return; }
    if (cleaned.name.length < 3 || cleaned.name.length > 120) { setNote('Names need 3 to 120 characters.'); return; }
    if (unchanged) { setNote("Nothing has changed yet. Edit a field, then submit."); return; }
    setBusy(true);
    const res = await postDraft({
      blockKey: block.id, kind: 'fact', title: cleaned.name, content: cleaned, source: source.trim(),
      theory: cleaned.flag === 'unconfirmed', cardId: fixing?.ref?.card, baseRevision: fixing?.ref?.revision,
    });
    setBusy(false);
    if (res.error) setNote(res.error);
    else { clearUnsent(gameId); onPosted({ pageId: page.id, blockId: block.id, entryId: fixing?.id, draftId: res.id, name: cleaned.name }); }
  };

  const found = find.trim() ? rank(block.entries, find, entryText).slice(0, 6) : [];

  // Old and new for each field a fix changes.
  const changeBox = fixing ? (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-line">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">What changes</p>
      {changes.length === 0 ? <p className="mt-1 text-sm text-muted">Nothing yet. Edit a field and the change shows here.</p> : <ChangeList changes={changes} />}
    </div>
  ) : null;

  // Notes and the Page and Block choice. For characters they scroll with the form, so on a
  // phone the preview below keeps its room.
  const intro = (
    <>
        {me === null && !restore && (
              <p className="mt-2 rounded-2xl bg-sky-soft px-3 py-2 text-sm">
                Write as much as you like. You&apos;ll sign in when you submit, and nothing you write here is lost.
              </p>
            )}
            {restore && (
              <p role="status" className="mt-2 rounded-2xl bg-leaf-soft px-3 py-2 text-sm text-leaf">Picked up where you left off. Everything you wrote is still here.</p>
            )}
    
            {!fixing && (
              <div className="mt-3 grid gap-2">
                <ScrollRow className="-mx-1 flex gap-2 px-1 pb-1" role="group" label="Page">
                  {pages.map((p) => (
                    <button key={p.id} type="button" onClick={() => p.blocks[0] && choose(p.blocks[0].id)} aria-pressed={p.id === page.id} disabled={!p.blocks.length}
                      className={'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (p.id === page.id ? 'bg-leaf text-paper ring-leaf' : 'bg-card ring-line hover:ring-leaf')}>
                      <BlockIcon name={p.icon} size={14} /> {p.title}
                    </button>
                  ))}
                </ScrollRow>
                {page.blocks.length > 1 && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Block">
                    {page.blocks.map((b) => (
                      <button key={b.id} type="button" onClick={() => choose(b.id)} aria-pressed={b.id === block.id}
                        className={'rounded-full px-3 py-1 text-sm font-bold ring-1 ' + (b.id === block.id ? 'bg-ink text-paper ring-ink' : 'bg-card-2 ring-line hover:ring-ink')}>
                        {b.title}
                      </button>
                    ))}
                  </div>
                )}
                {block.entries.length > 0 && (
                  <div className="relative">
                    <label className="flex items-center gap-2 rounded-full bg-card-2 px-3 py-2 text-sm ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
                      <Search size={15} className="text-muted" aria-hidden="true" />
                      <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={`Fixing something already in ${block.title}? Find it here`}
                        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
                    </label>
                    {found.length > 0 && (
                      <ul className="surface pop absolute inset-x-0 z-10 mt-1 grid gap-0.5 rounded-2xl p-1.5">
                        {found.map((x) => (
                          <li key={x.id}>
                            <button type="button" onClick={() => fix(x)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-card-2">
                              <EntryIcon entry={x} block={block} size="sm" /> <span className="font-bold">{x.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
    </>
  );

  return (
    <div className={'fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-sm ' + (people ? 'md:items-center md:p-6' : 'sm:items-center sm:p-6')} onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={fixing ? `Fix ${fixing.name}` : 'New entry'} onClick={(e) => e.stopPropagation()}
        className={people
          // Characters on a phone: full screen, the form and the preview each scrolling on their own.
          ? 'workbench rise flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden shadow-soft outline-none md:block md:h-auto md:max-h-[92vh] md:overflow-y-auto md:rounded-[2rem] md:p-6'
          : 'rise max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-card p-5 shadow-soft outline-none sm:rounded-[2rem] sm:p-6'}>
        <div className={'flex items-center gap-3' + (people ? ' shrink-0 px-4 py-2.5 md:p-0' : '')}>
          <h2 className={'font-display ' + (people ? 'truncate text-xl md:text-2xl' : 'text-2xl')}>{fixing ? `Fix: ${fixing.name}` : `New in ${block.title}`}</h2>
          {people && (
            <div id="entry-actions" className="ml-auto shrink-0">
              {me === null ? (
                <SignInPrompt back="?resume=1" forWhat={fixing ? `send your fix to ${fixing.name}` : 'send your Draft'}>Sign in</SignInPrompt>
              ) : (
                <button type="submit" form="entry-form" disabled={busy || me === undefined || unchanged} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
                  {busy ? 'Submitting…' : fixing ? 'Submit fix' : 'Submit'}
                </button>
              )}
            </div>
          )}
          <button onClick={onClose} className={(people ? '' : 'ml-auto ') + 'grid size-9 shrink-0 place-items-center rounded-full bg-card-2 ring-1 ring-line'} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>

        {people && note && <p role="status" className="shrink-0 px-4 pb-1 text-sm text-berry md:px-0 md:pt-2">{note}</p>}
        {!people && intro}

        <div data-split className={people ? 'flex min-h-0 flex-1 flex-col md:mt-5 md:grid md:grid-cols-2 md:gap-6' : 'mt-5 grid gap-6 md:grid-cols-2'}>
          <div className={people ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:overflow-visible md:p-0' : 'contents'}>
          {people && intro}
          <form id="entry-form" onSubmit={submit} className={'grid content-start gap-3' + (people ? ' mt-3' : '')}>
            {show('name') && (
              <label className="grid gap-1">
                <span className="text-sm font-bold">Name<span className="text-berry"> *</span></span>
                <input id="entry-name" value={content.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={input} />
              </label>
            )}
            {block.type === 'timeline' && show('order') && (
              <label className="grid gap-1">
                <span className="text-sm font-bold">Order <span className="font-normal text-muted">(where it falls in the story)</span></span>
                <input type="number" value={content.order ?? ''} onChange={(e) => set({ order: e.target.value === '' ? undefined : Number(e.target.value) })} className={input} />
              </label>
            )}
            {showStat && show('stat') && (
              <label className="grid gap-1">
                <span className="text-sm font-bold">{block.statName ?? 'Key fact'} <span className="font-normal text-muted">(shown on the list, short)</span></span>
                <input value={content.stat ?? ''} onChange={(e) => set({ stat: e.target.value })} maxLength={40} placeholder={block.statName === 'Level' ? 'Lv 12' : ''} className={input} />
              </label>
            )}
            {!people && block.stats?.length && show('stats') ? (
              <div role="group" aria-labelledby="stats-label" id={fid('stats')} className={'grid gap-1.5' + hl('stats')}>
                <span id="stats-label" className="text-sm font-bold">Stats <span className="font-normal text-muted">(numbers, as the game shows them)</span></span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {block.stats.map((d) => (
                    <label key={d.key} className="grid gap-1">
                      <span className="text-xs font-bold text-muted">{d.label}</span>
                      <input type="number" inputMode="decimal" value={content.stats?.[d.key] ?? ''} onChange={(e) => setStat(d.key, e.target.value)} className={input} />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {!people && show('description') && (
              <label id={fid('description')} className={'grid gap-1' + hl('description')}>
                <span className="text-sm font-bold">{DESCRIPTION_LABEL[block.type]}</span>
                <textarea value={content.description ?? ''} onChange={(e) => set({ description: e.target.value })} rows={3} className={input} />
              </label>
            )}
            {!people && block.filters?.filter((k) => show(`cat:${k}`)).map((k) => (
              <label key={k} className="grid gap-1">
                <span className="text-sm font-bold">{k}</span>
                <input value={content.categories[k] ?? ''} onChange={(e) => set({ categories: { ...content.categories, [k]: e.target.value } })}
                  list={`values-${k}`} placeholder={values(k).slice(0, 3).join(', ')} className={input} />
                <datalist id={`values-${k}`}>{values(k).map((v) => <option key={v} value={v} />)}</datalist>
              </label>
            ))}

            {people && (
              <CharacterInputs key={`${block.id}.${fixing?.id ?? 'new'}`} block={block} content={content} set={set} setField={setField} setStat={setStat}
                show={show} hl={hl} fid={fid} others={block.entries.filter((e) => e.id !== fixing?.id).map((e) => e.name)} />
            )}

            {byRoute && show('routes') && (
              <fieldset id={fid('routes')} className={'grid gap-2 rounded-2xl bg-card-2 p-3 ring-1 ' + (fid('routes') ? 'ring-2 ring-sun' : 'ring-line')}>
                <legend className="px-1 text-sm font-bold">Routes</legend>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm text-muted">Shows on these routes. Tap one to take it off:</span>
                  {routes.map((r) => {
                    const on = !content.routes?.length || content.routes.includes(r.key);
                    return (
                      <button key={r.key} type="button" onClick={() => toggleRoute(r.key)} aria-pressed={on}
                        className={'rounded-full px-3 py-1 text-sm font-bold ring-1 ' + (on ? 'bg-berry text-white ring-berry' : 'bg-card ring-line')}>{r.label}</button>
                    );
                  })}
                </div>
                {/* What differs (like "Recruit") is shared by every entry, so it stays locked unless renamed on purpose. */}
                {currentRouteLabel && !renamingRoutes ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span>Differs by route: <span className="font-bold">{currentRouteLabel}</span></span>
                    <button type="button" onClick={() => setRenamingRoutes(true)} className="text-xs font-bold text-muted underline hover:text-ink">Rename</button>
                  </p>
                ) : (
                  <label className="grid gap-1 text-sm">
                    <span className="font-bold">Something that differs by route <span className="font-normal text-muted">(optional)</span></span>
                    <input value={currentRouteLabel ?? ''} onChange={(e) => setPerRouteLabel(e.target.value)}
                      placeholder="What it is, e.g. Recruit" className={input} />
                  </label>
                )}
                {routes.map((r) => (
                  <label key={r.key} className="flex items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 font-bold">{r.label}</span>
                    <input value={perRouteText(r.key)} onChange={(e) => setPerRoute(r.key, e.target.value)} className={input} />
                  </label>
                ))}
              </fieldset>
            )}

            <div className="grid gap-2">
              {content.sections.map((s, i) => (fieldKeys.has(s.label) || (!showAll && i !== focusSection) ? null : (
                <div key={i} id={!showAll && i === focusSection ? 'fix-focus' : undefined}
                  className={'grid gap-1.5 rounded-2xl bg-card-2 p-2.5 ring-1 ' + (!showAll && i === focusSection ? 'ring-2 ring-sun' : 'ring-line')}>
                  <div className="flex gap-2">
                    <input value={s.label} onChange={(e) => setSection(i, { label: e.target.value })} list="section-labels" placeholder="Label, e.g. Tips"
                      aria-label="Section label" className="min-w-0 flex-1 rounded-xl bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line outline-none focus:ring-2 focus:ring-sky" />
                    <button type="button" onClick={() => set({ sections: content.sections.filter((_, j) => j !== i) })} aria-label={`Remove ${s.label || 'section'}`}
                      className="grid size-8 place-items-center rounded-full text-muted hover:bg-card hover:text-berry"><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                  <textarea value={s.text} onChange={(e) => setSection(i, { text: e.target.value })} rows={2} placeholder="One point per line becomes a list"
                    aria-label={`${s.label || 'Section'} text`} className="rounded-xl bg-card px-3 py-1.5 ring-1 ring-line outline-none focus:ring-2 focus:ring-sky" />
                </div>
              )))}
              <datalist id="section-labels">{labels.map((l) => <option key={l} value={l} />)}</datalist>
              {showAll ? (people ? null :
                <button type="button" onClick={() => set({ sections: [...content.sections, { label: labels.find((l) => !content.sections.some((s) => s.label === l)) ?? '', text: '' }] })}
                  className="inline-flex items-center gap-1.5 justify-self-start rounded-full px-3 py-1.5 text-sm font-bold text-leaf ring-1 ring-line hover:ring-leaf">
                  <Plus size={15} aria-hidden="true" /> Add a section
                </button>
              ) : (
                <button type="button" onClick={() => setShowAll(true)}
                  className="inline-flex items-center gap-1.5 justify-self-start rounded-full px-3 py-1.5 text-sm font-bold text-muted ring-1 ring-line hover:text-ink hover:ring-ink">
                  Edit other parts
                </button>
              )}
            </div>

            <label className="grid gap-1">
              <span className="text-sm font-bold">Where can others check this?</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="I saw it myself in chapter 6, or a link" className={input} />
            </label>
            <div className={(showAll ? 'flex' : 'hidden') + ' flex-wrap gap-x-5 gap-y-2 text-sm'}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(content.spoiler)} onChange={(e) => set({ spoiler: e.target.checked })} className="size-4 accent-[var(--color-leaf)]" />
                <span><span className="font-bold">Spoiler.</span> Hidden until a player asks.</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={content.flag === 'unconfirmed'} onChange={(e) => set({ flag: e.target.checked ? 'unconfirmed' : undefined })} className="size-4 accent-[var(--color-leaf)]" />
                <span><span className="font-bold">A theory.</span> Not confirmed yet.</span>
              </label>
            </div>

            {/* On phones this bar stays at the bottom of the form, so Submit is always in reach. */}
            {people && changeBox}

            {people ? (
              // Closing keeps what's written for next time; this throws it away (undoable from the Workshop).
              <button type="button" onClick={onDiscard} className="justify-self-start rounded-full px-1 py-1 text-sm font-bold text-muted hover:text-berry">Discard this draft</button>
            ) : (
            <div id="entry-actions" className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-wrap items-center gap-3 border-t border-line bg-card px-5 py-3 sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
              {me === null ? (
                <SignInPrompt back="?resume=1" forWhat={fixing ? `send your fix to ${fixing.name}` : 'send your Draft'}>Sign in to submit</SignInPrompt>
              ) : (
                <button disabled={busy || me === undefined || unchanged} className="btn-primary rounded-full px-5 py-2.5 font-bold disabled:opacity-60">
                  {busy ? 'Submitting…' : fixing ? 'Submit fix' : 'Submit Draft'}
                </button>
              )}
              {/* Far from Submit, and undoable from the Workshop. */}
              <button type="button" onClick={onDiscard} className="ml-auto rounded-full px-3 py-2 text-sm font-bold text-muted hover:text-berry">Discard</button>
            </div>
            )}
            {!people && note && <p role="status" className="text-sm text-berry">{note}</p>}
          </form>
          </div>

          {/* The preview. For characters it's exactly the app: the Page's tint behind the card, on a
              sheet over the Workbench that's dragged to resize on a phone. */}
          <div data-sheet className={people ? 'relative z-10 flex shrink-0 flex-col rounded-t-[1.5rem] shadow-[0_-1px_0_var(--line),0_-14px_28px_-8px_rgba(21,23,28,0.38)] md:sticky md:top-0 md:grid md:h-auto md:content-start md:self-start md:rounded-[1.5rem] md:p-3 md:shadow-none' : 'grid content-start gap-3'}
            style={people ? { ...(wide ? {} : { height: `${sheet}%` }), background: `var(--${page.tint}-soft)` } : undefined}>
            {people && (
              <SheetHandle pct={sheet} onChange={setSheet}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted md:hidden">Players see</p>
              </SheetHandle>
            )}
            <div className={people ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:overflow-visible md:p-0' : 'contents'}>
            {!people && changeBox}
            {!people && <p className="text-xs font-bold uppercase tracking-wide text-muted">Live preview: how it will look in the app</p>}
            <div className={people ? 'rounded-2xl bg-card p-3 ring-1 ring-line md:p-4' : 'rounded-2xl p-4 ring-1 ring-line'}>
              {!cleaned.name
                ? <p className="text-sm text-muted">Start with a name, and the entry appears here.</p>
                : people
                  ? <CharacterCard entry={cleaned} block={block} route="all" routes={routes} color={`var(--${page.tint})`} size={wide ? 120 : 76} />
                  : <EntryDetails entry={cleaned} block={block} route="all" routes={routes} />}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Old and new, side by side, for each field that changes. */
export function ChangeList({ changes }: { changes: ReturnType<typeof changesBetween> }) {
  return (
    <ul className="mt-2 grid gap-2 text-sm">
      {changes.map((c) => (
        <li key={c.label}>
          <p className="font-bold">{c.label}</p>
          {c.before && <p className="whitespace-pre-wrap rounded-lg bg-berry-soft px-2 py-1 text-berry line-through decoration-berry/50">{c.before}</p>}
          {c.after
            ? <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-leaf-soft px-2 py-1 text-leaf">{c.after}</p>
            : <p className="mt-0.5 text-xs text-muted">Removed</p>}
        </li>
      ))}
    </ul>
  );
}
