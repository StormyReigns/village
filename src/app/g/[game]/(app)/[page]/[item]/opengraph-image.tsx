import { getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { resolveItem, shareAnswer } from '@/data/pages/links';
import { OG_SIZE, tintFor, villageCard } from '@/lib/og-card';

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
  const { block, entry } = hit;

  if (entry) {
    // The entry's type goes up top; below it, the answer itself (a guide's steps, or the
    // where-and-what), so people get it without opening the link.
    const type = Object.values(entry.categories)[0];
    const routes = Object.fromEntries((game.paths?.options ?? []).map((o) => [o.key, o.label]));
    const answer = shareAnswer(block, entry, routes);
    const guide = answer.steps.length > 0;
    return villageCard({
      tint: page.tint, kicker: `${game.shortTitle} · ${type ?? block.title}`, title: entry.name, icon: !guide,
      facts: answer.facts, steps: answer.steps, tip: answer.tip,
    });
  }

  const visible = block.entries.filter((e) => !e.spoiler);
  return villageCard({
    tint: page.tint, kicker: `${game.shortTitle} · ${page.title}`, title: block.title,
    rows: visible.map((e) => ({ name: e.name, tint: tintFor(Object.values(e.categories)[0] ?? block.title) })),
    more: block.entries.length - visible.length,
  });
}
