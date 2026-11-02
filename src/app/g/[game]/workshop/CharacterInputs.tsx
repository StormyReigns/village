'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Block, EntryContent, FieldDef } from '@/data/pages';
import { DESCRIPTION, STATS, chartDefs, isCategory, listItems, shownFields, toggleOptions } from '@/lib/fields';

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
export function CharacterInputs({ block, content, set, setField, setStat, show, hl, fid, others, classes = [] }: {
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
              <textarea value={content.description ?? ''} onChange={(e) => set({ description: e.target.value })} rows={3} placeholder={block.type === 'items' ? 'A line or two about it' : 'Who they are, in a few lines'} className={input} />
            </label>
          );
        }
        const part = isCategory(f) ? `cat:${f.key}` : `section:${f.key}`;
        if (!show(part)) return null;
        const v = isCategory(f) ? content.categories[f.key] ?? '' : content.sections.find((s) => s.label === f.key)?.text ?? '';
        const put = (t: string) => (isCategory(f) ? set({ categories: { ...content.categories, [f.key]: t } }) : setField(f.key, t));

        if (f.kind === 'list' || f.kind === 'links') {
          return (
            <div key={f.key} role="group" aria-label={f.label} id={fid(part)} className={'grid gap-1.5' + hl(part)}>
              <span className="text-sm font-bold">{f.label}</span>
              <Rows text={v} onChange={put} links={f.kind === 'links'} item={block.type === 'items'} names={others} label={f.label} />
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
function Rows({ text, onChange, links, item = false, names, label }: { text: string; onChange: (t: string) => void; links: boolean; item?: boolean; names: string[]; label: string }) {
  // Items link other items, with how many ("Iron Ore: 3"); characters link people and how they know them.
  const who = links ? (item ? 'Which item' : 'Who') : 'Name';
  const how = links ? (item ? 'How many, or a note' : 'How they know them') : (item ? 'Details' : 'What it does');
  // Rows live here so an empty one (just added) stays until it's filled or removed.
  const [rows, setRows] = useState(() => {
    const items = listItems(text);
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
            placeholder={who} aria-label={`${label} ${i + 1}: ${who.toLowerCase()}`} className={input + ' min-w-0 flex-[2] py-1.5 font-bold'} />
          <input value={r.note} onChange={(e) => edit(i, { note: e.target.value })}
            placeholder={how} aria-label={`${label} ${i + 1}: ${how.toLowerCase()}`} className={input + ' min-w-0 flex-[3] py-1.5'} />
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
