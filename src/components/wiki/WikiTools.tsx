'use client';

import { useState } from 'react';
import { ArrowUpRight, Check, Plus } from 'lucide-react';
import { titleFromUrl } from '@/lib/wiki';
import { useWikiPage, type WikiPage } from './ask';

// The wiki in the Workshop's entry form (docs/blocks/wiki-links.md): "Open on the wiki" by the
// name, the entry's "Wiki page" (what was found, a different page, or no link), and the wiki as a
// ready-made Source. All three check the same way, from the builder's browser.

const link = 'inline-flex items-center gap-0.5 font-bold underline-offset-4 hover:underline';

/** "Fire Emblem Wiki ↗" by the name: the entry's page, or the wiki's search when there isn't one. */
export function WikiOpen({ gameId, name, fix }: { gameId: string; name: string; fix?: string | false }) {
  const page = useWikiPage(gameId, name, fix);
  if (page.state === 'none' || page.state === 'off' || page.state === 'checking' || !name.trim()) return null;
  const found = page.state === 'found';
  return (
    <a href={found ? page.url : page.search} target="_blank" rel="noopener noreferrer"
      title={found ? `Opens ${page.title} on ${page.wiki.name} in a new tab` : `Searches ${page.wiki.name} in a new tab`}
      className={link + ' text-xs text-muted hover:text-ink'}>
      {found ? page.wiki.name : `Search ${page.wiki.name}`} <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden="true" />
    </a>
  );
}

function Status({ page }: { page: WikiPage }) {
  if (page.state === 'none') return null;
  const w = page.wiki.name;
  const open = (href: string, words: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={link + ' text-ink'}>{words} <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden="true" /></a>
  );
  switch (page.state) {
    case 'off': return <p className="text-sm text-muted">No wiki link for this entry.</p>;
    case 'checking': return <p className="text-sm text-muted">Checking {w}…</p>;
    case 'found': return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1"><Check size={15} strokeWidth={3} className="text-leaf" aria-hidden="true" /><span className="font-bold">{page.title}</span></span>
        <span className="text-muted">on {w}</span> · {open(page.url, 'Open')}
      </p>
    );
    case 'which': return (
      <p className="text-sm"><span className="font-bold">“{page.asked}”</span> is a “which one?” page on {w}, so cards show no link. Use a different page to point at the right one. · {open(page.search, 'Search')}</p>
    );
    case 'unreachable': return <p className="text-sm text-muted">Couldn’t reach {w} just now. Cards show the link once it answers. · {open(page.search, 'Search')}</p>;
    default: return <p className="text-sm">Not found on {w}, so cards show no link. · {open(page.search, 'Search the wiki')}</p>;
  }
}

/** The entry's "Wiki page": what Village found from its name, a page named differently, or no link. */
export function WikiPageInput({ gameId, name, value, onChange, inputClass }: {
  gameId: string; name: string;
  /** The entry's fix: a page name, false for no link, or nothing for the usual page. */
  value: string | false | undefined;
  onChange: (v: string | false | undefined) => void;
  inputClass: string;
}) {
  const page = useWikiPage(gameId, name, value);
  const [editing, setEditing] = useState(typeof value === 'string');
  const [text, setText] = useState(typeof value === 'string' ? value : '');
  const [bad, setBad] = useState(false);
  if (page.state === 'none') return null;
  const w = page.wiki;

  const type = (t: string) => {
    setText(t);
    const s = t.trim();
    if (/^https?:\/\//i.test(s)) {
      const title = titleFromUrl(w, s);
      setBad(!title);
      if (title) onChange(title);
      return;
    }
    setBad(false);
    onChange(s || undefined);
  };
  const usual = () => { setEditing(false); setText(''); setBad(false); onChange(undefined); };
  const button = 'rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink';

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-bold">Wiki page <span className="font-normal text-muted">(the “{w.name} ↗” link on its card)</span></span>
      <Status page={page} />
      {editing && value !== false && (
        <>
          <input value={text} onChange={(e) => type(e.target.value)} maxLength={300} autoFocus
            placeholder={`A page name, or paste its address from ${w.name}`} aria-invalid={bad} className={inputClass} />
          {bad && <p className="text-sm font-bold text-berry">That’s not a {w.name} page. Paste an address from {new URL(w.article.replace('$1', '')).host}, or type the page’s name.</p>}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {value === false ? (
          <button type="button" onClick={usual} className={button}>Link it again</button>
        ) : (
          <>
            {editing ? <button type="button" onClick={usual} className={button}>Use the usual page</button>
              : <button type="button" onClick={() => setEditing(true)} className={button}>Use a different page</button>}
            <button type="button" onClick={() => { setEditing(false); setBad(false); onChange(false); }} className={button}>No wiki link</button>
          </>
        )}
      </div>
    </div>
  );
}

/** A chip under "Where can others check this?": the entry's wiki page as the Source, in one tap. */
export function WikiSourceChip({ gameId, name, fix, source, onPick }: {
  gameId: string; name: string; fix?: string | false; source: string; onPick: (s: string) => void;
}) {
  const page = useWikiPage(gameId, name, fix);
  if (page.state !== 'found') return null;
  const words = `${page.wiki.name}: ${page.url}`;
  const used = source.includes(page.url);
  return (
    <button type="button" onClick={() => onPick(source.trim() && !used ? `${source.trim()}; ${words}` : words)} disabled={used}
      className="inline-flex max-w-full items-center gap-1.5 justify-self-start rounded-full px-3 py-1 text-sm ring-1 ring-line hover:ring-ink disabled:opacity-60">
      {used ? <Check size={14} strokeWidth={3} className="shrink-0 text-leaf" aria-hidden="true" /> : <Plus size={14} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />}
      <span className="truncate"><span className="font-bold">{page.wiki.name}:</span> {page.title}</span>
    </button>
  );
}
