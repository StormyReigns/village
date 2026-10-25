'use client';

import Link from 'next/link';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Entry text that helps you along: another entry's name becomes a link to it, and a game
// word like "Renown" can be tapped for a one-sentence explanation (src/data/glossary.ts).

export interface TextLinkData {
  names: { name: string; href: string }[];
  terms: Record<string, string>;
  /** Dates in this game are in-game calendar days. */
  gameDates?: boolean;
}

/** "Ch 9, 9/2–9/8" becomes "Ch 9, in-game 9/2–9/8", so nobody reads it as a real date. */
// Only date ranges ("9/2–9/8") and single dates right after a chapter ("Ch 9, 9/15"), so a
// fraction like "1/2 HP" is left alone.
const markGameDates = (t: string) => t
  .replace(/(?<!in-game )(?<![\d/])(\d{1,2}\/\d{1,2}\s*[–-]\s*\d{1,2}\/\d{1,2})(?![\d/])/g, 'in-game $1')
  .replace(/(Ch \d{1,2}, )(\d{1,2}\/\d{1,2})(?![\d/–-])/g, '$1in-game $2');

const TextLinks = createContext<TextLinkData | null>(null);
export const TextLinksProvider = TextLinks.Provider;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text with names linked and game words explained. `skip` is the entry's own name. */
export function RichText({ text: raw, skip }: { text: string; skip?: string }) {
  const data = useContext(TextLinks);
  const text = data?.gameDates ? markGameDates(raw) : raw;
  const found = useMemo(() => {
    if (!data) return null;
    const names = new Map(data.names.filter((n) => n.name.length >= 4 && n.name !== skip).map((n) => [n.name.toLowerCase(), n.href]));
    const terms = new Map(Object.entries(data.terms).map(([k, v]) => [k.toLowerCase(), v]));
    const all = [...names.keys(), ...terms.keys()].sort((a, b) => b.length - a.length);
    if (!all.length) return null;
    // Whole words only, longest first, so "Giant's Meat" wins over "Meat".
    return { names, terms, re: new RegExp(`(?<![\\p{L}\\p{N}])(${all.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu') };
  }, [data, skip]);
  if (!found) return <>{text}</>;

  const out: React.ReactNode[] = [];
  const used = new Set<string>();
  let at = 0;
  for (const m of text.matchAll(found.re)) {
    const word = m[0], key = word.toLowerCase(), i = m.index ?? 0;
    if (used.has(key)) continue; // once per text is enough
    used.add(key);
    out.push(text.slice(at, i));
    const href = found.names.get(key);
    out.push(href
      ? <Link key={i} href={href} className="font-bold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">{word}</Link>
      : <Term key={i} word={word} explain={found.terms.get(key) ?? ''} />);
    at = i + word.length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

/** A game word with a dotted underline; tap it for a short explanation. */
function Term({ word, explain }: { word: string; explain: string }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    // Slide the bubble left if it would run off the right edge of the screen.
    const left = box.current?.getBoundingClientRect().left ?? 0;
    setShift(Math.min(0, document.documentElement.clientWidth - 12 - (left + 256)));
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span ref={box} className="relative inline-block">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="underline decoration-muted decoration-dotted decoration-2 underline-offset-4 hover:decoration-ink">
        {word}
      </button>
      {open && (
        <span role="note" style={{ '--tint': 'var(--sky)', left: shift } as React.CSSProperties}
          className="tip tip-in absolute top-full z-30 mt-2 block w-64 rounded-2xl px-3 py-2 text-left text-sm font-normal leading-snug">
          <span className="font-bold">{word}: </span>{explain}
        </span>
      )}
    </span>
  );
}
