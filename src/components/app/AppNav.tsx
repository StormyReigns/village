'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WorkshopLink } from '@/components/PageLinks';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Hammer } from 'lucide-react';
import type { Tint } from '@/data/pages';
import { NavSymbol } from '@/components/Icon';
import { TINT } from './tint';
import { Piece } from '@/components/Piece';
import { initials } from './entries';

export interface NavPage { id: string; title: string; short: string; icon: string; tint: Tint; count: number }
export interface NavGame { id: string; shortTitle: string; cover?: string }

/** The game's badge: an ink piece with its initials, or its cover cut to the piece. */
function GameMark({ game }: { game: NavGame }) {
  return <Piece size={44} color="var(--ink)" image={game.cover}>{game.cover ? null : initials(game.shortTitle)}</Piece>;
}

/**
 * The game app's navigation: a sidebar on computers, a bottom tab bar on phones. The ink
 * top bar (in the app's layout) carries the game's name, the Workshop and your account.
 */
export function AppNav({ game, pages }: { game: NavGame; pages: NavPage[] }) {
  const path = usePathname() || '';
  const home = `/g/${game.id}`;
  const current = pages.find((p) => path.startsWith(`${home}/${p.id}`));

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

      <TabBar home={home} pages={pages} path={path} current={current?.id ?? ''} />
    </>
  );
}

// The row loops: it's laid out COPIES times over and you swipe through the middle copy.
// Whenever it comes to rest, the view hops back to the matching spot in the middle copy;
// every copy looks the same, so the hop can't be seen. Three copies each side is more than
// one fling can cross.
const COPIES = 7, MID = 3;
// The widest a tab gets (5.5rem), and the bar's padding at the sides: with these, the width
// at which every tab fits on screen is known in advance (and then the row doesn't loop).
const TAB_MAX = 88, SIDES = 16;
const TAB_WIDTH = 'w-[clamp(3.75rem,calc((100vw_-_1rem)/5.5),5.5rem)]';

// Slides the current tab to the middle of the row. This runs as a tiny script in the server's
// HTML, so the tab is already in the middle before the app has started. The bar can arrive a
// moment after the rest of the page, parked in a hidden holder until it's put in place; the
// script waits for that (checking once a frame, just before the screen is drawn), so the bar
// is never drawn in one place and then moved.
const CENTRE_JS = "(function(){var r=document.currentScript.parentNode.querySelector('.app-tabs'),n=0;(function f(){if(!r)return;if(r.closest('[hidden]')){if(n++<600)requestAnimationFrame(f);return}var e=r.querySelector('[aria-current=page]');if(e){var a=r.getBoundingClientRect(),b=e.getBoundingClientRect();r.scrollLeft+=b.left-a.left-(r.clientWidth-b.width)/2}})()})()";
function centre(r: HTMLElement, e: HTMLElement, smooth: boolean) {
  const a = r.getBoundingClientRect(), b = e.getBoundingClientRect();
  r.scrollTo({ left: r.scrollLeft + b.left - a.left - (r.clientWidth - b.width) / 2, behavior: smooth ? 'smooth' : 'instant' });
}
/** Of a tab's copies on screen, the one nearest the middle of the row (the shortest slide). */
function nearest(r: HTMLElement, id: string) {
  const mid = r.getBoundingClientRect().left + r.clientWidth / 2;
  let best: HTMLElement | null = null, gap = Infinity;
  for (const el of r.querySelectorAll<HTMLElement>(`[data-tab="${CSS.escape(id)}"]`)) {
    if (!el.offsetWidth) continue;
    const b = el.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid);
    if (d < gap) { gap = d; best = el; }
  }
  return best;
}
const noChange = () => () => {};

interface Tab { id: string; href: string; label: string; icon: string; color: string }

/**
 * Phones: Home and every Page in one row that you swipe sideways, round and round, with the
 * current Page slid to the middle. About five tabs show on a phone, with the next ones
 * peeking in faded at the edges. When every tab fits (a tablet, say), there's one row, sitting
 * in the middle, that doesn't scroll. It keeps clear of the iPhone's home swipe at the bottom.
 */
