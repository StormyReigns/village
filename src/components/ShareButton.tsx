'use client';

import { useEffect, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { Tip } from './Tip';

/**
 * A small share button. On phones it opens the phone's own share menu (Discord,
 * Messages...); on computers it copies the link and says so. The link opens straight
 * to the Block or entry, and shows a preview card where it's pasted.
 */
export function ShareButton({ path, title, what, tint = 'ink', className = '', quiet = false }: {
  path: string; title: string; what: string; tint?: string; className?: string;
  /** For lists of cards: small and borderless, and on computers it shows when you point at the card. */
  quiet?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = window.location.origin + path;
    const phone = window.matchMedia('(pointer: coarse)').matches;
    if (phone && navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* closed the share menu */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <Tip text={copied ? 'Link copied. Paste it in Discord or anywhere' : `Share this ${what}. It shows a preview card where you paste it`} tint={tint} className={'relative shrink-0 ' + className}>
      <button type="button" onClick={share} aria-label={`Share ${title}`}
        className={(quiet ? 'grid size-7 place-items-center rounded-full transition [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 ' : 'grid size-8 place-items-center rounded-full ring-1 transition ') + (copied ? 'bg-leaf text-white ring-leaf opacity-100' : quiet ? 'text-muted/70 hover:text-ink' : 'text-muted ring-line hover:text-ink hover:ring-ink')}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
      </button>
      {copied && <span role="status" className="sr-only">Link copied</span>}
    </Tip>
  );
}
