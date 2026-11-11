'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, RefreshCw } from 'lucide-react';
import type { Block, Entry, Page } from '@/data/pages';
import { EntryDetails, EntryIcon } from '@/components/app/EntryPanel';
import { EditorShell } from '@/app/g/[game]/workshop/EditorShell';
import { appChanged } from '@/app/actions';
import { browserClient } from '@/lib/supabase/browser';
import { entriesOf } from '@/lib/fields';
import { apiCandidates, knownWikiHost, searchUrl, wikiOf, type GameWiki, type WikiCheck as Check1 } from '@/lib/wiki';
import { checkEntries, findWiki, forgetGameWiki, useGameWiki, whichOptions } from './ask';

// "Wiki links" for a Block in the Workshop (docs/blocks/wiki-links.md): the game's wiki (moderators
// set it), then every entry checked against it, with the ones that need a builder first: not on
// the wiki, "which one?" pages, and redirects to a page with another name. Checked from the
// builder's browser, on known wiki sites only.

type Group = 'missing' | 'which' | 'elsewhere' | 'linked' | 'off';
const GROUPS: { key: Group; title: string; hint: string }[] = [
  { key: 'which', title: 'Which one?', hint: 'The name lands on a page listing several. Pick the right one, and cards link to it once the Draft ships.' },
  { key: 'missing', title: 'Not on the wiki', hint: 'No page by this name. The wiki may not have one yet, or names it differently.' },
  { key: 'elsewhere', title: 'Goes elsewhere', hint: 'The wiki sends this name on to a page with another name. Usually fine: worth a glance.' },
  { key: 'off', title: 'Turned off', hint: 'A builder chose no wiki link for these.' },
  { key: 'linked', title: 'Linked', hint: 'Found by name. Nothing to do.' },
];

const pill = 'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink';