function TabBar({ home, pages, path, current }: { home: string; pages: NavPage[]; path: string; current: string }) {
  const tabs: Tab[] = [
    { id: '', href: home, label: 'Home', icon: 'House', color: 'var(--ink)' },
    ...pages.map((p) => ({ id: p.id, href: `${home}/${p.id}`, label: p.short, icon: p.icon, color: `var(--${p.tint})` })),
  ];
  // Five or fewer always fit on a phone.
  const loops = tabs.length > 5;
  const copies = loops ? COPIES : 1, mid = loops ? MID : 0;
  const fitsFrom = tabs.length * TAB_MAX + SIDES;

  // The tab you tap lights up and slides to the middle at once, before its Page has loaded.
  // That counts only until the address changes; after that the address decides.
  const [aim, setAim] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setAim(null); }
  const on = aim ?? current;
  const row = useRef<HTMLUListElement>(null);
  const tapped = useRef<string | null>(null);
  const tap = (id: string, el: HTMLElement) => {
    setAim(id);
    tapped.current = id;
    if (row.current) centre(row.current, el, true);
  };

  // When the bar first shows: straight to the middle, no slide. After that, a smooth slide
  // whenever the Page changes some other way (the back button, a link inside a Page). A tab
  // that was tapped is already sliding, so it's left to finish rather than started again.
  const shown = useRef(false);
  useLayoutEffect(() => {
    const r = row.current;
    const slid = tapped.current === current;
    tapped.current = null;
    const el = !r ? null : shown.current ? nearest(r, current) : r.querySelector<HTMLElement>('[aria-current="page"]');
    if (r && el && !slid) centre(r, el, shown.current);
    shown.current = true;
  }, [current]);

  // When the bar changes width (the phone turned sideways), the current tab goes straight
  // back to the middle.
  useEffect(() => {
    const r = row.current;
    if (!r) return;
    let width = r.clientWidth;
    const seen = new ResizeObserver(() => {
      if (r.clientWidth === width) return;
      width = r.clientWidth;
      const el = r.querySelector<HTMLElement>('[aria-current="page"]');
      if (el) centre(r, el, false);
    });
    seen.observe(r);
    return () => seen.disconnect();
  }, []);

  // The loop's hop back to the middle copy, once the row is at rest: never while a finger is
  // on it, and only once a fling has fully stopped (no movement for a moment, or the browser
  // says scrolling ended). A mouse wheel moves the row sideways.
  useEffect(() => {
    const r = row.current;
    if (!r || !loops) return;
    const n = tabs.length;
    let down = false, timer = 0;
    const hop = () => {
      const first = r.children[0] as HTMLElement | undefined, middle = r.children[n * MID] as HTMLElement | undefined;
      if (down || !first?.offsetWidth || !middle) return; // copies hidden: everything fits
      const set = (middle.getBoundingClientRect().left - first.getBoundingClientRect().left) / MID;
      const at = Math.floor((r.scrollLeft + r.clientWidth / 2) / set);
      if (at !== MID) r.scrollLeft -= (at - MID) * set;
    };
    const settle = () => { clearTimeout(timer); timer = window.setTimeout(hop, 150); };
    const press = () => { down = true; clearTimeout(timer); };
    const lift = () => { down = false; settle(); };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || !(r.children[0] as HTMLElement)?.offsetWidth) return;
      e.preventDefault();
      r.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.clientWidth : 1);
    };
    r.addEventListener('scroll', settle, { passive: true });
    r.addEventListener('scrollend', hop);
    r.addEventListener('touchstart', press, { passive: true });
    r.addEventListener('touchend', lift);
    r.addEventListener('touchcancel', lift);
    r.addEventListener('wheel', wheel, { passive: false });
    return () => {
      clearTimeout(timer);
      r.removeEventListener('scroll', settle);
      r.removeEventListener('scrollend', hop);
      r.removeEventListener('touchstart', press);
      r.removeEventListener('touchend', lift);
      r.removeEventListener('touchcancel', lift);
      r.removeEventListener('wheel', wheel);
    };
  }, [loops, tabs.length]);

  // True only while the server's HTML is what's on screen (and while the app takes it over).
  const firstPaint = useSyncExternalStore(noChange, () => false, () => true);

  return (
    <nav aria-label="Pages" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] backdrop-blur lg:hidden">
      {/* While it loops, both edges fade (there's always more). Once every tab fits, the copies go. */}
      {loops && <style>{`.app-tabs{mask-image:linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)}@media (min-width:${fitsFrom}px){.app-tab-copy{display:none}.app-tabs{mask-image:none}}`}</style>}
      <ul ref={row} className="app-tabs chip-strip flex snap-x snap-proximity overflow-x-auto pt-1.5 pointer-fine:snap-none">
        {Array.from({ length: copies }, (_, c) => tabs.map((t, i) => (
          <TabLink key={`${c}:${t.id}`} tab={t} on={on === t.id} copy={c !== mid}
            edge={c !== mid ? undefined : i === 0 ? 'first' : i === tabs.length - 1 ? 'last' : undefined} onTap={tap} />
        )))}
      </ul>
      {firstPaint && <script dangerouslySetInnerHTML={{ __html: CENTRE_JS }} />}
    </nav>
  );
}

/**
 * A tab: the Page's symbol in gray, or in a piece of its color when you're on it. The loop's
 * copies are hidden from screen readers and the keyboard, which get the one real row.
 */
function TabLink({ tab, on, copy, edge, onTap }: {
  tab: Tab; on: boolean; copy: boolean; edge?: 'first' | 'last'; onTap: (id: string, el: HTMLElement) => void;
}) {
  return (
    <li data-tab={tab.id} aria-hidden={copy || undefined}
      className={`${TAB_WIDTH} shrink-0 snap-center ${copy ? 'app-tab-copy' : ''} ${edge === 'first' ? 'ml-auto' : edge === 'last' ? 'mr-auto' : ''}`}>
      <Link href={tab.href} tabIndex={copy ? -1 : undefined} aria-current={on && !copy ? 'page' : undefined}
        onClick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey) onTap(tab.id, e.currentTarget.parentElement!); }}
        className={'flex flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1 text-center text-xs font-bold leading-tight ' + (on ? 'text-ink' : 'text-muted')}>
        <NavSymbol name={tab.icon} color={on ? tab.color : 'var(--muted)'} on={on} size={44} />
        <span className="w-full truncate">{tab.label}</span>
      </Link>
    </li>
  );
}
