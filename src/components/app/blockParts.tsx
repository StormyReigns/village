'use client';

// Pieces every Block uses: what it gets from its page, which entries the player can see,
// the note about hidden ones, the details panel, and filter chips. Kept apart from
// Blocks.tsx so Blocks that live in their own files (Characters) can use them too.

import { useEffect, useMemo } from 'react';
import type { Block, Entry, Page, Route, Tint } from '@/data/pages';
import { sharePath, type Mention } from '@/data/pages/links';
import { EntryPanel, type RouteOption } from './EntryPanel';
import { onRoute, rememberEntry, useOpenEntry } from './entries';
import { clearKey } from './MapBlock';
import { TINT } from './tint';

/** What every Block needs from the page around it. */
export interface BlockContext {
  gameId: string;
  page: Page;
  pageTitle: string;
  tint: Tint;
  route: Route | 'all';
  routes: RouteOption[];
  spoilers: boolean;
  /** Reveal spoilers. Inside a Block this means just that Block. */
  onShowSpoilers: () => void;
  /** Reveal spoilers on every Page (the app-wide switch). */
  onShowAllSpoilers?: () => void;
  /** For map Blocks: other entries that mention each region or place (lowercase name). */
  mentions?: Record<string, Mention[]>;
}

/** Entries the player can see: on their route, and no spoilers unless they asked. */
export function useVisible(block: Block, ctx: BlockContext) {
  return useMemo(() => {
    const routed = block.byRoute ? block.entries.filter((e) => onRoute(e, ctx.route)) : block.entries;
    const shown = ctx.spoilers ? routed : routed.filter((e) => !e.spoiler);
    return { shown, offRoute: block.entries.length - routed.length, spoilers: routed.length - shown.length };
  }, [block, ctx.route, ctx.spoilers]);
}

export function HiddenNote({ offRoute, spoilers, ctx }: { offRoute: number; spoilers: number; ctx: BlockContext }) {
  if (!offRoute && !spoilers) return null;
  const lord = ctx.routes.find((r) => r.key === ctx.route)?.label;
  return (
    <p className="mt-3 text-sm text-muted">
      {offRoute > 0 && <>{offRoute} more on other routes than {lord}&apos;s. </>}
      {spoilers > 0 && (
        <>
          {spoilers} hidden as spoilers. <button onClick={ctx.onShowSpoilers} className="font-bold text-leaf underline underline-offset-2">Show them</button>
          {ctx.onShowAllSpoilers && <> · <button onClick={ctx.onShowAllSpoilers} className="font-bold text-muted underline underline-offset-2 hover:text-ink">Show spoilers everywhere</button></>}
        </>
      )}
    </p>
  );
}

/** The details panel for whichever of this Block's entries is open. */
export function OpenPanel({ block, list, ctx }: { block: Block; list: Entry[]; ctx: BlockContext }) {
  const { open, set, close } = useOpenEntry();
  const [blockId, entryId] = open?.split('.') ?? [];
  const entry = blockId === block.id ? block.entries.find((e) => e.id === entryId) : undefined;

  useEffect(() => {
    if (entry) rememberEntry(ctx.gameId, { href: `${window.location.pathname}?e=${block.id}.${entry.id}`, name: entry.name, where: `${ctx.pageTitle} · ${block.title}` });
  }, [entry, block, ctx.gameId, ctx.pageTitle]);

  if (!entry) return null;
  return (
    <EntryPanel entry={entry} block={block} list={list} route={ctx.route} routes={ctx.routes} gameId={ctx.gameId} sharePath={sharePath(ctx.gameId, ctx.page, block, entry)} color={`var(--${ctx.tint})`}
      place={block.look === 'map' ? { clearKey: clearKey(block, entry), here: ctx.mentions?.[entry.name.toLowerCase()] ?? [] } : undefined}
      onGo={(e) => set(`${block.id}.${e.id}`, 'replace')} onClose={close} />
  );
}

export function FilterChip({ on, tint, onClick, children }: { on: boolean; tint: Tint; onClick: () => void; children: React.ReactNode }) {
  const t = TINT[tint];
  return (
    <button onClick={onClick} aria-pressed={on}
      className={'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (on ? `${t.solid} ${t.ring} text-white` : 'bg-card ring-line hover:ring-ink')}>
      {children}
    </button>
  );
}

