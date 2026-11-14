import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Block, Entry } from '@/data/pages';
import { GAMES, getGame } from '@/data/games';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { symbolFor } from '@/components/app/symbols';
import { NO_PLAN, getSharedPlan } from '@/lib/plan-share';
import { shadeHex } from '@/lib/shades';

// A shared party: /g/fortunes-weave/plans/<plan id> (docs/blocks/planner.md, slice 3). Someone's own
// party with their name on it, each unit's class steps and gear, a share picture for Discord or
// Reddit (opengraph-image), and a way to make your own. Only parties their makers shared are found.

type Params = Promise<{ game: string; plan: string }>;

// Parties are made by players, so none is known at build time. One placeholder per game gives Next a
// shell to build (it shows "Not found"); real ones render on their first visit and are kept.
export async function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id, plan: NO_PLAN }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { game: gameId, plan } = await params;
  const game = getGame(gameId);
  const shared = game ? await getSharedPlan(gameId, plan) : null;
  if (!game || !shared) return { title: 'Not found' };
  const title = `${shared.maker}’s ${shared.title} · ${game.shortTitle}`;
  const names = shared.members.map((m) => m.unit.name);
  const description = names.length
    ? `${names.slice(0, 8).join(', ')}${names.length > 8 ? ` and ${names.length - 8} more` : ''}. See each one’s classes and gear, and plan your own, on Village.`
    : 'A party on Village.';
  return {
    title, description,
    openGraph: { title, description, siteName: 'Village', type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
    other: { 'theme-color': shadeHex(shared.page.tint, game.shade) },
  };
}

export default function SharedParty({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="mt-3 h-96 animate-pulse rounded-2xl bg-card" />}>
      <Loaded params={params} />
    </Suspense>
  );
}

function Mark({ e, block, px }: { e: Entry; block: Block; px: number }) {
  if (e.icon) return null;
  const symbol = symbolFor(e, block);
  return symbol ? <BlockIcon name={symbol} size={Math.round(px * 0.22)} strokeWidth={2.4} />
    : <>{e.name.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</>;
}

async function Loaded({ params }: { params: Params }) {
  const { game: gameId, plan } = await params;
  const game = getGame(gameId);
  const shared = game ? await getSharedPlan(gameId, plan) : null;
  if (!game || !shared) notFound();
  const { page, roster, members } = shared;
  const unitColor = `var(--${roster.page.tint})`;
  const classColor = `var(--${roster.classes?.page.tint ?? 'indigo'})`;
  const cardOf = (pageId: string, blockId: string, id: string) => `/g/${gameId}/${pageId}?e=${blockId}.${id}`;
  return (
    <div className="mt-3 grid gap-4 lg:mt-0">
      <div className="app-block rounded-[1.25rem] p-4 sm:p-5" style={{ '--tint': `var(--${page.tint})` } as React.CSSProperties}>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{game.shortTitle} · {page.title}</p>
        <h1 className="font-display text-2xl leading-tight sm:text-3xl">{shared.maker}’s {shared.title}</h1>
        <p className="text-sm text-muted">{members.length} {members.length === 1 ? 'unit' : 'units'}, with their classes and gear.</p>
        {members.length === 0 ? <p className="mt-4 text-sm text-muted">Nobody in this party yet.</p> : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
            {members.map(({ unit, classes, gear }) => (
              <li key={unit.id} className="flex gap-3 px-3 py-3">
                <Link href={cardOf(roster.page.id, roster.block.id, unit.id)} aria-label={`Open ${unit.name}`} className="shrink-0">
                  <Piece size={48} color={unitColor} image={unit.icon}><Mark e={unit} block={roster.block} px={48} /></Piece>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={cardOf(roster.page.id, roster.block.id, unit.id)} className="font-bold leading-tight hover:underline">{unit.name}</Link>
                  {classes.length > 0 && roster.classes && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                      {classes.map((c, i) => (
                        <span key={c.band} className="inline-flex items-center gap-1.5">
                          {i > 0 && <span aria-hidden="true" className="text-muted">→</span>}
                          <Link href={cardOf(roster.classes!.page.id, roster.classes!.block.id, c.entry.id)}
                            className="inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 font-bold ring-1 ring-line hover:ring-ink">
                            <Piece size={20} color={classColor} outline={!c.done} />{c.entry.name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                  {gear.map((g) => (
                    <p key={g.label} className="mt-1 text-sm"><span className="text-muted">{g.label}: </span>{g.items.map((e) => e.name).join(', ')}</p>
                  ))}
                  {!classes.length && !gear.length && <p className="mt-0.5 text-sm text-muted">No classes or gear planned yet.</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">A solid class is reached; an outline is still planned.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/g/${gameId}/${page.id}`} className="btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold">Plan your own party</Link>
        <Link href={`/g/${gameId}/${roster.page.id}`} className="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">See every unit</Link>
      </div>
    </div>
  );
}
