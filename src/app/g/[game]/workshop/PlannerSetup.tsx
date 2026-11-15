'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Info, Plus, Trash2, X } from 'lucide-react';
import type { Block, Page } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { Tip } from '@/components/Tip';
import { initials } from '@/components/app/entries';
import { EditorShell } from './EditorShell';
import { browserClient } from '@/lib/supabase/browser';
import { appChanged } from '@/app/actions';
import { DESCRIPTION, isCategory, shownFields } from '@/lib/fields';
import { MAX_SLOT, STEP_LABEL, nextStep, slotKeyFor, tidySetup, type PlanSetup, type PlanSlot } from '@/lib/planner';
import { bandOrder, classShape } from '@/lib/classes';

// Set up for a Planner Block (docs/blocks/planner.md, slice 3), on the Workbench: which Characters Block a
// party comes from, its size, the fields that say how to get a unit, the Classes Block for class steps,
// and the gear slots. The preview is the app's look: a sample party of three and one unit's plan.
// Moderators save it, as with every setup (game_blocks.plan_setup).

type Placed = Block & { page: Page };

const box = 'rounded-xl bg-card px-2.5 py-1.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-sky';
const input = 'w-full ' + box;
const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className="mb-1.5">
    <h3 className="text-sm font-bold">{children}</h3>
    {hint && <p className="text-xs text-muted">{hint}</p>}
  </div>
);