export function WikiCheck({ gameId, block, mod, onFix, onClose }: {
  gameId: string; block: Block & { page: Page }; mod: boolean;
  /** Open the entry's fix at its wiki part, with a page already picked when there is one. */
  onFix: (entryId: string, wiki?: string) => void;
  onClose: () => void;
}) {
  const loaded = useGameWiki(gameId);
  const [saved, setSaved] = useState<GameWiki | null | undefined>(undefined);
  const wiki = saved !== undefined ? saved : loaded;
  const [checks, setChecks] = useState<Map<string, Check1> | null | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState<Group[]>(['which', 'missing', 'elsewhere']);
  const tint = block.page.tint;
  // A Classes tier's header card isn't a page on the wiki, so it isn't checked.
  const entries = useMemo(() => entriesOf(block), [block]);

  useEffect(() => {
    if (!wiki) return;
    let live = true;
    checkEntries(wiki, entries).then((c) => { if (live) setChecks(c); });
    return () => { live = false; };
  }, [wiki, entries, round]);

  const groups = useMemo(() => {
    const by = new Map<Group, Entry[]>(GROUPS.map((g) => [g.key, []]));
    for (const e of entries) {
      const c = checks?.get(e.id);
      if (c) by.get(c.kind as Group)!.push(e);
    }
    return by;
  }, [checks, entries]);
  const needs = (groups.get('which')?.length ?? 0) + (groups.get('missing')?.length ?? 0);
  const first = GROUPS.flatMap((g) => groups.get(g.key) ?? [])[0];
  const shown = entries.find((e) => e.id === picked) ?? first ?? entries[0];

  const editor = (
    // One column that never grows past the frame, so long names wrap or cut off on phones.
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <GameWikiCard gameId={gameId} wiki={wiki} mod={mod} onSaved={(w) => { setSaved(w); setChecks(undefined); setRound((n) => n + 1); }} />
      {wiki && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm">
              {checks === undefined ? <span className="text-muted">Checking {entries.length} entries on {wiki.name}…</span>
                : checks === null ? <span>Couldn’t reach {wiki.name} just now.</span>
                : needs ? <><span className="font-bold">{needs} of {entries.length}</span> have no wiki link yet.</>
                : <><span className="font-bold">All {entries.length}</span> are linked or turned off.</>}
            </p>
            <button type="button" onClick={() => { setChecks(undefined); setRound((n) => n + 1); }} className={pill}>
              <RefreshCw size={13} aria-hidden="true" /> Check again
            </button>
          </div>
          {checks && GROUPS.map((g) => {
            const list = groups.get(g.key) ?? [];
            if (!list.length) return null;
            const isOpen = open.includes(g.key);
            return (
              <section key={g.key} className="rounded-2xl bg-card p-3 ring-1 ring-line">
                <button type="button" onClick={() => setOpen(isOpen ? open.filter((x) => x !== g.key) : [...open, g.key])} aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 text-left">
                  <h3 className="font-bold">{g.title}</h3>
                  <span className="text-xs text-muted">{list.length}</span>
                  <ChevronDown size={15} className={'ml-auto text-muted transition ' + (isOpen ? '' : '-rotate-90')} aria-hidden="true" />
                </button>
                {isOpen && (
                  <>
                    <p className="mt-0.5 text-xs text-muted">{g.hint}</p>
                    <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1">
                      {list.map((e) => (
                        <Row key={e.id} entry={e} block={block} wiki={wiki} check={checks.get(e.id)!} on={shown?.id === e.id}
                          onPick={() => setPicked(e.id)} onFix={(w) => onFix(e.id, w)} />
                      ))}
                    </ul>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );

  return (
    <EditorShell label={`Wiki links for ${block.title}`} title={`Wiki links: ${block.title}`} onClose={onClose}
      dirty={false} onSaveDraft={onClose} onDiscard={onClose} draftHint="" tint={tint}
      editor={editor}
      preview={shown ? <div className="rounded-2xl bg-card p-3 ring-1 ring-line"><EntryDetails entry={shown} block={block} route="all" routes={[]} color={`var(--${tint})`} /></div>
        : <p className="text-sm text-muted">Nothing in {block.title} yet.</p>} />
  );
}

function Row({ entry, block, wiki, check, on, onPick, onFix }: {
  entry: Entry; block: Block & { page: Page }; wiki: GameWiki; check: Check1; on: boolean;
  onPick: () => void; onFix: (wiki?: string) => void;
}) {
  const [choices, setChoices] = useState<string[] | null | undefined>(null);
  const sub = check.kind === 'linked' ? check.title
    : check.kind === 'elsewhere' ? `“${check.asked}” goes to ${check.title}`
    : check.kind === 'which' ? `“${check.asked}” lists several pages`
    : check.kind === 'off' ? 'No wiki link' : 'Not found';
  const href = check.kind === 'linked' || check.kind === 'elsewhere' ? check.url : searchUrl(wiki, entry.name);
  const showChoices = () => {
    if (check.kind !== 'which') return;
    setChoices(undefined);
    whichOptions(wiki, check.asked).then(setChoices);
  };
  return (
    <li className={'rounded-2xl px-2 py-1.5 ' + (on ? 'bg-card-2' : 'hover:bg-card-2')}>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={onPick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-label={`Show ${entry.name} in the preview`}>
          <EntryIcon entry={entry} block={block} size="sm" color={`var(--${block.page.tint})`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{entry.name}</span>
            <span className="block truncate text-xs text-muted">{sub}</span>
          </span>
        </button>
        <a href={href} target="_blank" rel="noopener noreferrer" className={pill} title={`Opens ${wiki.name} in a new tab`}>
          {check.kind === 'linked' || check.kind === 'elsewhere' ? 'Open' : 'Search'} <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden="true" />
        </a>
        {check.kind === 'which' && choices === null
          ? <button type="button" onClick={showChoices} className={pill}>Choices</button>
          : <button type="button" onClick={() => onFix()} className={pill + ' text-leaf'}>Fix</button>}
      </div>
      {check.kind === 'which' && choices !== null && (
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)] gap-1 pl-10">
          {choices === undefined ? <p className="text-xs text-muted">Reading the list…</p>
            : !choices.length ? <p className="text-xs text-muted">None of the pages it lists exist yet (or the wiki didn’t answer). Use Search, then Fix.</p>
            : (
              <>
                <p className="text-xs text-muted">Pick the page for {entry.name}. It opens a Draft with it filled in.</p>
                <div className="flex flex-wrap gap-1.5">
                  {choices.map((t) => (
                    <button key={t} type="button" onClick={() => onFix(t)} className="rounded-full px-2.5 py-1 text-xs ring-1 ring-line hover:ring-leaf">{t}</button>
                  ))}
                  <button type="button" onClick={() => onFix()} className="rounded-full px-2.5 py-1 text-xs font-bold text-leaf ring-1 ring-line hover:ring-leaf">Another page</button>
                </div>
              </>
            )}
        </div>
      )}
    </li>
  );
}

/** The game's wiki: its name and site for everyone; moderators can change it or turn it off. */
function GameWikiCard({ gameId, wiki, mod, onSaved }: {
  gameId: string; wiki: GameWiki | null | undefined; mod: boolean; onSaved: (w: GameWiki | null) => void;
}) {
  const [changing, setChanging] = useState(false);
  const [pasted, setPasted] = useState('');
  const [found, setFound] = useState<GameWiki | null | undefined>(null);
  const [name, setName] = useState('');
  const [bracket, setBracket] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const host = (w: GameWiki) => new URL(w.api).hostname;

  const find = async () => {
    setProblem(''); setFound(undefined);
    const w = await findWiki(pasted);
    setFound(w);
    if (w) { setName(w.name); setBracket(wiki?.bracket ?? ''); }
    else setProblem(!/^https:\/\//i.test(pasted.trim()) ? 'Paste the full address of any page on the wiki, starting with https://'
      : !apiCandidates(pasted).length ? 'That wiki isn’t supported yet. Village only links to wiki sites it knows; ask in the chat to add it.'
      : 'Couldn’t find the wiki behind that page. Check the address, or try again in a minute.');
  };
  const save = async (w: GameWiki | null) => {
    const checked = w ? wikiOf(w) : null;
    if (w && checked && !knownWikiHost(checked.api)) { setProblem('That wiki isn’t supported yet. Village only links to wiki sites it knows.'); return; }
    if (w && !checked) { setProblem('That doesn’t look right. Check the name (2 to 60 letters) and the bracket word.'); return; }
    const db = browserClient();
    if (!db) return;
    setBusy(true); setProblem('');
    const { data, error } = await db.from('games').update({ wiki: checked }).eq('id', gameId).select('id');
    setBusy(false);
    if (error || !data?.length) { setProblem(error ? 'Couldn’t save it. Check the name and the bracket word, then try again.' : 'Only moderators of this game can change its wiki.'); return; }
    await appChanged(gameId).catch(() => undefined);
    forgetGameWiki(gameId);
    setChanging(false); setPasted(''); setFound(null);
    onSaved(checked);
  };

  return (
    <section className="grid gap-2 rounded-2xl bg-card p-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 font-bold">Game wiki</h3>
        {mod && !changing && <button type="button" onClick={() => setChanging(true)} className={pill}>{wiki ? 'Change' : 'Set it'}</button>}
      </div>
      {wiki === undefined ? <p className="text-sm text-muted">Loading…</p>
        : wiki ? (
          <p className="text-sm">
            <span className="font-bold">{wiki.name}</span> <span className="text-muted">· {host(wiki)}</span>
            {wiki.bracket && <span className="text-muted"> · taken names try “Name ({wiki.bracket})” first</span>}
          </p>
        ) : <p className="text-sm text-muted">No wiki set for this game, so cards show no wiki links.{mod ? '' : ' A moderator sets it.'}</p>}

      {changing && (
        <div className="grid gap-2 border-t border-line pt-2">
          <label className="grid gap-1">
            <span className="text-sm font-bold">Paste any page from the wiki</span>
            <span className="flex gap-2">
              <input value={pasted} onChange={(e) => { setPasted(e.target.value); setFound(null); }} placeholder="https://fireemblemwiki.org/wiki/Marth" className="min-w-0 flex-1 rounded-2xl px-3 py-2" />
              <button type="button" onClick={find} disabled={!pasted.trim() || found === undefined} className={pill + ' py-2'}>Find it</button>
            </span>
          </label>
          {found === undefined && <p className="text-sm text-muted">Asking the wiki…</p>}
          {found && (
            <>
              <p className="flex items-center gap-1 text-sm"><Check size={15} strokeWidth={3} className="text-leaf" aria-hidden="true" /> Found <span className="font-bold">{found.name}</span> <span className="text-muted">· {host(found)}</span></p>
              <label className="grid gap-1">
                <span className="text-sm font-bold">Name on the link’s hover</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="rounded-2xl px-3 py-2" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold">When a name is taken <span className="font-normal text-muted">(optional: the word the wiki adds in brackets for this game)</span></span>
                <input value={bracket} onChange={(e) => setBracket(e.target.value)} maxLength={60} placeholder="Fortune's Weave" className="rounded-2xl px-3 py-2" />
              </label>
            </>
          )}
          {problem && <p className="text-sm font-bold text-berry">{problem}</p>}
          <div className="flex flex-wrap gap-2">
            {found && <button type="button" disabled={busy} onClick={() => save({ ...found, name: name.trim(), ...(bracket.trim() ? { bracket: bracket.trim() } : {}) })} className="btn-primary rounded-full px-4 py-1.5 text-sm font-bold disabled:opacity-60">Save</button>}
            {wiki && <button type="button" disabled={busy} onClick={() => save(null)} className="rounded-full px-3 py-1.5 text-sm font-bold text-berry ring-1 ring-line hover:ring-berry">Turn off</button>}
            <button type="button" onClick={() => { setChanging(false); setProblem(''); setFound(null); }} className="rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:text-ink">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
