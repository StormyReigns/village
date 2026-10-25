'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import type { Block, Entry, EntryContent, Page, Route, Section } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { SignInPrompt } from '@/components/SignInPrompt';
import { ScrollRow } from '@/components/ScrollRow';
import type { Villager } from '@/components/useVillager';
import { EntryDetails, EntryIcon, type RouteOption } from '@/components/app/EntryPanel';
import { entryText } from '@/components/app/entries';
import { rank } from '@/lib/search';
import { changesBetween } from './changes';
import { clearUnsent, hasWriting, saveUnsent, type Unsent } from './unsent';
import type { NewDraft } from './useWorkshop';

/** Where the form opens: a Block to add to, and optionally the entry being fixed. */
export interface FormStart { blockId: string; entryId?: string }

// Suggested "+" section labels for each Block type, before the Block has its own.
const DEFAULT_LABELS: Record<Block['type'], string[]> = {
  collection: ['Where to find it', 'Tips', 'Wiki link'],
  guide: ['Steps', 'Tip'],
  checklist: ['Before'],
  timeline: [],
};

const DESCRIPTION_LABEL: Record<Block['type'], string> = {
  collection: 'Description',
  guide: 'Intro (optional)',
  checklist: 'How not to miss it',
  timeline: 'What happens (spoiler-light)',
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

export function EntryForm({ gameId, pages, routes, start, restore, me, postDraft, onClose, onPosted }: {
  gameId: string; pages: Page[]; routes: RouteOption[]; start: FormStart; restore?: Unsent | null; me: Villager | null | undefined;
  postDraft: (d: NewDraft) => Promise<string | null>; onClose: () => void; onPosted: (pageId: string) => void;
}) {
  const blocks = useMemo(() => pages.flatMap((p) => p.blocks.map((b) => ({ ...b, page: p }))), [pages]);
  const [blockId, setBlockId] = useState(start.blockId);
  const block = blocks.find((b) => b.id === blockId) ?? blocks[0];
  const [fixing, setFixing] = useState<Entry | undefined>(() => block?.entries.find((e) => e.id === start.entryId));
  const [content, setContent] = useState<EntryContent>(() => restore?.content ?? (fixing ? contentOf(fixing) : blank()));
  const [source, setSource] = useState(restore?.source ?? '');

  // Keep what's been written on this device, so signing in partway doesn't lose it.
  // A fix only counts once it differs from what's in the app.
  useEffect(() => {
    const worth = fixing
      ? Boolean(source.trim()) || JSON.stringify(content) !== JSON.stringify(contentOf(fixing))
      : hasWriting(content, source);
    if (worth) saveUnsent(gameId, { blockId, entryId: fixing?.id, content, source });
  }, [gameId, blockId, fixing, content, source]);
  const [find, setFind] = useState('');
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

  const setSection = (i: number, patch: Partial<Section>) => set({ sections: content.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const perRouteText = (r: Route) => content.perRoute?.[r]?.[0]?.text ?? '';
  const setPerRoute = (r: Route, text: string) => {
    const label = Object.values(content.perRoute ?? {}).flat()[0]?.label || routeLabel || 'Note';
    set({ perRoute: { ...content.perRoute, [r]: [{ label, text }] } });
  };
  const setPerRouteLabel = (label: string) =>
    set({ perRoute: Object.fromEntries(routes.map((r) => [r.key, [{ label, text: perRouteText(r.key) }]])) });
  const toggleRoute = (r: Route) => {
    const now = content.routes?.length ? content.routes : routes.map((o) => o.key);
    const next = now.includes(r) ? now.filter((x) => x !== r) : [...now, r];
    set({ routes: next.length === routes.length ? undefined : next });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleaned.name) { setNote('Give it a name first.'); document.getElementById('entry-name')?.focus(); return; }
    if (cleaned.name.length < 3 || cleaned.name.length > 120) { setNote('Names need 3 to 120 characters.'); return; }
    if (unchanged) { setNote("Nothing has changed yet. Edit a field, then submit."); return; }
    setBusy(true);
    const err = await postDraft({
      blockKey: block.id, kind: 'fact', title: cleaned.name, content: cleaned, source: source.trim(),
      theory: cleaned.flag === 'unconfirmed', cardId: fixing?.ref?.card, baseRevision: fixing?.ref?.revision,
    });
    setBusy(false);
    if (err) setNote(err);
    else { clearUnsent(gameId); onPosted(page.id); }
  };

  const found = find.trim() ? rank(block.entries, find, entryText).slice(0, 6) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={fixing ? `Fix ${fixing.name}` : 'New entry'} onClick={(e) => e.stopPropagation()}
        className="rise max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-card p-5 shadow-soft outline-none sm:rounded-[2rem] sm:p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">{fixing ? `Fix: ${fixing.name}` : `New in ${block.title}`}</h2>
          <button onClick={onClose} className="ml-auto grid size-9 place-items-center rounded-full bg-card-2 ring-1 ring-line" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>

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

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <form onSubmit={submit} className="grid content-start gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-bold">Name<span className="text-berry"> *</span></span>
              <input id="entry-name" value={content.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={input} />
            </label>
            {block.type === 'timeline' && (
              <label className="grid gap-1">
                <span className="text-sm font-bold">Order <span className="font-normal text-muted">(where it falls in the story)</span></span>
                <input type="number" value={content.order ?? ''} onChange={(e) => set({ order: e.target.value === '' ? undefined : Number(e.target.value) })} className={input} />
              </label>
            )}
            {showStat && (
              <label className="grid gap-1">
                <span className="text-sm font-bold">{block.statName ?? 'Key fact'} <span className="font-normal text-muted">(shown on the list, short)</span></span>
                <input value={content.stat ?? ''} onChange={(e) => set({ stat: e.target.value })} maxLength={40} placeholder={block.statName === 'Level' ? 'Lv 12' : ''} className={input} />
              </label>
            )}
            <label className="grid gap-1">
              <span className="text-sm font-bold">{DESCRIPTION_LABEL[block.type]}</span>
              <textarea value={content.description ?? ''} onChange={(e) => set({ description: e.target.value })} rows={3} className={input} />
            </label>
            {block.filters?.map((k) => (
              <label key={k} className="grid gap-1">
                <span className="text-sm font-bold">{k}</span>
                <input value={content.categories[k] ?? ''} onChange={(e) => set({ categories: { ...content.categories, [k]: e.target.value } })}
                  list={`values-${k}`} placeholder={values(k).slice(0, 3).join(', ')} className={input} />
                <datalist id={`values-${k}`}>{values(k).map((v) => <option key={v} value={v} />)}</datalist>
              </label>
            ))}

            {byRoute && (
              <fieldset className="grid gap-2 rounded-2xl bg-card-2 p-3 ring-1 ring-line">
                <legend className="px-1 text-sm font-bold">Routes</legend>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-sm text-muted">Appears on:</span>
                  {routes.map((r) => {
                    const on = !content.routes?.length || content.routes.includes(r.key);
                    return (
                      <button key={r.key} type="button" onClick={() => toggleRoute(r.key)} aria-pressed={on}
                        className={'rounded-full px-3 py-1 text-sm font-bold ring-1 ' + (on ? 'bg-berry text-white ring-berry' : 'bg-card ring-line')}>{r.label}</button>
                    );
                  })}
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="font-bold">Something that differs by route <span className="font-normal text-muted">(optional)</span></span>
                  <input value={Object.values(content.perRoute ?? {}).flat()[0]?.label ?? routeLabel ?? ''} onChange={(e) => setPerRouteLabel(e.target.value)}
                    placeholder="What it is, e.g. Recruit" className={input} />
                </label>
                {routes.map((r) => (
                  <label key={r.key} className="flex items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 font-bold">{r.label}</span>
                    <input value={perRouteText(r.key)} onChange={(e) => setPerRoute(r.key, e.target.value)} className={input} />
                  </label>
                ))}
              </fieldset>
            )}

            <div className="grid gap-2">
              {content.sections.map((s, i) => (
                <div key={i} className="grid gap-1.5 rounded-2xl bg-card-2 p-2.5 ring-1 ring-line">
                  <div className="flex gap-2">
                    <input value={s.label} onChange={(e) => setSection(i, { label: e.target.value })} list="section-labels" placeholder="Label, e.g. Tips"
                      aria-label="Section label" className="min-w-0 flex-1 rounded-xl bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line outline-none focus:ring-2 focus:ring-sky" />
                    <button type="button" onClick={() => set({ sections: content.sections.filter((_, j) => j !== i) })} aria-label={`Remove ${s.label || 'section'}`}
                      className="grid size-8 place-items-center rounded-full text-muted hover:bg-card hover:text-berry"><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                  <textarea value={s.text} onChange={(e) => setSection(i, { text: e.target.value })} rows={2} placeholder="One point per line becomes a list"
                    aria-label={`${s.label || 'Section'} text`} className="rounded-xl bg-card px-3 py-1.5 ring-1 ring-line outline-none focus:ring-2 focus:ring-sky" />
                </div>
              ))}
              <datalist id="section-labels">{labels.map((l) => <option key={l} value={l} />)}</datalist>
              <button type="button" onClick={() => set({ sections: [...content.sections, { label: labels.find((l) => !content.sections.some((s) => s.label === l)) ?? '', text: '' }] })}
                className="inline-flex items-center gap-1.5 justify-self-start rounded-full px-3 py-1.5 text-sm font-bold text-leaf ring-1 ring-line hover:ring-leaf">
                <Plus size={15} aria-hidden="true" /> Add a section
              </button>
            </div>

            <label className="grid gap-1">
              <span className="text-sm font-bold">Where can others check this?</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="I saw it myself in chapter 6, or a link" className={input} />
            </label>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(content.spoiler)} onChange={(e) => set({ spoiler: e.target.checked })} className="size-4 accent-[var(--color-leaf)]" />
                <span><span className="font-bold">Spoiler.</span> Hidden until a player asks.</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={content.flag === 'unconfirmed'} onChange={(e) => set({ flag: e.target.checked ? 'unconfirmed' : undefined })} className="size-4 accent-[var(--color-leaf)]" />
                <span><span className="font-bold">A theory.</span> Not confirmed yet.</span>
              </label>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              {me === null ? (
                <SignInPrompt back="?resume=1">Sign in to submit</SignInPrompt>
              ) : (
                <button disabled={busy || me === undefined || unchanged} className="rounded-full bg-leaf px-5 py-2.5 font-bold text-paper hover:opacity-90 disabled:opacity-60">
                  {busy ? 'Submitting…' : fixing ? 'Submit fix' : 'Submit Draft'}
                </button>
              )}
              <button type="button" onClick={() => { clearUnsent(gameId); onClose(); }} className="rounded-full px-4 py-2.5 font-bold text-muted hover:text-ink">Discard</button>
            </div>
            {note && <p role="status" className="text-sm text-berry">{note}</p>}
          </form>

          <div className="grid content-start gap-3">
            {fixing && (
              <div className="rounded-2xl bg-card-2 p-3 ring-1 ring-line">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">What changes</p>
                {changes.length === 0 ? <p className="mt-1 text-sm text-muted">Nothing yet. Edit a field on the left.</p> : <ChangeList changes={changes} />}
              </div>
            )}
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Live preview: how it will look in the app</p>
            <div className="rounded-2xl p-4 ring-1 ring-line">
              {cleaned.name
                ? <EntryDetails entry={cleaned} block={block} route="all" routes={routes} />
                : <p className="text-sm text-muted">Start with a name, and the entry appears here.</p>}
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
