'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, EyeOff, MapPin, Pencil, Search, StickyNote, TriangleAlert, X } from 'lucide-react';
import type { Block, Entry, EntryContent, FieldDef, Route } from '@/data/pages';
import { sharePath } from '@/data/pages/links';
import { ShareButton } from '@/components/ShareButton';
import { BlockIcon } from '@/components/Icon';
import { Piece } from '@/components/Piece';
import { ScrollRow } from '@/components/ScrollRow';
import { browserClient } from '@/lib/supabase/browser';
import { closest, rank } from '@/lib/search';
import { DESCRIPTION, besideText, hasValue, isCategory, listItems, shownFields, spotOf, valueOf, type FieldValue } from '@/lib/fields';
import { GUIDE_PICTURES, STEPS, TIP, WATCH_OUT, WRITEUP, paragraphs, parseSteps, parseWriteup, stepCount, type Step, type WriteSection } from '@/lib/guides';
import type { RouteOption } from './EntryPanel';
import { symbolFor } from './symbols';
import { entryText, onRoute, rememberEntry, useOpenEntry } from './entries';
import { RichText } from './TextLinks';
import { FilterChip, HiddenNote, useVisible, type BlockContext } from './blockParts';
import { Videos, cardIdOf } from '@/components/videos/Videos';

/** What a guide card needs from its Block (a Workshop sample has no entries or id). */
type GuideBlock = Pick<Block, 'title' | 'icon'> & Partial<Pick<Block, 'type' | 'fields' | 'symbols' | 'filters' | 'entries'>>;

/** Where a guide picture can be seen. */
export function pictureUrl(path: string) {
  return browserClient()?.storage.from(GUIDE_PICTURES).getPublicUrl(path).data.publicUrl ?? '';
}

/** A field's text for the player's route: their route's own, else the shared text. */
const forRoute = (v: FieldValue, route: Route | 'all') => (route !== 'all' ? v.byRoute.find(([r]) => r === route)?.[1] : undefined) ?? v.text ?? '';

/** The first line of a guide's answer, for its row in the list. */
function gist(e: EntryContent) {
  const first = (t?: string) => t?.split('\n').find((l) => l.trim())?.trim();
  const section = (label: string) => e.sections.find((x) => x.label === label)?.text;
  return first(e.description)
    ?? parseSteps(section(STEPS)).find((x) => !x.spoiler)?.text
    ?? first(parseWriteup(section(WRITEUP)).find((x) => !x.spoiler && x.text)?.text);
}

/**
 * Guides (Block 3, docs/blocks/guides.md): a list to find a guide, then one guide at a time.
 * The open guide is in the address (?e=block.entry), like every entry, so links, share cards
 * and the phone's back button work. Each guide leads with "In short", then its steps.
 */
