'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Hammer, X } from 'lucide-react';
import type { Tint } from '@/data/pages';
import { NavSymbol } from '@/components/Icon';
import { TINT } from './tint';

export interface NavPage { id: string; title: string; short: string; icon: string; tint: Tint; count: number }
export interface NavGame { id: string; shortTitle: string; cover?: string }

function GameMark({ game, size }: { game: NavGame; size: string }) {
  return game.cover
    // eslint-disable-next-line @next/next/no-img-element -- small cover thumbnail
    ? <img src={game.cover} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />
    : <span className={`gloss grid ${size} shrink-0 place-items-center rounded-xl bg-berry font-display text-sm text-white`}>{game.shortTitle.slice(0, 2)}</span>;
}

/**
 * The game app's navigation: a sidebar on computers, a bottom tab bar on phones. The ink
 * top bar (in the app's layout) carries the game's name, the Workshop and your account.
 */
export function AppNav({ game, pages }: { game: NavGame; pages: NavPage[] }) {
  const path = usePathname() || '';
  const home = `/g/${game.id}`;
  const current = pages.find((p) => path.startsWith(`${home}/${p.id}`));
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [more]);

  // Phones get Home, the first three Pages, and "More" for the rest.
  const inBar = pages.length <= 4 ? pages : pages.slice(0, 3);
  const inMore = pages.length <= 4 ? [] : pages;

  return (
    <>
      {/* Computers: sidebar */}
      <aside className="hidden lg:col-start-1 lg:row-start-1 lg:block">
        <div className="sticky top-20 grid gap-4">
          <Link href={home} className={'flex items-center gap-3 rounded-2xl p-2 hover:bg-card ' + (!current ? 'bg-card ring-1 ring-line' : '')}>
            <GameMark game={game} size="size-11" />
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
            <Link href={`/g/${game.id}/workshop`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-muted hover:bg-card hover:text-ink">
              <Hammer size={16} className="text-leaf" aria-hidden="true" /> Workshop
            </Link>
            <Link href="/" className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-muted hover:bg-card hover:text-ink">
              <ArrowLeft size={16} aria-hidden="true" /> Village square
            </Link>
          </div>
        </div>
      </aside>

      {/* Phones: bottom tab bar */}
      <nav aria-label="Pages" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md justify-around px-1 pt-1.5">
          <TabLink href={home} on={!current && !more} label="Home" icon="House" color="var(--ink)" />
          {inBar.map((p) => (
            <TabLink key={p.id} href={`${home}/${p.id}`} on={p.id === current?.id && !more} label={p.short} icon={p.icon} color={`var(--${p.tint})`} />
          ))}
          {inMore.length > 0 && (() => {
            const on = more || Boolean(current && !inBar.includes(current));
            return (
              <button onClick={() => setMore(!more)} aria-expanded={more}
                className={'flex w-16 flex-col items-center gap-0.5 rounded-2xl py-1 text-center text-[11px] font-bold leading-tight ' + (on ? 'text-ink' : 'text-muted')}>
                <NavSymbol name="LayoutGrid" color={on ? 'var(--ink)' : 'var(--muted)'} on={on} size={44} />
                More
              </button>
            );
          })()}
        </div>
      </nav>

      {more && (
        <div className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-[2px] lg:hidden" onClick={() => setMore(false)}>
          <div role="dialog" aria-label="All pages" onClick={(e) => e.stopPropagation()}
            className="rise absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-card px-4 pb-28 pt-4 shadow-soft">
            <div className="flex items-center">
              <h2 className="font-display text-xl">All pages</h2>
              <button onClick={() => setMore(false)} aria-label="Close" className="ml-auto grid size-9 place-items-center rounded-full bg-card-2"><X size={18} aria-hidden="true" /></button>
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {inMore.map((p) => {
                const t = TINT[p.tint];
                return (
                  <li key={p.id}>
                    <Link href={`${home}/${p.id}`} onClick={() => setMore(false)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl ${t.soft} px-2 py-3 text-center text-sm font-bold`}>
                      <NavSymbol name={p.icon} color={`var(--${p.tint})`} on={p.id === current?.id} size={52} />
                      {p.short}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link href="/" onClick={() => setMore(false)} className="mt-4 flex items-center gap-2 text-sm font-bold text-muted">
              <ArrowLeft size={16} aria-hidden="true" /> Village square
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/** A tab on phones: the Page's symbol in gray, or in a piece of its color when you're on it. */
function TabLink({ href, on, label, icon, color }: { href: string; on: boolean; label: string; icon: string; color: string }) {
  return (
    <Link href={href} aria-current={on ? 'page' : undefined}
      className={'flex w-16 flex-col items-center gap-0.5 rounded-2xl py-1 text-center text-[11px] font-bold leading-tight ' + (on ? 'text-ink' : 'text-muted')}>
      <NavSymbol name={icon} color={on ? color : 'var(--muted)'} on={on} size={44} />
      {label}
    </Link>
  );
}
