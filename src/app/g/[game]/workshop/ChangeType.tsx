'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import type { Block, BlockType, Page } from '@/data/pages';
import { Tip } from '@/components/Tip';
import { EditorShell } from './EditorShell';
import { TypePicker, TypePreview } from './AddBlock';
import { browserClient } from '@/lib/supabase/browser';
import { appChanged } from '@/app/actions';
import { RETYPE_TO, blockTypeInfo, retypeProblem, typeName } from '@/lib/block-types';
import { setupContent } from '@/lib/setup-draft';
import type { NewDraft } from './useWorkshop';

type Placed = Block & { page: Page };

/** The filter each type starts with, as Add Block gives a new Block (and ship_setup in 20261129000000). */
const FILTERS: Partial<Record<BlockType, string[]>> = { characters: ['Role or class'], items: ['Type'], classes: ['Tier'] };

/**
 * Changing the type of a Block with nothing in it yet (Matt's Ocarina review, item 6; docs/workshop.md):
 * Ocarina's Items started as a Collection, an old type. Pick the new type and see its example, as in Add Block.
 * Moderators change it straight away; anyone else signed in sends it as a setup Draft for votes. Its name,
 * symbol and Page stay; it's set up for its new type afterwards.
 */
export function ChangeType({ gameId, block, blocks, mod, signedIn, postDraft, onSubmitted, onClose }: {
  gameId: string; block: Placed; blocks: Placed[]; mod: boolean; signedIn: boolean;
  postDraft: (d: NewDraft) => Promise<{ error?: string; id?: string }>;
  onSubmitted: (draftId: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<BlockType | null>(null);
  const [open, setOpen] = useState(true);
  const [peek, setPeek] = useState<BlockType | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const problem = retypeProblem(block, blocks);
  const blocked = (t: BlockType) => !RETYPE_TO.includes(t) ? 'Add this as a new Block instead: it works from other Blocks'
    : t === block.type ? `${block.title} is this already` : null;
  const shown = peek ?? type;

  const change = async () => {
    if (!type) { setNote('Pick a type first.'); return; }
    const db = browserClient();
    if (!db) { setNote('Sign in first.'); return; }
    setBusy(true);
    const { error } = await db.from('game_blocks')
      .update({ type, fields: null, stats: null, look: null, tier_setup: null, plan_setup: null, filters: FILTERS[type] ?? [], by_route: Boolean(block.byRoute) && type !== 'guide' })
      .eq('game_id', gameId).eq('block_key', block.id);
    if (error) { setBusy(false); setNote(`Couldn't change it: ${error.message}`); return; }
    await appChanged(gameId);
    router.refresh();
    setBusy(false);
    onClose();
  };

  const submit = async () => {
    if (!type) { setNote('Pick a type first.'); return; }
    setBusy(true);
    const content = setupContent(block, { type });
    const res = await postDraft({ blockKey: block.id, kind: 'opinion', title: content.name, content: content as never, source: '', theory: false, action: 'setup' });
    setBusy(false);
    if (res.error || !res.id) { setNote(/no setup in it/i.test(res.error ?? '') ? 'Changing a type is almost ready: the database needs one more update.' : res.error ?? "Couldn't send it. Try again in a moment."); return; }
    onSubmitted(res.id);
  };

  return (
    <EditorShell
      label={`Change the type of ${block.title}`}
      title={`Change the type of ${block.title}`}
      titleExtra={
        <Tip text="A Block's type decides how its entries look and what they hold. While nothing is in it yet, it can become another type. Its name, symbol and Page stay.">
          <button type="button" aria-label="How changing a type works" className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink">
            <Info size={17} aria-hidden="true" />
          </button>
        </Tip>
      }
      actions={problem ? undefined : mod ? (
        <button type="button" onClick={change} disabled={busy || !type} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">{busy ? 'Changing…' : 'Change type'}</button>
      ) : signedIn ? (
        <button type="button" onClick={submit} disabled={busy || !type} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
          {busy ? 'Sending…' : <><span className="sm:hidden">Submit</span><span className="hidden sm:inline">Submit for votes</span></>}
        </button>
      ) : undefined}
      note={note ? <p role="status" className="text-berry">{note}</p> : problem ? <p className="text-berry">{problem}</p>
        : !mod && !signedIn ? <p className="text-muted">Try the types here and see each one&apos;s example. Sign in to submit a change for votes.</p> : undefined}
      onClose={onClose}
      dirty={false}
      onSaveDraft={onClose}
      onDiscard={onClose}
      draftHint="Nothing to keep here yet."
      tint={block.page.tint}
      editor={
        <div className="grid gap-4">
          <p className="text-sm">
            <span className="font-bold">{block.title}</span> is {typeName(block.type)} Block{block.type === 'collection' ? ', an old type the Workshop no longer adds' : ''}.
            {' '}{problem ? '' : 'Pick what it should be:'}
          </p>
          {!problem && (
            <TypePicker type={type} open={open} setOpen={setOpen} peek={peek} setPeek={setPeek} blocked={blocked}
              onPick={(t) => { setType(t); setOpen(false); setPeek(null); setNote(''); }} />
          )}
          {type && (
            <p className="text-sm text-muted">
              It becomes {typeName(type)} Block: {blockTypeInfo(type)?.question} After that, Set up chooses what its entries show.
            </p>
          )}
        </div>
      }
      preview={shown ? <TypePreview gameId={gameId} type={shown} tint={block.page.tint} title={block.title} icon={block.icon} />
        : <p className="text-sm text-muted">Pick a type, and an example of it shows here.</p>}
    />
  );
}