export function Guides({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const { open, set, close } = useOpenEntry();
  const [blockId, entryId] = open?.split('.') ?? [];
  const entry = blockId === block.id ? block.entries.find((e) => e.id === entryId) : undefined;
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const fields = shownFields(block);
  // A tag with two or more values here (Kind, Difficulty...) gives chips to narrow the list.
  const tag = useMemo(() => fields.filter((f) => isCategory(f) && !f.spoiler)
    .find((f) => new Set(shown.map((e) => e.categories[f.key]).filter(Boolean)).size > 1), [fields, shown]);
  const chips = tag ? [...new Set(shown.map((e) => e.categories[tag.key]).filter(Boolean))] : [];
  const picked = tag && pick && chips.includes(pick) ? shown.filter((e) => e.categories[tag.key] === pick) : shown;
  const list = query.trim() ? rank(picked, query, entryText) : picked;
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entry) return;
    rememberEntry(ctx.gameId, { href: `${window.location.pathname}?e=${block.id}.${entry.id}`, name: entry.name, where: `${ctx.pageTitle} · ${block.title}` });
    // Opening a guide (or stepping to the next) starts at its top.
    const box = document.getElementById(block.id);
    if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: 'start' });
  }, [entry, block.id, block.title, ctx.gameId, ctx.pageTitle]);

  if (entry) {
    // Arrows step through the guides as the list shows them (the whole Block if opened from a link).
    const along = list.some((e) => e.id === entry.id) ? list : shown.some((e) => e.id === entry.id) ? shown : [entry];
    const at = along.findIndex((e) => e.id === entry.id);
    const prev = along[at - 1], next = along[at + 1];
    const go = (e: Entry) => set(`${block.id}.${e.id}`, 'replace');
    const hidden = entry.spoiler && !ctx.spoilers;
    return (
      <div ref={top} className="mt-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={close} className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-bold text-muted hover:bg-card-2 hover:text-ink">
            <ArrowLeft size={16} aria-hidden="true" /> All guides
          </button>
          <span className="ml-auto text-xs font-bold text-muted">{along.length > 1 && `${at + 1} of ${along.length}`}</span>
          {/* This guide's own link, always in view: it's what gets pasted in Discord or attached elsewhere. */}
          <ShareButton path={sharePath(ctx.gameId, ctx.page, block, entry)} title={entry.name} what="guide" tint={ctx.tint} />
          <button type="button" onClick={() => prev && go(prev)} disabled={!prev} aria-label={prev ? `Previous: ${prev.name}` : 'Previous'}
            className="grid size-10 place-items-center rounded-full hover:bg-card-2 disabled:opacity-30"><ChevronLeft size={20} aria-hidden="true" /></button>
          <button type="button" onClick={() => next && go(next)} disabled={!next} aria-label={next ? `Next: ${next.name}` : 'Next'}
            className="grid size-10 place-items-center rounded-full hover:bg-card-2 disabled:opacity-30"><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
        <article className="mt-2 rounded-2xl bg-card-2 p-4 ring-1 ring-line sm:p-5">
          {hidden ? (
            <div className="grid justify-items-center gap-2 py-6 text-center">
              <EyeOff size={20} className="text-muted" aria-hidden="true" />
              <p className="font-bold">This guide is a spoiler.</p>
              <button type="button" onClick={ctx.onShowSpoilers} className="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">Show it</button>
            </div>
          ) : (
            <GuideCard entry={entry} block={block} route={ctx.route} routes={ctx.routes} color={`var(--${ctx.tint})`} spoilers={ctx.spoilers} />
          )}
        </article>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/g/${ctx.gameId}/workshop?fix=${block.id}.${entry.id}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-muted ring-1 ring-line hover:text-ink hover:ring-ink">
            <Pencil size={14} aria-hidden="true" /> Fix this guide
          </Link>
          {next && (
            <button type="button" onClick={() => go(next)} className="ml-auto inline-flex min-w-0 items-center gap-1 rounded-full px-3 py-1.5 font-bold hover:bg-card-2">
              <span className="truncate">Next: {next.name}</span> <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const near = query.trim() && !list.length ? closest(picked, query, entryText) : [];
  const offRouteHits = query.trim() && !list.length && !ctx.spoilers
    ? rank(block.entries.filter((e) => e.spoiler && onRoute(e, ctx.route)), query, entryText).length : 0;
  return (
    <div className="mt-3">
      {shown.length > 3 && (
        <label className="flex items-center gap-2 rounded-full bg-card px-3 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-ink">
          <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What are you stuck on?"
            aria-label={`Search ${block.title}`} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear the search" className="text-muted hover:text-ink"><X size={16} aria-hidden="true" /></button>}
        </label>
      )}
      {chips.length > 1 && (
        <ScrollRow className="-mx-1 mt-2 flex gap-1.5 px-1 pb-1" role="group" label={tag?.label ?? 'Filter'}>
          <FilterChip on={!pick} tint={ctx.tint} onClick={() => setPick(null)}>All</FilterChip>
          {chips.map((c) => <FilterChip key={c} on={pick === c} tint={ctx.tint} onClick={() => setPick(pick === c ? null : c)}>{c}</FilterChip>)}
        </ScrollRow>
      )}
      <ul className="mt-2 grid gap-2">
        {list.map((e) => <GuideRow key={e.id} entry={e} block={block} color={`var(--${ctx.tint})`} onOpen={() => set(`${block.id}.${e.id}`)} />)}
      </ul>
      {query.trim() && !list.length && (
        <div className="mt-4 text-center text-sm text-muted">
          <p>No guide matches &ldquo;{query}&rdquo; yet.</p>
          {near.length > 0 && (
            <p className="mt-1">Did you mean {near.map((e, i) => (
              <span key={e.id}>{i > 0 && ', '}<button type="button" onClick={() => set(`${block.id}.${e.id}`)} className="font-bold text-ink underline underline-offset-2">{e.name}</button></span>
            ))}?</p>
          )}
          {offRouteHits > 0 && <p className="mt-1">{offRouteHits} more hidden as spoilers.</p>}
          <Link href={`/g/${ctx.gameId}/workshop?add=${block.id}`} className="mt-2 inline-block font-bold text-ink underline underline-offset-2">Write this guide in the Workshop</Link>
        </div>
      )}
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
    </div>
  );
}

/** A guide in the list: its piece, name, the first line of its answer, and when and how long. */
function GuideRow({ entry, block, color, onOpen }: { entry: Entry; block: Block; color: string; onOpen: () => void }) {
  const symbol = symbolFor(entry, block) ?? block.icon;
  const when = shownFields(block).find((f) => f.kind === 'when');
  const steps = stepCount(entry.sections.find((s) => s.label === STEPS)?.text);
  const writeup = parseWriteup(entry.sections.find((s) => s.label === WRITEUP)?.text).length > 0;
  const meta = [when && valueOf(entry, when).text, steps ? `${steps} step${steps === 1 ? '' : 's'}` : writeup ? 'Write-up' : ''].filter(Boolean).join(' · ');
  const line = gist(entry);
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl bg-card-2 p-3 text-left ring-1 ring-line hover:ring-ink">
        <Piece size={46} color={color} image={entry.icon}>{entry.icon ? null : <BlockIcon name={symbol} size={16} strokeWidth={2.4} />}</Piece>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-display text-lg leading-tight">{entry.name}</span>
          {line && <span className="line-clamp-1 text-sm text-muted">{line}</span>}
          {meta && <span className="text-xs font-bold text-muted">{meta}</span>}
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * One guide, laid out by its Block's fields: the name with its tags and when, then every
 * other field in the builders' order. The starter order is "In short", "Watch out", the steps
 * and the tip. Also the Workshop's preview, so it must look exactly like the app.
 */
export function GuideCard({ entry, block, route, routes, color = 'var(--ink)', spoilers = false, sample = false }: {
  entry: EntryContent; block: GuideBlock; route: Route | 'all'; routes: RouteOption[];
  color?: string;
  /** Show spoiler steps and fields without a tap (the player turned spoilers on). */
  spoilers?: boolean;
  /** The builders' made-up sample. */
  sample?: boolean;
}) {
  const fields = shownFields(block).filter((f) => hasValue(entry, f));
  const at = (...spots: ReturnType<typeof spotOf>[]) => fields.filter((f) => spots.includes(spotOf(f)));
  const routeName = (r: Route) => routes.find((o) => o.key === r)?.label ?? r;
  const parts = at('body', 'section', 'chart');
  const videos = <Videos cardId={sample ? undefined : cardIdOf(entry)} size="big" name={entry.name} />;
  return (
    <div className="grid gap-4">
      <header>
        {sample && <p className="text-xs font-bold uppercase tracking-wide text-muted">Sample</p>}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-2xl leading-tight">{entry.name}</h3>
          {at('beside').map((f) => <span key={f.key} className="text-sm font-bold text-muted"><Covered f={f} on={spoilers} small>{besideText(f, forRoute(valueOf(entry, f), route))}</Covered></span>)}
        </div>
        {at('tags').length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {at('tags').map((f) => {
              const v = forRoute(valueOf(entry, f), route);
              if (f.kind === 'yesno' && !/^y/i.test(v)) return null;
              return <span key={f.key} className="rounded-full bg-card px-2.5 py-0.5 text-sm font-bold ring-1 ring-line"><Covered f={f} on={spoilers} small>{f.kind === 'yesno' ? f.label : v}</Covered></span>;
            })}
          </div>
        )}
        {at('meta').length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {at('meta').map((f) => {
              const Icon = f.kind === 'place' ? MapPin : Clock;
              return <span key={f.key} className="inline-flex items-center gap-1"><Icon size={14} aria-hidden="true" /><Covered f={f} on={spoilers} small>{forRoute(valueOf(entry, f), route)}</Covered></span>;
            })}
          </p>
        )}
      </header>
      {/* Videos (docs/blocks/videos.md): "See it done" right under "In short", or first if there's none. */}
      {!parts.some((f) => f.key === DESCRIPTION) && videos}
      {parts.map((f) => (
        <Fragment key={f.key}>
          <GuidePart f={f} v={valueOf(entry, f)} route={route} routeName={routeName} name={entry.name} color={color} spoilers={spoilers} />
          {f.key === DESCRIPTION && videos}
        </Fragment>
      ))}
    </div>
  );
}

/** One part of a guide, shaped by what it is: the answer box, the warning, the steps, the tip, or plain text. */
function GuidePart({ f, v, route, routeName, name, color, spoilers }: {
  f: FieldDef; v: FieldValue; route: Route | 'all'; routeName: (r: Route) => string; name: string; color: string; spoilers: boolean;
}) {
  const text = forRoute(v, route);
  // Showing every route: the other routes' versions follow, each named.
  const others = route === 'all' ? v.byRoute : [];
  const extra = others.length > 0 && (
    <dl className="mt-2 grid gap-1">
      {others.map(([r, t]) => <div key={r} className="flex gap-3 rounded-xl bg-card px-3 py-1.5 text-sm"><dt className="w-20 shrink-0 font-bold">{routeName(r)}</dt><dd><RichText text={t} skip={name} /></dd></div>)}
    </dl>
  );
  const mine = route !== 'all' && v.byRoute.some(([r]) => r === route);
  const label = mine ? `${f.label} as ${routeName(route as Route)}` : f.label;

  if (f.key === DESCRIPTION) {
    return (
      <section className="rounded-2xl px-4 py-3" style={{ background: `color-mix(in srgb, ${color} 14%, var(--card))` }}>
        <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: `color-mix(in srgb, ${color} 70%, var(--ink))` }}>{f.label}</h4>
        <Covered f={f} on={spoilers}><p className="mt-1 text-[1.05rem] leading-relaxed"><RichText text={text} skip={name} /></p></Covered>
      </section>
    );
  }
  if (f.kind === 'steps') return <Steps f={f} label={label} text={text} color={color} spoilers={spoilers} name={name} extra={extra} />;
  if (f.kind === 'writeup') return <Writeup f={f} text={text} spoilers={spoilers} name={name} extra={extra} />;
  if (f.key === TIP) {
    return (
      <div className="flex -rotate-[0.6deg] gap-2 rounded-xl bg-sun-soft px-3 py-2.5 text-sm">
        <StickyNote size={16} className="mt-0.5 shrink-0 text-sun" aria-hidden="true" />
        <div className="min-w-0 flex-1"><span className="sr-only">{f.label}: </span><Covered f={f} on={spoilers}><RichText text={text} skip={name} /></Covered>{extra}</div>
      </div>
    );
  }
  const lines = text.split('\n').filter((l) => l.trim());
  const body = f.kind === 'list' || f.kind === 'links' || lines.length > 1
    ? <ul className="mt-1 grid gap-1">{(f.kind === 'list' || f.kind === 'links' ? listItems(text).map((i) => (i.note ? `${i.name}: ${i.note}` : i.name)) : lines).map((l, i) => (
        <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-60" /><span><RichText text={l} skip={name} /></span></li>
      ))}</ul>
    : <p className="mt-1 leading-relaxed"><RichText text={text} skip={name} /></p>;
  if (f.key === WATCH_OUT) {
    return (
      <section className="rounded-2xl bg-berry-soft px-4 py-3 text-berry">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"><TriangleAlert size={14} aria-hidden="true" /> {label}</h4>
        <div className="text-ink"><Covered f={f} on={spoilers}>{body}</Covered></div>{extra}
      </section>
    );
  }
  return (
    <section>
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{label}</h4>
      <Covered f={f} on={spoilers}>{body}</Covered>{extra}
    </section>
  );
}