export function PlannerSetup({ gameId, block, blocks, canSave, onClose }: {
  gameId: string; block: Placed; blocks: Placed[]; canSave: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const start = useMemo<PlanSetup>(() => block.planSetup ?? { roster: blocks.find((b) => b.type === 'characters')?.id ?? '' }, [block.planSetup, blocks]);
  const [setup, setSetup] = useState<PlanSetup>(start);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [newSlot, setNewSlot] = useState('');
  const baseline = JSON.stringify(tidySetup(start));
  const dirty = JSON.stringify(tidySetup(setup)) !== baseline;

  const characters = blocks.filter((b) => b.type === 'characters');
  const classesBlocks = blocks.filter((b) => b.type === 'classes');
  const itemBlocks = blocks.filter((b) => b.type === 'items');
  const roster = blocks.find((b) => b.id === setup.roster);
  // Fields that can say how to get a unit: anything but tags, charts and links.
  const unlockable = roster ? [...shownFields(roster).filter((f) => !isCategory(f) && !['chart', 'links', 'tier', 'yesno', 'playable'].includes(f.kind) && f.key !== DESCRIPTION),
    { key: DESCRIPTION, label: 'Description', kind: 'longtext' as const }] : [];
  const unlock = setup.unlock ?? [];
  const labelOf = (k: string) => unlockable.find((f) => f.key === k)?.label ?? k;
  const slots = setup.slots ?? [];
  const patchSlot = (i: number, p: Partial<PlanSlot>) => setSetup({ ...setup, slots: slots.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  const save = async () => {
    if (!setup.roster) { setNote('Pick the Block a party comes from.'); return; }
    if (slots.some((s) => !s.label.trim())) { setNote('Every gear slot needs a name.'); return; }
    const db = browserClient();
    if (!db) { setNote('Sign in first.'); return; }
    setBusy(true);
    const value = tidySetup(setup);
    const { error } = await db.from('game_blocks').update({ plan_setup: value }).eq('game_id', gameId).eq('block_key', block.id);
    if (!error) { await appChanged(gameId); router.refresh(); }
    setBusy(false);
    setNote(error ? `Couldn't save: ${error.message}` : 'Saved. The app shows the new setup now.');
  };

  return (
    <EditorShell
      label={`Set up ${block.title}`}
      title={`Set up ${block.title}`}
      titleExtra={
        <Tip text="Players build their own party from these Blocks. Their plans are private; this only sets what they pick from and how many fit.">
          <button type="button" aria-label="How setting up works" className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
            <Info size={17} aria-hidden="true" />
          </button>
        </Tip>
      }
      actions={canSave && (
        <button type="button" onClick={save} disabled={busy} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">{busy ? 'Saving…' : 'Save setup'}</button>
      )}
      note={note ? <p role="status" className={note.startsWith('Saved') ? 'text-leaf' : 'text-berry'}>{note}</p>
        : !canSave ? <p className="text-muted">Only the game&apos;s moderators can save a setup for now. Try changes here and see them in the preview.</p> : undefined}
      onClose={onClose}
      dirty={dirty}
      onSaveDraft={onClose}
      onDiscard={onClose}
      draftHint="Changes to a Planner's setup aren't kept as a draft yet. Close again to leave without saving."
      tint={block.page.tint}
      editor={
        <div className="grid gap-5">
          <section>
            <Label hint="The units a player picks for their party.">Party comes from</Label>
            <select value={setup.roster} onChange={(e) => setSetup({ ...setup, roster: e.target.value, unlock: undefined })} aria-label="Party comes from" className={input}>
              {!roster && <option value="">Pick a Block</option>}
              {characters.map((b) => <option key={b.id} value={b.id}>{b.page.title} · {b.title}</option>)}
            </select>
          </section>

          <section>
            <Label hint="The most units a party holds, like the game's deploy limit.">Party size</Label>
            <div className="flex items-center gap-3">
              <input type="number" min={1} max={100} value={setup.size ?? ''} disabled={!setup.size} aria-label="Party size"
                onChange={(e) => setSetup({ ...setup, size: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} className={box + ' w-24 disabled:opacity-40'} />
              <label className="inline-flex shrink-0 items-center gap-2 text-sm">
                <input type="checkbox" checked={!setup.size} onChange={(e) => setSetup({ ...setup, size: e.target.checked ? undefined : 6 })} /> No limit
              </label>
            </div>
          </section>

          <section>
            <Label hint="The first sentence of each, in this order, on a unit's line until they're recruited. Their route's own text comes first.">How to get a unit</Label>
            {unlock.length > 0 && (
              <ol className="mb-2 grid gap-1">
                {unlock.map((k, i) => (
                  <li key={k} className="flex items-center gap-1 rounded-xl bg-card px-2.5 py-1 text-sm ring-1 ring-line">
                    <span className="flex-1 font-bold">{labelOf(k)}</span>
                    <button type="button" onClick={() => { const u = [...unlock]; [u[i - 1], u[i]] = [u[i], u[i - 1]]; setSetup({ ...setup, unlock: u }); }} disabled={i === 0} aria-label={`Move ${labelOf(k)} up`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink disabled:opacity-30"><ArrowUp size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => { const u = [...unlock]; [u[i + 1], u[i]] = [u[i], u[i + 1]]; setSetup({ ...setup, unlock: u }); }} disabled={i === unlock.length - 1} aria-label={`Move ${labelOf(k)} down`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink disabled:opacity-30"><ArrowDown size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => setSetup({ ...setup, unlock: unlock.filter((x) => x !== k) })} aria-label={`Take ${labelOf(k)} off`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-berry"><X size={15} aria-hidden="true" /></button>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-wrap gap-1.5">
              {unlockable.filter((f) => !unlock.includes(f.key)).map((f) => (
                <button key={f.key} type="button" onClick={() => setSetup({ ...setup, unlock: [...unlock, f.key] })}
                  className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink"><Plus size={12} aria-hidden="true" /> {f.label}</button>
              ))}
            </div>
            {!unlock.length && <p className="mt-1 text-xs text-muted">None picked: the first field named like &ldquo;recruit&rdquo; or &ldquo;unlock&rdquo;.</p>}
          </section>

          <section>
            <Label hint="One class per tier for each unit, with the classes that suit them first.">Class steps</Label>
            <select value={setup.classes ?? ''} onChange={(e) => setSetup({ ...setup, classes: e.target.value || undefined })} aria-label="Class steps" className={input}>
              <option value="">None</option>
              {classesBlocks.map((b) => <option key={b.id} value={b.id}>{b.page.title} · {b.title}</option>)}
            </select>
          </section>

          <section>
            <Label hint="What a unit carries. Each slot draws from an Items Block, and can take only some of its items.">Gear slots</Label>
            <ul className="grid gap-2">
              {slots.map((s, i) => {
                const from = itemBlocks.find((b) => b.id === s.from);
                const tags = from ? shownFields(from).filter((f) => f.kind === 'tag') : [];
                const values = s.tag?.key && from ? [...new Set(from.entries.map((e) => e.categories[s.tag!.key]).filter(Boolean))] : [];
                return (
                  <li key={s.key} className="grid gap-2 rounded-2xl bg-card p-2.5 ring-1 ring-line">
                    <div className="flex items-center gap-2">
                      <input value={s.label} onChange={(e) => patchSlot(i, { label: e.target.value })} aria-label="Slot name" className={input + ' min-w-0 flex-1 font-bold'} />
                      <button type="button" onClick={() => setSetup({ ...setup, slots: slots.filter((_, j) => j !== i) })} aria-label={`Remove ${s.label}`}
                        className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-berry"><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <select value={s.from} onChange={(e) => patchSlot(i, { from: e.target.value, tag: undefined })} aria-label={`${s.label} draws from`} className={input}>
                        {itemBlocks.map((b) => <option key={b.id} value={b.id}>{b.page.title} · {b.title}</option>)}
                      </select>
                      <label className="inline-flex items-center gap-2 text-sm">Fits
                        <input type="number" min={1} max={MAX_SLOT} value={s.count ?? 1} aria-label={`How many fit in ${s.label}`}
                          onChange={(e) => patchSlot(i, { count: Math.max(1, Math.min(MAX_SLOT, Number(e.target.value) || 1)) })} className={box + ' w-20'} />
                      </label>
                    </div>
                    {tags.length > 0 && (
                      <div className="grid gap-1.5">
                        <select value={s.tag?.key ?? ''} onChange={(e) => patchSlot(i, { tag: e.target.value ? { key: e.target.value, values: [] } : undefined })} aria-label={`Limit ${s.label} by`} className={input}>
                          <option value="">Every item in {from?.title}</option>
                          {tags.map((f) => <option key={f.key} value={f.key}>Only some values of {f.label}</option>)}
                        </select>
                        {s.tag && (
                          <div className="flex flex-wrap gap-1.5">
                            {values.map((v) => {
                              const on = s.tag!.values.includes(v);
                              return (
                                <button key={v} type="button" aria-pressed={on} onClick={() => patchSlot(i, { tag: { key: s.tag!.key, values: on ? s.tag!.values.filter((x) => x !== v) : [...s.tag!.values, v] } })}
                                  className={'rounded-full px-2.5 py-1 text-xs font-bold ring-1 ' + (on ? 'bg-signal text-ink ring-signal' : 'bg-card ring-line hover:ring-ink')}>{v}</button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {itemBlocks.length > 0 ? (
              <form className="mt-2 flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                const label = newSlot.trim();
                if (!label) return;
                setSetup({ ...setup, slots: [...slots, { key: slotKeyFor(label, slots.map((s) => s.key)), label, from: itemBlocks[0].id, count: 1 }] });
                setNewSlot('');
              }}>
                <input value={newSlot} onChange={(e) => setNewSlot(e.target.value)} placeholder="Weapons, Accessories…" aria-label="New slot's name" className={input + ' min-w-0 flex-1'} />
                <button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink"><Plus size={14} aria-hidden="true" /> Add a slot</button>
              </form>
            ) : <p className="text-xs text-muted">This game has no Items Block yet, so no gear slots.</p>}
          </section>
        </div>
      }
      preview={<Preview setup={tidySetup(setup)} roster={roster} classes={blocks.find((b) => b.id === setup.classes)} itemBlocks={itemBlocks} tint={block.page.tint} />}
    />
  );
}

/** The app's look with this setup: a sample party of three (their lines as they'd read before
 *  recruiting) and the first one's plan, with empty class steps and slots. */
function Preview({ setup, roster, classes, itemBlocks, tint }: { setup: PlanSetup; roster?: Placed; classes?: Placed; itemBlocks: Placed[]; tint: string }) {
  const sample = (roster?.entries ?? []).filter((e) => !e.header && !e.spoiler).slice(0, 3);
  const color = `var(--${roster?.page.tint ?? tint})`;
  const shape = classes ? classShape(classes) : undefined;
  const bands = classes && shape?.band ? bandOrder(classes.entries, shape.band, shape.choices).slice(0, 4) : [];
  return (
    <div className="grid gap-3 rounded-[1.25rem] p-3" style={{ background: `var(--${tint}-soft)` }}>
      <div className="rounded-[1.25rem] bg-card p-4">
        <p className="font-bold">{setup.size ? `${sample.length} of ${setup.size}` : sample.length} in your party</p>
        {sample.length === 0 ? <p className="mt-2 text-sm text-muted">Pick the Block a party comes from to see a sample.</p> : (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
            {sample.map((e) => {
              const step = roster ? nextStep(e, { roster, route: 'all', recruited: false, setup }) : { kind: 'none' as const, text: '' };
              return (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                  {step.kind === 'recruit' ? <Piece size={44} outline>{initials(e.name)}</Piece>
                    : <Piece size={44} color={color} image={e.icon}>{e.icon ? null : initials(e.name)}</Piece>}
                  <span className="min-w-0">
                    <span className="block font-bold leading-tight">{e.name}</span>
                    {step.text && <span className="mt-0.5 block text-sm leading-snug text-muted">{STEP_LABEL[step.kind] && <span className="font-bold text-ink">{STEP_LABEL[step.kind]}: </span>}{step.text}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {sample[0] && (bands.length > 0 || (setup.slots ?? []).length > 0) && (
        <div className="rounded-[1.25rem] bg-card p-4">
          <p className="font-display text-lg leading-tight">Your plan for {sample[0].name}</p>
          {bands.length > 0 && (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Class steps</p>
              <div className="mt-1 flex flex-wrap gap-3">{bands.map((b) => <span key={b} className="grid justify-items-center gap-1 text-xs font-bold"><Piece size={36} outline><Plus size={12} aria-hidden="true" /></Piece>{b}</span>)}</div>
            </>
          )}
          {(setup.slots ?? []).map((s) => (
            <div key={s.key}>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">{s.label}{(s.count ?? 1) > 1 ? ` · 0 of ${s.count}` : ''}</p>
              <p className="text-xs text-muted">From {itemBlocks.find((b) => b.id === s.from)?.title ?? 'an Items Block'}{s.tag ? `: only ${s.tag.values.join(', ') || 'none picked yet'}` : ''}</p>
              <span className="mt-1 grid w-fit justify-items-center gap-1 text-xs font-bold"><Piece size={36} outline><Plus size={12} aria-hidden="true" /></Piece>Add</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
