'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import type { WikiAnswer } from '@/lib/wiki';

// The small "Fire Emblem Wiki ↗" at the end of an entry's card (docs/blocks/wiki-links.md).
// It shows only once our server has checked the page is really on the wiki; until then, and for
// entries with no page, nothing shows.

/** One question per entry per visit, shared by every card showing it. */
const asked = new Map<string, Promise<WikiAnswer | null>>();

function askOnce(game: string, cardId: string): Promise<WikiAnswer | null> {
  const key = `${game}/${cardId}`;
  let p = asked.get(key);
  if (!p) {
    p = fetch(`/api/wiki/${encodeURIComponent(game)}/${encodeURIComponent(cardId)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as WikiAnswer) : null))
      .catch(() => null);
    // The wiki couldn't be reached: ask again next time.
    p.then((a) => { if (!a) asked.delete(key); });
    asked.set(key, p);
  }
  return p;
}

export function WikiLink({ cardId, sample = false, color = 'var(--ink)', className = '' }: {
  /** The entry's card id; previews of unsent Drafts have none, so no link. */
  cardId?: string;
  /** The builders' made-up sample: a gray "Wiki" where the link would be. */
  sample?: boolean;
  color?: string;
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
        className="inline-flex items-center gap-0.5 rounded-full text-sm font-bold text-ink underline-offset-4 hover:underline">
        {/* Ink words (a yellow Page's color would be hard to read); the arrow takes the Page color. */}
        {a.name} <ArrowUpRight size={15} strokeWidth={2.75} aria-hidden="true" style={{ color }} />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
