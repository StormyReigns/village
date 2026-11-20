'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Inbox as InboxIcon } from 'lucide-react';
import { useInbox } from './inbox/useInbox';
import { InboxRow } from './inbox/InboxRow';

// Your inbox: news written for you by the database (docs/inbox.md, src/lib/inbox.ts), shown
// behind a bell in the top bar with a dot while anything is unread. The bell is the quick look;
// "See all" opens the inbox page (/inbox) with older news and filters.

/** The bell and its list. Signed-out visitors don't have an inbox, so they see nothing. */
export function InboxBell({ dark = false }: { dark?: boolean }) {
  const { me, items, ctx, plain, markAllRead } = useInbox(20);
  const [open, setOpen] = useState(false);
  // Unread when the list was opened, so they stay marked while you read them.
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const onInboxPage = usePathname() === '/inbox';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);

  if (!me || !items) return null;
  const unread = items.filter((x) => !x.readAt);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // Opening the list reads it: the dot goes, and what was new stays marked until it closes.
    const was = await markAllRead();
    if (was.length) setFresh(new Set(was));
  };

  return (
    <div ref={box} className="relative">
      <button onClick={toggle} aria-expanded={open} aria-label={unread.length ? `Inbox, ${unread.length} new` : 'Inbox'}
        className={'relative -my-1 grid size-11 shrink-0 place-items-center rounded-full ' + (dark ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-card-2 hover:text-ink') + (onInboxPage ? (dark ? ' bg-white/10' : ' bg-card-2') : '')}>
        <Bell size={18} aria-hidden="true" />
        {unread.length > 0 && (
          <span aria-hidden="true" className={'absolute right-2.5 top-2.5 size-2.5 rounded-full bg-signal ring-2 ' + (dark ? 'ring-ink' : 'ring-card')} />
        )}
      </button>
      {open && (
        <div className="surface pop absolute right-0 top-full z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-2 text-sm text-ink">
          <p className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-xs font-bold uppercase tracking-wide text-muted">
            <InboxIcon size={13} aria-hidden="true" /> Inbox
            <Link href="/inbox" onClick={() => setOpen(false)} className="ml-auto rounded-full px-2 py-1 normal-case tracking-normal text-ink underline hover:bg-card-2">See all</Link>
          </p>
          {items.length === 0 ? (
            <p className="px-2 pb-2 text-muted">Nothing yet. Replies to your Drafts and questions, @mentions, and your new titles and badges come here.</p>
          ) : (
            <ul className="grid max-h-[60vh] gap-0.5 overflow-y-auto">
              {items.slice(0, 12).map((item) => (
                <InboxRow key={item.id} item={item} ctx={ctx} plain={plain} fresh={fresh.has(item.id)} onOpen={() => setOpen(false)} />
              ))}
            </ul>
          )}
          {items.length > 12 && (
            <Link href="/inbox" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-2 py-2 text-center font-bold hover:bg-card-2">
              See everything in your inbox
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
