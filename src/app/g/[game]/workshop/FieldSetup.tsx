'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import type { Block, FieldDef, FieldKind, Page, StatDef } from '@/data/pages';
import type { RouteOption } from '@/components/app/EntryPanel';
import { CharacterCard } from '@/components/app/CharacterCard';
import { Piece } from '@/components/Piece';
import { browserClient } from '@/lib/supabase/browser';
import { appChanged } from '@/app/actions';
import { DESCRIPTION, FIELD_KINDS, besideText, STATS, fieldsOf, hasValue, johnDoe, kindLabel, shownFields, spotOf, valueOf } from '@/lib/fields';

const input = 'w-full rounded-xl bg-card px-2.5 py-1.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-sky';
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');

/**
 * Setting up a Characters Block: which fields its cards have, what they're called, their
 * order, and which are spoilers, with "John Doe" filled in beside it so builders see the
 * card their choices make. Changing a Block changes it for everyone, so for now only the
 * game's moderators can save; anyone can try a setup and see the preview.
 */
export function FieldSetup({ gameId, block, routes, canSave, onClose }: {
  gameId: string; block: Block & { page: Page }; routes: RouteOption[]; canSave: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<FieldDef[]>(() => fieldsOf(block).map((f) => ({ ...f })));
  const [statNames, setStatNames] = useState(() => (block.stats ?? []).map((d) => d.label).join(', '));
  const [adding, setAdding] = useState<{ label: string; kind: FieldKind }>({ label: '', kind: 'text' });
  const [view, setView] = useState<'profile' | 'row'>('profile');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const color = `var(--${block.page.tint})`;

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Stat names become the chart's columns. Names already in use keep their key, so
  // entries keep their numbers.
  const stats: StatDef[] = useMemo(() => statNames.split(',').map((s) => s.trim()).filter(Boolean).map((label) => {
    const had = block.stats?.find((d) => d.label.toLowerCase() === label.toLowerCase());
    return had ? { ...had, label } : { key: slug(label), label, better: 'high' as const };
  }), [statNames, block.stats]);
  const draft = { ...block, fields, stats };
  const sample = johnDoe(draft);

  const patch = (i: number, p: Partial<FieldDef>) => { setFields(fields.map((f, j) => (j === i ? { ...f, ...p } : f))); setNote(''); };
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };
  // A field can go once no character has anything in it; until then it can be switched off.
  const used = (f: FieldDef) => block.entries.some((e) => hasValue(e, f));
  const add = () => {
    const label = adding.label.trim();
    if (!label) { setNote('Give the new field a name.'); return; }
    if (fields.some((f) => f.label.toLowerCase() === label.toLowerCase() || f.key.toLowerCase() === label.toLowerCase())) { setNote(`There's already a field called ${label}.`); return; }
    setFields([...fields, { key: label, label, kind: adding.kind }]);
    setAdding({ label: '', kind: 'text' });
    setNote('');
  };

  const save = async () => {
    if (fields.some((f) => !f.label.trim())) { setNote('Every field needs a name.'); return; }
    const db = browserClient();
    if (!db) { setNote('Sign in first.'); return; }
    setBusy(true);
    const { error } = await db.from('game_blocks').update({ fields: fields.map((f) => ({ ...f, label: f.label.trim() })), stats: stats.length ? stats : null })
      .eq('game_id', gameId).eq('block_key', block.id);
    if (!error) { await appChanged(gameId); router.refresh(); }
    setBusy(false);
    setNote(error ? `Couldn't save: ${error.message}` : 'Saved. The app shows the new setup now.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Set up ${block.title}`} onClick={(e) => e.stopPropagation()}
        className="rise max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-card p-5 shadow-soft outline-none sm:rounded-[2rem] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl">Set up {block.title}</h2>
            <p className="text-sm text-muted">Every field is optional. Switch them on or off, rename them, put them in order, or add your own. Empty ones don&apos;t show on a card.</p>
          </div>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2 ring-1 ring-line" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid content-start gap-3">
            <ul className="grid overflow-hidden rounded-2xl ring-1 ring-line">
              <li className="flex items-center gap-2 bg-card-2 px-3 py-2 text-sm">
                <span className="w-8" /><span className="font-bold">Name</span><span className="ml-auto text-xs text-muted">Always on, bold at the top</span>
              </li>
              {fields.map((f, i) => (
                <li key={f.key} className={'grid gap-2 border-t border-line px-3 py-2 ' + (f.off ? 'bg-card-2/60' : '')}>
                  <div className="flex items-center gap-2">
                    <button type="button" role="switch" aria-checked={!f.off} aria-label={`Show ${f.label}`} onClick={() => patch(i, { off: !f.off || undefined })}
                      className={'relative h-5 w-9 shrink-0 rounded-full transition ' + (f.off ? 'bg-line' : 'bg-ink')}>
                      <span className={'absolute top-0.5 size-4 rounded-full bg-card transition-all ' + (f.off ? 'left-0.5' : 'left-[1.15rem]')} />
                    </button>
                    <input value={f.label} onChange={(e) => patch(i, { label: e.target.value })} aria-label="Field name" className={input + ' min-w-0 flex-1 font-bold' + (f.off ? ' text-muted' : '')} />
                    <span className="hidden w-16 shrink-0 rounded-md bg-card-2 py-0.5 text-center text-[11px] font-bold sm:inline">{kindLabel(f.kind)}</span>
                    <button type="button" onClick={() => patch(i, { spoiler: !f.spoiler || undefined })} aria-pressed={Boolean(f.spoiler)} aria-label={`${f.label} is a spoiler`}
                      title={f.spoiler ? 'Spoiler: hidden until tapped' : 'Not a spoiler'}
                      className={'grid size-8 shrink-0 place-items-center rounded-full ' + (f.spoiler ? 'text-berry' : 'text-muted/60 hover:text-ink')}>
                      {f.spoiler ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    </button>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${f.label} up`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink disabled:opacity-30"><ArrowUp size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label={`Move ${f.label} down`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink disabled:opacity-30"><ArrowDown size={15} aria-hidden="true" /></button>
                    {f.key !== DESCRIPTION && f.key !== STATS && !used(f) && (
                      <button type="button" onClick={() => setFields(fields.filter((_, j) => j !== i))} aria-label={`Remove ${f.label}`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-berry"><Trash2 size={15} aria-hidden="true" /></button>
                    )}
                  </div>
                  {f.kind === 'chart' && !f.off && (
                    <label className="grid gap-1 pl-11 text-xs">
                      <span className="font-bold text-muted">Stat names, left to right, separated by commas</span>
                      <input value={statNames} onChange={(e) => setStatNames(e.target.value)} placeholder="HP, Str, Mag, Dex, Spd, Lck, Def, Res" className={input} />
                    </label>
                  )}
                  {(f.kind === 'text' || f.kind === 'number') && !f.off && (
                    <label className="flex items-center gap-2 pl-11 text-xs text-muted">
                      <input type="checkbox" checked={Boolean(f.beside)} onChange={(e) => patch(i, { beside: e.target.checked || undefined })} className="size-3.5 accent-[var(--color-ink)]" />
                      Small, beside the name (like Age)
                    </label>
                  )}
                </li>
              ))}
            </ul>

            <div className="grid gap-2 rounded-2xl bg-card-2 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold"><Plus size={15} aria-hidden="true" /> Add your own field</p>
              <div className="flex flex-wrap gap-2">
                <input value={adding.label} onChange={(e) => setAdding({ ...adding, label: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  placeholder="Its name, e.g. Voice actor" aria-label="New field name" className={input + ' min-w-40 flex-1'} />
                <button type="button" onClick={add} className="rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-paper">Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What kind of field">
                {FIELD_KINDS.map((k) => (
                  <button key={k.kind} type="button" role="radio" aria-checked={adding.kind === k.kind} onClick={() => setAdding({ ...adding, kind: k.kind })} title={k.hint}
                    className={'rounded-full px-3 py-1 text-xs font-bold ring-1 ' + (adding.kind === k.kind ? 'bg-ink text-paper ring-ink' : 'bg-card ring-line hover:ring-ink')}>{k.label}</button>
                ))}
              </div>
              <p className="text-xs text-muted">{FIELD_KINDS.find((k) => k.kind === adding.kind)?.hint}.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canSave ? (
                <button type="button" onClick={save} disabled={busy} className="btn-primary rounded-full px-5 py-2.5 font-bold disabled:opacity-60">{busy ? 'Saving…' : 'Save setup'}</button>
              ) : (
                <p className="text-sm text-muted">A Block&apos;s setup changes it for everyone, so a moderator saves it. Try things here and see the preview; suggesting a setup for votes comes later.</p>
              )}
              {note && <p role="status" className={'text-sm ' + (note.startsWith('Saved') ? 'text-leaf' : 'text-berry')}>{note}</p>}
            </div>
          </div>

          {/* The preview: John Doe, filled in for every field that's on. */}
          <div className="grid content-start gap-3 md:sticky md:top-0">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">Preview</p>
              <div role="group" aria-label="Preview as" className="flex rounded-full bg-card-2 p-0.5 text-xs font-bold ring-1 ring-line">
                {([['profile', 'Profile'], ['row', 'List row']] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                    className={'rounded-full px-3 py-1 ' + (view === v ? 'bg-signal text-ink' : 'text-muted hover:text-ink')}>{label}</button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-3" style={{ background: `color-mix(in srgb, ${color} 10%, white)` }}>
              <div className="rounded-2xl bg-card p-4 ring-1 ring-line">
                {view === 'profile' ? (
                  <CharacterCard entry={sample} block={draft} route="all" routes={routes} color={color} sample size={120} />
                ) : (
                  <SampleRow draft={draft} />
                )}
              </div>
            </div>
            <p className="text-xs text-muted">Made-up values, so you can see each field&apos;s place. Spoiler fields show covered, the way players first see them.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** John Doe as a List row: name, the field beside it, a tag and a place under it, the time on the right. */
function SampleRow({ draft }: { draft: Pick<Block, 'fields' | 'stats'> }) {
  const e = johnDoe(draft);
  const fields = shownFields(draft).filter((f) => !f.spoiler);
  const first = (spot: string, kind?: FieldKind) => fields.filter((f) => spotOf(f) === spot && (!kind || f.kind === kind)).map((f) => valueOf(e, f).text).find(Boolean);
  const sub = [first('tags', 'tag'), first('meta', 'place')].filter(Boolean).join(' · ');
  const besideField = fields.find((f) => spotOf(f) === 'beside');
  return (
    <div className="flex items-center gap-3">
      <Piece size={46} color="#b8bcc8">JD</Piece>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2"><span className="font-bold">{e.name}</span>{besideField && first('beside') && <span className="text-xs text-muted">{besideText(besideField, first('beside')!)}</span>}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
      {first('meta', 'when') && <span className="shrink-0 text-xs font-bold">{first('meta', 'when')}</span>}
    </div>
  );
}