/** The steps: numbered down a line in the Page color. A spoiler step is covered until tapped; a picture sits under its step. */
function Steps({ f, label, text, color, spoilers, name, extra }: {
  f: FieldDef; label: string; text: string; color: string; spoilers: boolean; name: string; extra: React.ReactNode;
}) {
  const steps = parseSteps(text);
  const [big, setBig] = useState<string | null>(null);
  return (
    <section>
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{label}</h4>
      <Covered f={f} on={spoilers}>
        <ol className="mt-2 grid">
          {steps.map((s, i) => (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && <span className="absolute bottom-0 left-[0.95rem] top-8 w-0.5 bg-line" aria-hidden="true" />}
              <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: color }}>{i + 1}</span>
              <div className="min-w-0 flex-1 pt-1"><StepBody step={s} spoilers={spoilers} name={name} onPicture={setBig} /></div>
            </li>
          ))}
        </ol>
      </Covered>
      {extra}
      {big && <Picture src={big} onClose={() => setBig(null)} />}
    </section>
  );
}

function StepBody({ step, spoilers, name, onPicture }: { step: Step; spoilers: boolean; name: string; onPicture: (src: string) => void }) {
  const [shown, setShown] = useState(false);
  if (step.spoiler && !spoilers && !shown) {
    return (
      // The chat's spoiler look: the whole step, picture and all, stays behind one tap.
      <button type="button" onClick={() => setShown(true)} aria-label="Show this step (spoiler)"
        className="inline-flex items-center gap-1.5 rounded-xl bg-ink/80 px-3 py-1 text-sm font-bold text-paper hover:bg-ink">
        <EyeOff size={14} aria-hidden="true" /> Spoiler · tap to show
      </button>
    );
  }
  const src = step.picture ? pictureUrl(step.picture) : '';
  return (
    <>
      {step.text && <p className="leading-relaxed"><RichText text={step.text} skip={name} /></p>}
      {src && (
        <button type="button" onClick={() => onPicture(src)} aria-label="See the picture bigger" className="mt-2 block overflow-hidden rounded-xl ring-1 ring-line hover:ring-ink">
          {/* eslint-disable-next-line @next/next/no-img-element -- a builder's picture from our own storage, any size */}
          <img src={src} alt={step.text ? `For this step: ${step.text}` : 'A picture for this step'} loading="lazy" className="max-h-64 w-auto max-w-full object-contain" />
        </button>
      )}
    </>
  );
}

