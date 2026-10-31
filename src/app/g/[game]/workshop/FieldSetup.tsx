'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Info, Plus, Trash2, X } from 'lucide-react';
import type { Block, FieldDef, FieldKind, Page, StatDef } from '@/data/pages';
import type { RouteOption } from '@/components/app/EntryPanel';
import { CharacterCard } from '@/components/app/CharacterCard';
import { Piece } from '@/components/Piece';
import { Tip } from '@/components/Tip';
import { SHEET, SheetHandle, useWide } from './split';
import { browserClient } from '@/lib/supabase/browser';
import { appChanged } from '@/app/actions';
import { DESCRIPTION, FIELD_KINDS, besideText, STATS, chartDefs, fieldsOf, hasValue, johnDoe, kindLabel, shownFields, spotOf, statKeyFor, valueOf } from '@/lib/fields';

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
  // Each chart's stat names as typed, by the chart's key.
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(fieldsOf(block).filter((f) => f.kind === 'chart')
    .map((f) => [f.key, chartDefs(block, f).map((d) => d.label).join(', ')])));
  const [adding, setAdding] = useState<{ label: string; kind: FieldKind }>({ label: '', kind: 'text' });
  const [view, setView] = useState<'profile' | 'row'>('profile');
  // Phones: how much of the screen the preview sheet takes, in percent.
  const [sheet, setSheet] = useState<number>(SHEET.start);
  const wide = useWide();
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

  // Stat names become each chart's columns. Names already in use keep their key, so
  // entries keep their numbers.
  const defsFor = (f: FieldDef): StatDef[] => (names[f.key] ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((label) => {
    const had = chartDefs(block, fieldsOf(block).find((o) => o.key === f.key) ?? f).find((d) => d.label.toLowerCase() === label.toLowerCase());
    return had ? { ...had, label } : { key: statKeyFor(f, slug(label)), label, better: 'high' as const };
  });
  // The Block's first chart keeps its stats on the Block; any other chart keeps its own.
  const first = fields.find((f) => f.key === STATS);
  const stats = first ? defsFor(first) : block.stats ?? [];
  const drafted = fields.map((f) => (f.kind === 'chart' && f.key !== STATS ? { ...f, stats: defsFor(f) } : f));
  const draft = { ...block, fields: drafted, stats };
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
    if (adding.kind === 'chart') setNames({ ...names, [label]: '' });
    setAdding({ label: '', kind: 'text' });
    setNote('');
  };

  const save = async () => {
    if (fields.some((f) => !f.label.trim())) { setNote('Every field needs a name.'); return; }
    const db = browserClient();
    if (!db) { setNote('Sign in first.'); return; }
    setBusy(true);
    const { error } = await db.from('game_blocks').update({ fields: drafted.map((f) => ({ ...f, label: f.label.trim() })), stats: stats.length ? stats : null })
      .eq('game_id', gameId).eq('block_key', block.id);
    if (!error) { await appChanged(gameId); router.refresh(); }
    setBusy(false);
    setNote(error ? `Couldn't save: ${error.message}` : 'Saved. The app shows the new setup now.');
  };

  return (
    // The setup is on the Workbench (globals.css); the preview looks exactly like the app. On a
    // phone it fills the screen: what you're building on top, the preview on a sheet underneath
    // that you drag to resize. From md up they sit side by side.
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Set up ${block.title}`} onClick={(e) => e.stopPropagation()}
        className="workbench rise flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden shadow-soft outline-none md:block md:h-auto md:max-h-[92vh] md:overflow-y-auto md:rounded-[2rem] md:p-6">
        <div className="flex shrink-0 items-center gap-3 px-4 py-2.5 md:items-start md:p-0">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate font-display text-xl md:text-2xl">Set up {block.title}</h2>
            <Tip text="Every field is optional. Switch them on or off, rename them, put them in order, or add your own. Empty ones don't show on a card.">
              <button type="button" aria-label="How setting up works" className="grid size-7 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
                <Info size={17} aria-hidden="true" />
              </button>
            </Tip>
          </div>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2 ring-1 ring-line" aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>

        <div data-split className="flex min-h-0 flex-1 flex-col md:mt-5 md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:gap-6">
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain px-4 pb-4 md:overflow-visible md:p-0">
            <ul className="grid rounded-2xl bg-card ring-1 ring-line">
              <li className="flex items-center gap-2 rounded-t-2xl bg-card-2 px-3 py-2 text-sm">
                <span className="w-8" /><span className="font-bold">Name</span><span className="ml-auto text-xs text-muted">Always on, bold at the top</span>
              </li>
              {fields.map((f, i) => (
                <li key={f.key} className={'grid gap-2 border-t border-line px-3 py-2 last:rounded-b-2xl ' + (f.off ? 'bg-card-2/60' : '')}>
                  <div className="flex items-center gap-2">
                    <button type="button" role="switch" aria-checked={!f.off} aria-label={`Show ${f.label}`} onClick={() => patch(i, { off: !f.off || undefined })}
                      className={'relative h-5 w-9 shrink-0 rounded-full transition ' + (f.off ? 'bg-line' : 'bg-ink')}>
                      <span className={'absolute top-0.5 size-4 rounded-full bg-card transition-all ' + (f.off ? 'left-0.5' : 'left-[1.15rem]')} />
                    </button>
                    <input value={f.label} onChange={(e) => patch(i, { label: e.target.value })} aria-label="Field name" className={input + ' min-w-0 flex-1 font-bold' + (f.off ? ' text-muted' : '')} />
                    <span className="hidden w-28 shrink-0 truncate rounded-md bg-card-2 px-1 py-0.5 text-center text-[11px] font-bold sm:inline">{kindLabel(f.kind)}</span>
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
                    <div className="grid gap-1 pl-11 text-xs">
                      <div className="flex items-center gap-2">
                        <label htmlFor={`stats-${block.id}-${slug(f.key)}`} className="flex-1 font-bold text-muted">Stat names, in order, separated by commas</label>
                        <StatSuggestions current={names[f.key] ?? ''} onPick={(v) => setNames({ ...names, [f.key]: v })} />
                      </div>
                      <input id={`stats-${block.id}-${slug(f.key)}`} value={names[f.key] ?? ''} onChange={(e) => setNames({ ...names, [f.key]: e.target.value })}
                        placeholder="HP, Str, Mag, Dex, Spd, Lck, Def, Res" className={input} />
                      {/* Both are on unless switched off; with both off the chart only shows in the form. */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={!f.noWeb} onChange={(e) => patch(i, { noWeb: !e.target.checked || undefined })} className="size-3.5 accent-[var(--color-ink)]" />
                          Web chart by the portrait
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={!f.noNumbers} onChange={(e) => patch(i, { noNumbers: !e.target.checked || undefined })} className="size-3.5 accent-[var(--color-ink)]" />
                          Number boxes, colored against everyone
                        </label>
                      </div>
                    </div>
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

            <div className="grid gap-2 rounded-2xl bg-card p-3 ring-1 ring-line">
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
              {/* On a phone the example sits right here; on wider screens it's under the preview. */}
              <KindExample {...adding} block={block} routes={routes} color={color} className="md:hidden" />
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

          {/* The preview: John Doe, filled in for every field that's on, on the Page's own tint
              like in the app. On a phone it's a sheet over the Workbench, dragged to resize. */}
          <div data-sheet className="flex shrink-0 flex-col rounded-t-[1.5rem] shadow-[0_-1px_0_var(--line),0_-10px_24px_-14px_rgba(21,23,28,0.35)] md:sticky md:top-0 md:grid md:h-auto md:content-start md:gap-3 md:rounded-none md:shadow-none"
            style={wide ? undefined : { height: `${sheet}%`, background: `var(--${block.page.tint}-soft)` }}>
            <SheetHandle pct={sheet} onChange={setSheet}>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">Players see</p>
                <div role="group" aria-label="Preview as" className="flex rounded-full bg-card p-0.5 text-xs font-bold ring-1 ring-line">
                  {([['profile', 'Profile'], ['row', 'List row']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                      className={'rounded-full px-3 py-1 ' + (view === v ? 'bg-signal text-ink' : 'text-muted hover:text-ink')}>{label}</button>
                  ))}
                </div>
              </div>
            </SheetHandle>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:overflow-visible md:rounded-[1.5rem] md:p-3"
              style={wide ? { background: `var(--${block.page.tint}-soft)` } : undefined}>
              <div className="rounded-2xl bg-card p-3 ring-1 ring-line md:p-4">
                {view === 'profile' ? (
                  <CharacterCard entry={sample} block={draft} route="all" routes={routes} color={color} sample size={wide ? 120 : 76} />
                ) : (
                  <SampleRow draft={draft} />
                )}
              </div>
            </div>
            <p className="hidden text-xs text-muted md:block">Made-up values, so you can see each field&apos;s place. Spoiler fields show covered, the way players first see them.</p>
            <KindExample {...adding} block={block} routes={routes} color={color} className="hidden md:block" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stat sets common in fantasy and adventure games, to start from instead of typing. */
const STAT_SETS: { name: string; stats: string }[] = [
  { name: 'Tactics RPG', stats: 'HP, Str, Mag, Dex, Spd, Lck, Def, Res' },
  { name: 'Classic RPG', stats: 'HP, MP, Atk, Def, Mag, Spd' },
  { name: 'Tabletop', stats: 'Str, Dex, Con, Int, Wis, Cha' },
  { name: 'Action RPG', stats: 'Vigor, Mind, Endurance, Strength, Dexterity, Intelligence, Faith' },
  { name: 'Monster battler', stats: 'HP, Atk, Def, Sp. Atk, Sp. Def, Speed' },
];
const ONE_STATS = ['HP', 'MP', 'Atk', 'Def', 'Mag', 'Res', 'Spd', 'Lck', 'Move'];

/**
 * A small menu beside the stat names: pick a whole set, or add one stat at a time. It
 * floats over the setup, so it takes no room until it's opened.
 */
function StatSuggestions({ current, onPick }: { current: string; onPick: (stats: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    // Escape closes just this menu, not the whole setup (caught before the setup's own listener).
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  const have = current.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const pick = (stats: string) => { onPick(stats); setOpen(false); };
  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold text-ink ring-1 ring-line hover:ring-ink">
        Suggestions <ChevronDown size={13} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 grid w-72 gap-1 rounded-2xl bg-card p-2 shadow-soft ring-1 ring-line">
          {STAT_SETS.map((set) => (
            <button key={set.name} type="button" onClick={() => pick(set.stats)} className="grid rounded-xl px-2 py-1.5 text-left hover:bg-card-2">
              <span className="font-bold">{set.name}</span>
              <span className="truncate text-muted">{set.stats}</span>
            </button>
          ))}
          <p className="mt-1 border-t border-line px-2 pt-2 font-bold text-muted">Or add one</p>
          <div className="flex flex-wrap gap-1 px-1 pb-1">
            {ONE_STATS.filter((s) => !have.includes(s.toLowerCase())).map((s) => (
              <button key={s} type="button" onClick={() => onPick(have.length ? `${current.trim().replace(/,\s*$/, '')}, ${s}` : s)}
                className="rounded-full bg-card-2 px-2.5 py-1 font-bold ring-1 ring-line hover:ring-ink">+ {s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A likely name for each kind, until the builder types one. */
const EXAMPLE_NAMES: Record<FieldKind, string> = {
  text: 'Voice actor', number: 'Level', tag: 'Weapon', place: 'Hometown', when: 'Joins', chart: 'Growths',
  list: 'Skills', links: 'Family', longtext: 'Backstory', yesno: 'Recruitable',
};

/** Kinds that hold several things get several in their example, so it's clear they can. */
const EXAMPLE_VALUES: Partial<Record<FieldKind, string>> = {
  list: 'Fire Wall: Blocks a lane for two turns.\nQuick Step: Moves again after acting.\nSecond Wind: Heals a little when hurt.',
  links: 'Jane Doe: Sister\nOld Tom: Mentor\nThe Baron: Rival',
};

/** One line under the example on how that kind behaves. */
const EXAMPLE_NOTES: Record<FieldKind, string> = {
  text: 'A few words. Tick "beside the name" to show it small next to the name, like Age.',
  number: 'A number. Tick "beside the name" to show it small next to the name.',
  tag: 'A pill under the name. Players can also filter the list by it.',
  place: 'Under the name, with a pin.',
  when: 'Under the name, with a clock: a chapter, a date or a time.',
  chart: "A web beside the portrait and number boxes colored against everyone else. Tap a box to see everyone's numbers.",
  list: 'Each line is its own item. "Name: what it does" puts the name in bold.',
  links: "Other characters from this Block. Players tap one to open that character's profile.",
  longtext: 'A few sentences under its own heading.',
  yesno: "A pill with a tick when the answer is yes. When it's no, nothing shows.",
};

/**
 * The field being added, on its own on a small John Doe card: how that kind of field looks
 * and where it sits, using the name typed so far.
 */
function KindExample({ label, kind, block, routes, color, className = '' }: { label: string; kind: FieldKind; block: Block; routes: RouteOption[]; color: string; className?: string }) {
  const name = label.trim() || EXAMPLE_NAMES[kind];
  const sampleStats = kind === 'chart' ? ['HP', 'Str', 'Mag', 'Spd', 'Def'].map((l) => ({ key: `${name}.${l.toLowerCase()}`, label: l, better: 'high' as const })) : undefined;
  const draft = { title: block.title, icon: block.icon, fields: [{ key: name, label: name, kind, stats: sampleStats }], stats: [] };
  const entry = johnDoe(draft);
  const more = EXAMPLE_VALUES[kind];
  if (more) entry.sections = entry.sections.map((s) => ({ ...s, text: more }));
  return (
    <div className={className}>
      <div className="grid gap-2 rounded-2xl border border-dashed border-line p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Example: {kindLabel(kind)}</p>
        <div className="rounded-xl bg-card p-3 ring-1 ring-line">
          <CharacterCard entry={entry} block={draft} route="all" routes={routes} color={color} sample size={56} />
        </div>
        <p className="text-xs text-muted">{EXAMPLE_NOTES[kind]}</p>
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
