'use server';

import type { Block, Entry, Tint } from '@/data/pages';
import { getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { classKin, type Kin } from '@/lib/class-fit';
import { blockLinks, withLinkMentions, type BlockLinks } from '@/lib/entry-links';
import { mapMentions, resolveItem, sharePath, type Mention } from '@/data/pages/links';

/** An entry from another Page, with what its pop-up needs to show it as it shows there. */
export interface Peeked {
  page: { id: string; title: string; tint: Tint };
  block: Block;
  entry: Entry;
  sharePath: string;
  /** Its Block's links and other sides (only that Block's, to keep the answer small). */
  links: BlockLinks;
  kin: Kin[];
  /** A map place: what else mentions it. */
  here?: Mention[];
}

const ID = /^[a-z0-9-]{1,80}$/;

/**
 * Looks up one entry anywhere in a game, so a link inside a pop-up can open it in a pop-up on
 * top, without leaving the Page (src/components/app/Peek.tsx). Reads the same cached app data
 * the Pages use; returns null for anything that isn't an entry.
 */
export async function peekEntry(gameId: string, pageId: string, item: string): Promise<Peeked | null> {
  if (!ID.test(gameId) || !ID.test(pageId) || item.length > 200) return null;
  const game = getGame(gameId);
  if (!game) return null;
  const pages = await getApp(gameId);
  const page = pages.find((p) => p.id === pageId);
  const hit = page ? resolveItem(page, item) : null;
  if (!page || !hit?.entry) return null;
  const all = blockLinks(pages, page, (p, b, e) => sharePath(gameId, p, b, e));
  const id = hit.block.id;
  const targetIds = new Set((hit.block.fields ?? []).map((f) => f.to).filter(Boolean) as string[]);
  const links: BlockLinks = {
    targets: Object.fromEntries(Object.entries(all.targets).filter(([k]) => targetIds.has(k) || k === id)),
    incoming: { [id]: all.incoming[id] ?? [] },
  };
  const here = hit.block.look === 'map'
    ? withLinkMentions(mapMentions(gameId, pages, page), all, page)[hit.entry.name.toLowerCase()] ?? []
    : undefined;
  return {
    page: { id: page.id, title: page.title, tint: page.tint },
    block: hit.block,
    entry: hit.entry,
    sharePath: sharePath(gameId, page, hit.block, hit.entry),
    links,
    kin: classKin(gameId, pages, page).filter((k) => k.forBlock === id),
    ...(here ? { here } : {}),
  };
}
