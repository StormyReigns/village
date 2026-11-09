'use client';

import { useEffect, useState } from 'react';
import { GAMES } from '@/data/games';

/** "/g/fortunes-weave/units-and-classes" → "Fortune's Weave · Units and classes". */
function label(path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return 'Village square';
  if (parts[0] !== 'g') return parts.map(words).join(' · ');
  const game = GAMES.find((g) => g.id === parts[1])?.shortTitle ?? words(parts[1] ?? '');
  const rest = parts.slice(2).map(words);
  return [game, ...(rest.length ? rest : ['App home'])].join(' · ');
}
const words = (slug: string) => { const s = decodeURIComponent(slug).replace(/[-.]/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };

/** The pages the service worker has kept, newest first, as links that open without a connection. */
export function SavedPages() {
  const [paths, setPaths] = useState<string[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const names = (await caches.keys()).filter((k) => k.startsWith('village-pages-'));
        const seen = new Set<string>();
        for (const n of names) {
          for (const req of [...(await (await caches.open(n)).keys())].reverse()) {
            const u = new URL(req.url);
            if (u.pathname !== '/offline' && !u.pathname.startsWith('/icons/')) seen.add(u.pathname + u.search);
          }
        }
        setPaths([...seen].slice(0, 30));
      } catch { setPaths([]); }
    })();
  }, []);
  if (!paths?.length) return null;
  return (
    <section className="surface rounded-2xl p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Saved on this phone</h2>
      <ul className="mt-2 grid gap-1">
        {paths.map((p) => (
          <li key={p}>
            {/* A plain link, so the browser asks the service worker for the kept copy. */}
            <a href={p} className="block rounded-xl px-2 py-1.5 font-bold hover:bg-card-2">{label(p.split('?')[0])}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
