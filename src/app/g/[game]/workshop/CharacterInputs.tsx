'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, EyeOff, ImagePlus, Plus, X } from 'lucide-react';
import type { Block, EntryContent, FieldDef } from '@/data/pages';
import { DESCRIPTION, STATS, chartDefs, isCategory, listItems, shownFields, toggleOptions } from '@/lib/fields';
import { parseSteps, stepsText, type Step } from '@/lib/guides';
import { pictureUrl } from '@/components/app/Guides';

// The same boxes as the rest of the entry form.
/** Common fantasy roles and classes, to start from when a game has none listed yet. */
const COMMON_CLASSES = ['Lord', 'Fighter', 'Knight', 'Cavalier', 'Archer', 'Mage', 'Cleric', 'Healer', 'Thief', 'Mercenary', 'Myrmidon', 'Pegasus Knight', 'Wyvern Rider', 'Monk', 'Dancer', 'Bard'];

const input = 'w-full rounded-2xl bg-card-2 px-3 py-2 ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky';

/** What to type, shown faintly in each empty box. */
const PLACEHOLDER: Partial<Record<FieldDef['kind'], string>> = {
  text: 'A word or two', number: 'A number', place: 'e.g. Some town', when: 'e.g. Chapter 3', longtext: 'A few sentences',
};

/**
 * A character's fields in the form, in the order the Block's setup puts them on the card,
 * each with an input that suits its kind: tags and short values offer what other
 * characters already use, lists and other characters are one row per item, and yes or no
 * is a choice rather than typing.
 */
