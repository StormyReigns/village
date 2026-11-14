'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WorkshopLink } from '@/components/PageLinks';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Hammer } from 'lucide-react';
import type { Tint } from '@/data/pages';
import { NavSymbol } from '@/components/Icon';
import { TINT } from './tint';
import { Piece } from '@/components/Piece';
import { ScrollRow } from '@/components/ScrollRow';
import { initials } from './entries';

export interface NavPage { id: string; title: string; short: string; icon: string; tint: Tint; count: number }
export interface NavGame { id: string; shortTitle: string; cover?: string }

/** The game's badge: an ink piece with its initials, or its cover cut to the piece. */
function GameMark({ game }: { game: NavGame }) {
  return <Piece size={44} color="var(--ink)" image={game.cover}>{game.cover ? null : initials(game.shortTitle)}</Piece>;
}

// Slides a tab to the middle of its row. The same sum runs as a tiny script in the server's
// HTML, so the tab is already in the middle before the app has started. The bar can arrive
// a moment after the rest of the page, parked in a hidden holder until it's put in place; the
// script waits for that (checking once a frame, just before the screen is drawn), so the bar
// is never drawn at the start and then moved.
const CENTRE_JS = "(function(){var r=document.currentScript.parentNode.querySelector('.chip-strip'),n=0;(function f(){if(!r)return;if(r.closest('[hidden]')){if(n++<600)requestAnimationFrame(f);return}var e=r.querySelector('[aria-current=page]');if(e){var a=r.getBoundingClientRect(),b=e.getBoundingClientRect();r.scrollLeft+=b.left-a.left-(r.clientWidth-b.width)/2}})()})()";
function centre(r: HTMLElement, e: HTMLElement, smooth: boolean) {
  const a = r.getBoundingClientRect(), b = e.getBoundingClientRect();
  r.scrollTo({ left: r.scrollLeft + b.left - a.left - (r.clientWidth - b.width) / 2, behavior: smooth ? 'smooth' : 'instant' });
}
const noChange = () => () => {};

/**
 * The game app's navigation: a sidebar on computers, a bottom tab bar on phones. The ink
 * top bar (in the app's layout) carries the game's name, the Workshop and your account.
 */
export function AppNav({ game, pages }: { game: NavGame; pages: NavPage[] }) {
  const path = usePathname() || '';
  const home = `/g/${game.id}`;
  const current = pages.find((p) => path.startsWith(`${home}/${p.id}`));

  // Phones: the tab you tap lights up and slides to the middle at once, before its Page has
  // loaded. That counts only until the address changes; after that the address decides.
  const [aim, setAim] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setAim(null); }
  const on = aim ?? current?.id ?? '';
  const bar = useRef<HTMLElement>(null);
  const row = () => bar.current?.querySelector<HTMLElement>('.chip-strip') ?? null;
  const tapped = useRef<string | null>(null);
  const tap = (id: string) => {
    setAim(id);
    tapped.current = id;
    const r = row(), el = r?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(id)}"]`);
    if (r && el) centre(r, el, true);
  };
  // When the bar first shows: straight to the middle, no slide. After that, a smooth slide
  // whenever the Page changes some other way (the back button, a link inside a Page). A tab
  // that was tapped is already sliding, so it's left to finish rather than started again.
  const shown = useRef(false);
  useLayoutEffect(() => {
    const r = row(), el = r?.querySelector<HTMLElement>('[aria-current="page"]');
    const slid = tapped.current !== null && tapped.current === el?.closest('li')?.dataset.tab;
    tapped.current = null;
    if (r && el && !slid) centre(r, el, shown.current);
    shown.current = true;
  }, [path]);
  // True only while the server's HTML is what's on screen (and while the app takes it over).
  const firstPaint = useSyncExternalStore(noChange, () => false, () => true);

  return (
    <>
      {/* Computers: sidebar */}
      <aside className="hidden lg:col-start-1 lg:row-start-1 lg:block">
        <div className="sticky top-20 grid gap-4">
          <Link href={home} className={'flex items-center gap-3 rounded-2xl p-2 hover:bg-card ' + (!current ? 'bg-card ring-1 ring-line' : '')}>
            <GameMark game={game} />
            <span className="min-w-0">
              <span className="block truncate font-display text-lg leading-tight">{game.shortTitle}</span>
              <span className="block text-xs font-bold text-muted">App home</span>
            </span>
          </Link>
          <nav aria-label="Pages" className="grid gap-1">
            {pages.map((p) => {
              const on = p.id === current?.id;
              const t = TINT[p.tint];
              return (
                <Link key={p.id} href={`${home}/${p.id}`} aria-current={on ? 'page' : undefined}
                  className={'flex items-center gap-3 rounded-2xl px-2 py-1.5 transition ' + (on ? `${t.soft} font-extrabold` : 'font-bold hover:bg-card-2')}>
                  <NavSymbol name={p.icon} color={`var(--${p.tint})`} on={on} />
                  <span className="min-w-0 flex-1 truncate text-ink">{p.title}</span>
                  <span className="text-xs text-muted">{p.count}</span>
                </Link>
              );
            })}
          </nav>
          <div className="grid gap-1 px-2 text-sm font-bold">
            <WorkshopLink gameId={game.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-muted hover:bg-card hover:text-ink">
              <Hammer size={16} className="text-leaf" aria-hidden="true" /> Workshop
            </WorkshopLink>
            <Link href="/" className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-muted hover:bg-card hover:text-ink">
              <ArrowLeft size={16} aria-hidden="true" /> Village square
            </Link>
          </div>
        </div>
      </aside>

      {/* Phones: one row of every Page that scrolls sideways, the current one slid to the middle. */}
      <nav ref={bar} aria-label="Pages" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ScrollRow as="ul" className="flex snap-x snap-proximity pt-1.5 pointer-fine:snap-none">
          <TabLink id="" href={home} on={on === ''} label="Home" icon="House" color="var(--ink)" onTap={tap} />
          {pages.map((p) => (
            <TabLink key={p.id} id={p.id} href={`${home}/${p.id}`} on={on === p.id} label={p.short} icon={p.icon} color={`var(--${p.tint})`} onTap={tap} />
          ))}
        </ScrollRow>
        {firstPaint && <script dangerouslySetInnerHTML={{ __html: CENTRE_JS }} />}
      </nav>
    </>
  );
}

/**
 * A tab on phones: the Page's symbol in gray, or in a piece of its color when you're on it.
 * About five fit across a phone, with a sixth peeking in to show the row goes on. When every
 * tab fits (a tablet, say), the row sits in the middle and doesn't scroll.
 */
function TabLink({ id, href, on, label, icon, color, onTap }: {
  id: string; href: string; on: boolean; label: string; icon: string; color: string; onTap: (id: string) => void;
}) {
  return (
    <li data-tab={id} className="w-[clamp(3.75rem,calc((100vw_-_1rem)/5.5),5.5rem)] shrink-0 snap-center first:ml-auto last:mr-auto">
      <Link href={href} onClick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey) onTap(id); }} aria-current={on ? 'page' : undefined}
        className={'flex flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1 text-center text-xs font-bold leading-tight ' + (on ? 'text-ink' : 'text-muted')}>
        <NavSymbol name={icon} color={on ? color : 'var(--muted)'} on={on} size={44} />
        <span className="w-full truncate">{label}</span>
      </Link>
    </li>
  );
}
