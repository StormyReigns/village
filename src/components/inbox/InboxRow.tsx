'use client';

import Link from 'next/link';
import { AtSign, Award, CircleCheck, CircleHelp, CircleX, Layers, Leaf, Megaphone, MessageCircle, Users, type LucideIcon } from 'lucide-react';
import { ago, describe, type Icon, type InboxContext, type InboxItem, type Plain } from '@/lib/inbox';

const ICONS: Record<Icon, { icon: LucideIcon; tint: string }> = {
  question: { icon: CircleHelp, tint: 'sky' },
  mention: { icon: AtSign, tint: 'plum' },
  reply: { icon: MessageCircle, tint: 'plum' },
  shipped: { icon: CircleCheck, tint: 'leaf' },
  declined: { icon: CircleX, tint: 'berry' },
  batch: { icon: Layers, tint: 'teal' },
  community: { icon: Users, tint: 'teal' },
  title: { icon: Award, tint: 'sun' },
  badge: { icon: Leaf, tint: 'leaf' },
  news: { icon: Megaphone, tint: 'slate' },
};

/**
 * One inbox item: an icon for its kind, what happened, a line of detail, and when, with a link to
 * where it happened. `fresh` gives it the light yellow of something new. `game` names the game,
 * on the inbox page where items from every game sit together. `actions` sit at the right.
 */
export function InboxRow({ item, ctx, plain, fresh, game, onOpen, actions }: {
  item: InboxItem; ctx: InboxContext; plain: Plain; fresh?: boolean; game?: boolean;
  onOpen?: () => void; actions?: React.ReactNode;
}) {
  const d = describe(item, ctx, plain);
  const { icon: Glyph, tint } = ICONS[d.icon];
  const gameName = game && item.gameId ? ctx.games.get(item.gameId) : undefined;
  return (
    <li className={'group flex gap-3 rounded-xl px-2.5 py-2.5 ' + (fresh ? 'bg-sun-soft' : '')}>
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full" style={{ background: `var(--${tint}-soft)`, color: `var(--${tint})` }}>
        <Glyph size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold leading-snug">{d.title}</span>
        {d.body && <span className={'mt-0.5 block line-clamp-3 break-words ' + (d.quote ? 'border-l-2 border-line pl-2 text-ink/80' : '')}>{d.body}</span>}
        <span className="mt-1 block text-xs text-muted">
          {ago(item.createdAt)}
          {gameName && <> · {gameName}</>}
          {d.href && <> · <Link href={d.href} onClick={onOpen} className="font-bold text-ink underline">{d.link ?? 'open'}</Link></>}
        </span>
      </span>
      {actions}
    </li>
  );
}
