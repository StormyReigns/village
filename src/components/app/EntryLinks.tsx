'use client';

import { createContext, useContext } from 'react';
import Link from 'next/link';
import type { Route } from '@/data/pages';
import type { BlockLinks, LinkRow } from '@/lib/entry-links';
import { Piece } from '@/components/Piece';
import { amountText } from '@/lib/fields';
import { initials } from './entries';

// Links across Blocks (docs/blocks/entry-links.md): what a Page's cards know about the Blocks their
// links point at, and the other sides they show from Blocks elsewhere. Built on the server by
// blockLinks in src/lib/entry-links.ts and handed down here, like the units-and-classes kin.
// Without a provider (Workshop previews, samples), links to other Blocks show as plain names.

const LinksContext = createContext<BlockLinks>({ targets: {}, incoming: {} });

export function LinksProvider({ links, children }: { links?: BlockLinks; children: React.ReactNode }) {
  return <LinksContext.Provider value={links ?? { targets: {}, incoming: {} }}>{children}</LinksContext.Provider>;
}

export const useBlockLinks = () => useContext(LinksContext);

/** Whether an entry of another Block is on the player's route (no routes: every one). */
export const onRoute = (r: Pick<LinkRow, 'routes'>, route: Route | 'all') => route === 'all' || !r.routes?.length || r.routes.includes(route);

/** One linked entry: a small piece in its Page's color, its name and note, opening it when it's known. */
export function LinkChip({ name, note, row, color, amounts = false }: { name: string; note: string; row?: LinkRow; color: string; amounts?: boolean }) {
  const text = amounts ? amountText(note) : note;
  const inner = (
    <>
      <Piece size={34} color={color} image={row?.icon}>{row?.icon ? null : initials(name)}</Piece>
      <span className="grid text-left leading-tight"><span className="text-sm font-bold">{name}</span>{text && <span className="text-xs text-muted">{text}</span>}</span>
    </>
  );
  return row ? <Link href={row.href} className="flex items-center gap-2 rounded-xl hover:bg-card-2">{inner}</Link>
    : <span className="flex items-center gap-2">{inner}</span>;
}