/**
 * A write-up: sections, each with its heading, paragraphs and picture, read like a short
 * article. A spoiler section is covered, heading and all, until tapped.
 */
function Writeup({ f, text, spoilers, name, extra }: { f: FieldDef; text: string; spoilers: boolean; name: string; extra: React.ReactNode }) {
  const sections = parseWriteup(text);
  const [big, setBig] = useState<string | null>(null);
  return (
    <section>
      <h4 className="sr-only">{f.label}</h4>
      <Covered f={f} on={spoilers}>
        <div className="grid gap-4">
          {sections.map((s, i) => <WriteBody key={i} section={s} spoilers={spoilers} name={name} onPicture={setBig} />)}
        </div>
      </Covered>
      {extra}
      {big && <Picture src={big} onClose={() => setBig(null)} />}
    </section>
  );
}

function WriteBody({ section: s, spoilers, name, onPicture }: { section: WriteSection; spoilers: boolean; name: string; onPicture: (src: string) => void }) {
  const [shown, setShown] = useState(false);
  const heading = s.heading && <h4 className="font-display text-lg leading-tight">{s.heading}</h4>;
  if (s.spoiler && !spoilers && !shown) {
    return (
      <div className="grid justify-items-start gap-1.5">
        <button type="button" onClick={() => setShown(true)} aria-label={`Show ${s.heading || 'this part'} (spoiler)`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-ink/80 px-3 py-1 text-sm font-bold text-paper hover:bg-ink">
          <EyeOff size={14} aria-hidden="true" /> Spoiler · tap to show
        </button>
      </div>
    );
  }
  const src = s.picture ? pictureUrl(s.picture) : '';
  return (
    <div className="grid gap-2">
      {heading}
      {paragraphs(s.text).map((p, i) => (
        <p key={i} className="leading-relaxed">
          {p.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}<RichText text={line} skip={name} /></span>)}
        </p>
      ))}
      {src && (
        <button type="button" onClick={() => onPicture(src)} aria-label="See the picture bigger" className="block justify-self-start overflow-hidden rounded-xl ring-1 ring-line hover:ring-ink">
          {/* eslint-disable-next-line @next/next/no-img-element -- a builder's picture from our own storage, any size */}
          <img src={src} alt={s.heading ? `For ${s.heading}` : 'A picture for this part'} loading="lazy" className="max-h-80 w-auto max-w-full object-contain" />
        </button>
      )}
    </div>
  );
}

/** A step's picture over the whole screen. Tap anywhere or press Escape to close. */
function Picture({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Picture" onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- a builder's picture from our own storage, any size */}
      <img src={src} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-card text-ink"><X size={18} aria-hidden="true" /></button>
    </div>
  );
}

/** A spoiler field stays covered until tapped (or until the player turns spoilers on). */
function Covered({ f, on, small = false, children }: { f: FieldDef; on: boolean; small?: boolean; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  if (!f.spoiler || on || shown) return <>{children}</>;
  return (
    <button type="button" onClick={() => setShown(true)} aria-label={`Show ${f.label} (spoiler)`}
      className={'spoiler-cover inline-flex items-center gap-1.5 font-bold text-muted ring-1 ring-line hover:text-ink '
        + (small ? 'rounded-full px-2 py-0.5 text-xs' : 'mt-1 w-full justify-center rounded-xl py-2 text-sm')}>
      <EyeOff size={small ? 12 : 14} aria-hidden="true" /> {small ? f.label : `${f.label} is a spoiler. Tap to show`}
    </button>
  );
}
