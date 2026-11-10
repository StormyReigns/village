'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import type { WikiAnswer } from '@/lib/wiki';
import { askFromBrowser } from './ask';

// The small blue "Wiki ↗" right under an entry's name (docs/blocks/wiki-links.md).
// It shows only once the page is checked to be really on the wiki; until then, and for entries
// with no page, nothing shows. Our server checks; when the wiki turns our server away, the
// player's browser asks the same wiki the same names, and remembers the answer for a day.

/** One question per entry per visit, shared by every card showing it. */
const asked = new Map<string, Promise<WikiAnswer | null>>();

function askOnce(game: string, cardId: string): Promise<WikiAnswer | null> {
  const key = `${game}/${cardId}`;
  let p = asked.get(key);
  if (!p) {
    p = fetch(`/api/wiki/${encodeURIComponent(game)}/${encodeURIComponent(cardId)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as WikiAnswer) : null))
      .then((a) => (a && !a.ok && a.reason === 'ask' ? askFromBrowser(a.ask) : a))
      .catch(() => null);
    // The wiki couldn't be reached: ask again next time.
    p.then((a) => { if (!a) asked.delete(key); });
    asked.set(key, p);
  }
  return p;
}

export function WikiLink({ cardId, sample = false, className = '' }: {
  /** The entry's card id; previews of unsent Drafts have none, so no link. */
  cardId?: string;
  /** The builders' made-up sample: a gray "Wiki" where the link would be. */
  sample?: boolean;
  className?: string;
}) {
  const params = useParams<{ game?: string }>();
  const game = params?.game;
  const [answer, setAnswer] = useState<{ key: string; a: WikiAnswer | null } | null>(null);
  const key = game && cardId ? `${game}/${cardId}` : '';

  useEffect(() => {
    if (!key || !game || !cardId) return;
    let live = true;
    askOnce(game, cardId).then((a) => { if (live) setAnswer({ key, a }); });
    return () => { live = false; };
  }, [key, game, cardId]);

  if (sample) {
    return (
      <p className={'flex ' + className}>
        <span className="inline-flex items-center gap-0.5 text-sm font-bold text-muted">Wiki <ArrowUpRight size={14} strokeWidth={2.5} aria-hidden="true" /></span>
      </p>
    );
  }
  const a = answer?.key === key ? answer.a : null;
  if (!a?.ok) return null;
  return (
    <p className={'flex ' + className}>
      <a href={a.url} target="_blank" rel="noopener noreferrer"
        title={`Opens ${a.name} in a new tab. Wikis often have spoilers.`}
        className="inline-flex items-center gap-0.5 text-sm font-bold text-sky underline decoration-sky/40 underline-offset-[3px] hover:decoration-sky">
        {/* Blue and underlined, so it reads plainly as a link out (Matt, 2026-11-10). */}
        {/* Just "Wiki" (Matt, 2026-11-10); which wiki is in the hover text and for screen readers. */}
        Wiki<span className="sr-only"> page on {a.name} (opens in a new tab)</span> <ArrowUpRight size={15} strokeWidth={2.75} aria-hidden="true" />
      </a>
    </p>
  );
}
