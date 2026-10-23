import { getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { resolveItem, summarize } from '@/data/pages/links';
import { OG_SIZE, villageCard } from '@/lib/og-card';

// The preview picture for a shared Block or entry.
export const alt = 'A Village card for this Block or entry';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ game: string; page: string; item: string }> }) {
  const { game: gameId, page: pageId, item } = await params;
  const game = getGame(gameId);
  const page = (await getApp(gameId)).find((p) => p.id === pageId);
  const hit = page ? resolveItem(page, item) : null;
  if (!game || !page || !hit) return villageCard({ tint: 'leaf', kicker: 'Village', title: 'Not found' });
  const routes = Object.fromEntries((game.paths?.options ?? []).map((o) => [o.key, o.label]));
  const { block, entry } = hit;
  return entry
    ? villageCard({
        tint: page.tint, kicker: `${game.shortTitle} · ${block.title}`, title: entry.name,
        line: entry.spoiler ? undefined : entry.description, facts: summarize(block, entry, routes),
      })
    : villageCard({
        tint: page.tint, kicker: `${game.shortTitle} · ${page.title}`, title: block.title,
        line: block.intro ?? `${block.entries.length} entries`, chips: block.entries.map((e) => (e.spoiler ? 'Spoiler' : e.name)),
      });
}