export function CharacterInputs({ block, content, set, setField, setStat, show, hl, fid, others, classes = [], upload }: {
  block: Block;
  content: EntryContent;
  set: (patch: Partial<EntryContent>) => void;
  setField: (key: string, text: string) => void;
  setStat: (key: string, v: string) => void;
  /** Whether a part shows (an app pencil shows just the part being fixed). */
  show: (part: string) => boolean;
  /** Highlight and scroll target for the part being fixed. */
  hl: (part: string) => string;
  fid: (part: string) => string | undefined;
  /** The other characters in this Block, offered when linking one. */
  others: string[];
  /** Names from the game's own class Blocks, offered for a role or class. */
  classes?: string[];
  /** Guides: puts a step's picture in storage. Missing until the writer is signed in. */
  upload?: (file: File) => Promise<{ path: string } | string>;
}) {
  // Values other characters already have, so the same thing is written the same way.
  const used = (f: FieldDef) => [...new Set(block.entries.map((e) => (isCategory(f) ? e.categories[f.key] : e.sections.find((s) => s.label === f.key)?.text)?.trim())
    .filter((v): v is string => Boolean(v) && v!.length <= 40))];

  return (
    <>
      {shownFields(block).map((f) => {
        if (f.kind === 'chart') {
          // Every chart (Base stats, Growths...) gets its own grid of numbers.
          const defs = chartDefs(block, f);
          const part = f.key === STATS ? 'stats' : `chart:${f.key}`;
          if (!defs.length || !show(part)) return null;
          return (
            <div key={f.key} role="group" aria-label={f.label} id={fid(part)} className={'grid gap-1.5' + hl(part)}>
              <span className="text-sm font-bold">{f.label} <span className="font-normal text-muted">(as the game shows them)</span></span>
              <div className="grid grid-cols-4 gap-2">
                {defs.map((d) => (
                  <label key={d.key} className="grid gap-0.5">
                    <span className="text-[11px] font-bold uppercase text-muted">{d.label}</span>
                    <input type="number" inputMode="decimal" value={content.stats?.[d.key] ?? ''} onChange={(e) => setStat(d.key, e.target.value)} className={input + ' px-2 py-1.5'} />
                  </label>
                ))}
              </div>
            </div>
          );
        }
        if (f.key === DESCRIPTION) {
          if (!show('description')) return null;
          return (
            <label key={f.key} id={fid('description')} className={'grid gap-1' + hl('description')}>
              <span className="text-sm font-bold">{f.label}</span>
              <textarea value={content.description ?? ''} onChange={(e) => set({ description: e.target.value })} rows={3} placeholder={block.type === 'items' ? 'A line or two about it' : block.type === 'guide' ? 'What would you tell a friend, in two lines?' : 'Who they are, in a few lines'} className={input} />
            </label>
          );
        }
        const part = isCategory(f) ? `cat:${f.key}` : `section:${f.key}`;
        if (!show(part)) return null;
        const v = isCategory(f) ? content.categories[f.key] ?? '' : content.sections.find((s) => s.label === f.key)?.text ?? '';
        const put = (t: string) => (isCategory(f) ? set({ categories: { ...content.categories, [f.key]: t } }) : setField(f.key, t));

        if (f.kind === 'steps') {
          return (
            <div key={f.key} role="group" aria-label={f.label} id={fid(part)} className={'grid gap-1.5' + hl(part)}>
              <span className="text-sm font-bold">{f.label} <span className="font-normal text-muted">(Enter starts the next step)</span></span>
              <StepRows text={v} onChange={put} label={f.label} upload={upload} />
            </div>
          );
        }
        if (f.kind === 'list' || f.kind === 'links') {
          return (
            <div key={f.key} role="group" aria-label={f.label} id={fid(part)} className={'grid gap-1.5' + hl(part)}>
              <span className="text-sm font-bold">{f.label}</span>
              <Rows text={v} onChange={put} links={f.kind === 'links'} item={block.type === 'items'} single={block.type === 'guide' && f.kind === 'list'} names={others} label={f.label} />
            </div>
          );
        }
        if (f.kind === 'playable') {
          const [yes, no] = toggleOptions(f);
          return (
            <div key={f.key} role="group" aria-label={f.label} id={fid(part)} className={'flex items-center gap-3' + hl(part)}>
              <span className="flex-1 text-sm font-bold">{f.label}</span>
              <div className="flex rounded-full bg-card p-0.5 text-sm font-bold ring-1 ring-line">
                {[yes, no, ''].map((o) => (
                  <button key={o || 'unset'} type="button" onClick={() => put(o)} aria-pressed={v === o}
                    className={'rounded-full px-3 py-1 ' + (v === o ? (o === yes ? 'bg-leaf text-paper' : o === no ? 'bg-berry text-paper' : 'bg-ink text-paper') : 'text-muted hover:text-ink')}>{o || 'Not sure'}</button>
                ))}
              </div>
            </div>
          );
        }
        if (f.kind === 'yesno') {
          const now = /^(y|yes|true)$/i.test(v) ? 'Yes' : /^(n|no|false)$/i.test(v) ? 'No' : '';
          return (
            <div key={f.key} role="group" aria-label={f.label} id={fid(part)} className={'flex items-center gap-3' + hl(part)}>
              <span className="flex-1 text-sm font-bold">{f.label}</span>
              <div className="flex rounded-full bg-card-2 p-0.5 text-sm font-bold ring-1 ring-line">
                {(['Yes', 'No', ''] as const).map((o) => (
                  <button key={o || 'unset'} type="button" onClick={() => put(o)} aria-pressed={now === o}
                    className={'rounded-full px-3 py-1 ' + (now === o ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}>{o || 'Not sure'}</button>
                ))}
              </div>
            </div>
          );
        }
        // Suggestions: what other characters use, and for a role or class the game's own classes
        // and common ones too. Typing narrows them to the ones that match.
        const roleish = /\b(role|class|job)\b/i.test(f.label);
        const pool = f.kind === 'longtext' ? [] : [...new Set([...used(f), ...(roleish ? [...classes, ...COMMON_CLASSES] : [])])];
        const typed = v.trim().toLowerCase();
        const suggestions = pool.filter((s) => s !== v && (!typed || s.toLowerCase().includes(typed)));
        return (
          <label key={f.key} id={fid(part)} className={'grid gap-1' + hl(part)}>
            <span className="text-sm font-bold">{f.label}</span>
            {f.kind === 'longtext' ? (
              <textarea value={v} onChange={(e) => put(e.target.value)} rows={3} placeholder={PLACEHOLDER.longtext} className={input} />
            ) : (
              <input value={v} onChange={(e) => put(e.target.value)} type={f.kind === 'number' ? 'number' : 'text'} inputMode={f.kind === 'number' ? 'decimal' : undefined}
                placeholder={f.kind === 'tag' ? (used(f).slice(0, 3).join(', ') || 'A word or two') : PLACEHOLDER[f.kind]} className={input} />
            )}
            {/* What others already use, one tap away, on one line that scrolls sideways. */}
            {suggestions.length > 0 && (
              <span className="chip-strip -mx-1 flex gap-1.5 overflow-x-auto px-1">
                {suggestions.slice(0, 12).map((s) => (
                  <button key={s} type="button" onClick={() => put(s)} className="shrink-0 rounded-full bg-card px-2.5 py-0.5 text-xs font-bold ring-1 ring-line hover:ring-ink">{s}</button>
                ))}
              </span>
            )}
          </label>
        );
      })}
    </>
  );
}

/**
 * A list as one row per item: a name and, if wanted, what it does (or, linking other
 * characters, who and how they know them). Written back as "Name: note" lines, which is
 * how the card reads them.
 */
function Rows({ text, onChange, links, item = false, single = false, names, label }: {
  text: string; onChange: (t: string) => void; links: boolean; item?: boolean;
  /** One box per row, kept as written (a guide's Watch out: whole sentences, not names). */
  single?: boolean;
  names: string[]; label: string;
}) {
  // Items link other items, with how many ("Iron Ore: 3"); characters link people and how they know them.
  const who = links ? (item ? 'Which item' : 'Who') : 'Name';
  const how = links ? (item ? 'How many, or a note' : 'How they know them') : (item ? 'Details' : 'What it does');
  // Rows live here so an empty one (just added) stays until it's filled or removed.
  const [rows, setRows] = useState(() => {
    const items = single ? text.split('\n').map((l) => l.trim()).filter(Boolean).map((name) => ({ name, note: '' })) : listItems(text);
    return items.length ? items : [{ name: '', note: '' }];
  });
  const write = (next: { name: string; note: string }[]) => {
    setRows(next);
    onChange(next.filter((r) => r.name.trim() || r.note.trim()).map((r) => (r.note.trim() ? `${r.name.trim()}: ${r.note.trim()}` : r.name.trim())).join('\n'));
  };
  const edit = (i: number, p: Partial<{ name: string; note: string }>) => write(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const listId = `names-${label.replace(/\W+/g, '-')}`;
  return (
    <div className="grid gap-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-1.5">
          <input value={r.name} onChange={(e) => edit(i, { name: e.target.value })} list={links ? listId : undefined}
            placeholder={single ? 'One per row' : who} aria-label={single ? `${label} ${i + 1}` : `${label} ${i + 1}: ${who.toLowerCase()}`} className={input + ' min-w-0 py-1.5 ' + (single ? 'flex-1' : 'flex-[2] font-bold')} />
          {!single && (
            <input value={r.note} onChange={(e) => edit(i, { note: e.target.value })}
              placeholder={how} aria-label={`${label} ${i + 1}: ${how.toLowerCase()}`} className={input + ' min-w-0 flex-[3] py-1.5'} />
          )}
          <button type="button" onClick={() => write(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ name: '', note: '' }])} aria-label={`Remove ${r.name || 'this one'}`}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-berry"><X size={15} aria-hidden="true" /></button>
        </div>
      ))}
      {links && <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist>}
      <button type="button" onClick={() => setRows([...rows, { name: '', note: '' }])}
        className="inline-flex items-center gap-1 justify-self-start rounded-full px-2.5 py-1 text-xs font-bold text-muted ring-1 ring-line hover:text-ink hover:ring-ink">
        <Plus size={13} aria-hidden="true" /> Add another
      </button>
    </div>
  );
}

/**
 * A guide's steps, one row each: the words, then small buttons to move the step up or down,
 * cover it as a spoiler, add or change its picture, and take it out. Enter starts the next
 * step. Written back one line per step (src/lib/guides.ts), which is how the guide reads them.
 */
function StepRows({ text, onChange, label, upload }: { text: string; onChange: (t: string) => void; label: string; upload?: (file: File) => Promise<{ path: string } | string> }) {
  const [rows, setRows] = useState<Step[]>(() => {
    const steps = parseSteps(text);
    return steps.length ? steps : [{ text: '', spoiler: false }];
  });
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const files = useRef<HTMLInputElement>(null);
  const picking = useRef(0);
  const box = (i: number) => `step-${label.replace(/\W+/g, '-')}-${i}`;
  const write = (next: Step[]) => { setRows(next); onChange(stepsText(next)); };
  const edit = (i: number, p: Partial<Step>) => write(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    write(next);
  };
  const addAfter = (i: number) => {
    setRows([...rows.slice(0, i + 1), { text: '', spoiler: false }, ...rows.slice(i + 1)]);
    setTimeout(() => document.getElementById(box(i + 1))?.focus(), 0);
  };
  const pick = (i: number) => { picking.current = i; setNote(''); files.current?.click(); };
  const got = async (file: File | undefined) => {
    if (!file || !upload) return;
    const i = picking.current;
    setBusy(i);
    const res = await upload(file);
    setBusy(null);
    if (typeof res === 'string') setNote(res);
    else edit(i, { picture: res.path });
  };
  const small = 'grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink disabled:opacity-30';
  return (
    <div className="grid gap-2">
      <ol className="grid gap-2">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-1.5 rounded-2xl bg-card p-2 ring-1 ring-line">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
              <textarea id={box(i)} value={r.text} rows={2} placeholder={i === 0 ? 'The first thing to do' : 'Then…'}
                aria-label={`${label}: step ${i + 1}`}
                onChange={(e) => edit(i, { text: e.target.value.replace(/\n/g, ' ') })}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); addAfter(i); } }}
                className={input + ' min-w-0 flex-1 resize-y py-1.5' + (r.spoiler ? ' spoiler-cover' : '')} />
            </div>
            {r.picture && (
              <div className="ml-8 flex items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- the writer's own upload, any size */}
                <img src={pictureUrl(r.picture)} alt={`Picture for step ${i + 1}`} className={'max-h-28 w-auto max-w-[70%] rounded-xl object-contain ring-1 ring-line' + (r.spoiler ? ' blur-sm' : '')} />
                <button type="button" onClick={() => edit(i, { picture: undefined })} className="rounded-full px-2 py-1 text-xs font-bold text-muted ring-1 ring-line hover:text-berry">Remove picture</button>
              </div>
            )}
            <div className="ml-8 flex flex-wrap items-center gap-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`} className={small}><ArrowUp size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move step ${i + 1} down`} className={small}><ArrowDown size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => edit(i, { spoiler: !r.spoiler })} aria-pressed={r.spoiler}
                className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ' + (r.spoiler ? 'bg-ink text-paper' : 'text-muted hover:bg-card-2 hover:text-ink')}>
                <EyeOff size={13} aria-hidden="true" /> Spoiler
              </button>
              <button type="button" onClick={() => pick(i)} disabled={!upload || busy !== null} title={upload ? undefined : 'Sign in to add pictures'}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-muted hover:bg-card-2 hover:text-ink disabled:opacity-40">
                <ImagePlus size={13} aria-hidden="true" /> {busy === i ? 'Adding…' : r.picture ? 'Change picture' : upload ? 'Picture' : 'Picture (sign in)'}
              </button>
              <button type="button" onClick={() => write(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ text: '', spoiler: false }])} aria-label={`Remove step ${i + 1}`}
                className={small + ' ml-auto hover:text-berry'}><X size={15} aria-hidden="true" /></button>
            </div>
          </li>
        ))}
      </ol>
      <input ref={files} type="file" accept="image/*" hidden onChange={(e) => { void got(e.target.files?.[0]); e.target.value = ''; }} />
      {note && <p role="status" className="text-sm text-berry">{note}</p>}
      <button type="button" onClick={() => addAfter(rows.length - 1)}
        className="inline-flex items-center gap-1 justify-self-start rounded-full px-2.5 py-1 text-xs font-bold text-muted ring-1 ring-line hover:text-ink hover:ring-ink">
        <Plus size={13} aria-hidden="true" /> Add a step
      </button>
    </div>
  );
}
