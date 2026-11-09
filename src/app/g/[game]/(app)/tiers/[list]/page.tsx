import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import { GAMES, getGame } from '@/data/games';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { symbolFor } from '@/components/app/symbols';
import { NO_LIST, getSharedList } from '@/lib/tier-share';
import { shadeHex } from '@/lib/shades';
import { placedCount } from '@/lib/tiers';
import { BoardCard, BoardHead, TierRow } from '@/components/tiers/BoardParts';

// A shared tier list: /g/fortunes-weave/tiers/<list id>. Someone's own
// list with their name on it, a share picture for Discord or Reddit (opengraph-image), and a way
// to the community tiers and to making your own. Only lists their makers shared are found.

type Params = Promise<{ game: string; list: string }>;

// Lists are made by players, so none is known at build time. One placeholder per game gives Next
// a shell to build (it shows "Not found"); real lists render on their first visit and are kept.
export async function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id, list: NO_LIST }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { game: gameId, list } = await params;
  const game = getGame(gameId);
  const shared = game ? await getSharedList(gameId, list) : null;
  if (!game || !shared) return { title: 'Not found' };
  const title = `${shared.maker}’s ${shared.title} list · ${game.shortTitle}`;
  const top = shared.tiers.map((t) => ({ t, ids: shared.list.rows[t.key] ?? [] })).find((r) => r.ids.length);
  const description = top
    ? `${top.t.label}: ${top.ids.slice(0, 6).map((id) => shared.entries.get(id)?.name).filter(Boolean).join(', ')}. See the whole list, and what the community thinks, on Village.`
    : 'A tier list on Village.';
  return {
    title,
    description,
    openGraph: { title, description, siteName: 'Village', type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
    other: { 'theme-color': shadeHex(shared.page.tint, game.shade) },
  };
}

export default function SharedTierList({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="mt-3 h-96 animate-pulse rounded-2xl bg-card" />}>
      <Loaded params={params} />
    </Suspense>
  );
}

function Mark({ e, block, px }: { e: Entry; block: Block; px: number }) {
  if (e.icon) return null;
  const symbol = symbolFor(e, block);
  return symbol ? <BlockIcon name={symbol} size={Math.round(px * 0.24)} strokeWidth={2.4} /> : <>{e.name.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</>;
}

async function Loaded({ params }: { params: Params }) {
  const { game: gameId, list: listId } = await params;
  const game = getGame(gameId);
  const shared = game ? await getSharedList(gameId, listId) : null;
  if (!game || !shared) notFound();
  const { page, block, ranked, tiers, list, entries } = shared;
  const title = shared.title;
  const color = `var(--${page.tint})`;
  return (
    <div className="app-block rounded-[1.25rem] p-4 sm:p-5" style={{ '--tint': color } as React.CSSProperties}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{game.shortTitle} · {page.title} · {block.title}</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{shared.maker}’s {title} list</h1>
      {block.intro && <p className="mt-1 text-sm text-muted">{block.intro}</p>}
      <BoardCard className="mt-4">
        <BoardHead title={title} sub={`${ranked.title}, ranked by ${shared.maker}`} chip={`${placedCount(list)} placed`} />
        {tiers.map((t, i) => (
          <TierRow key={t.key} t={t} i={i}>
            {((list.rows[t.key] ?? []).map((id) => entries.get(id)).filter(Boolean) as Entry[]).map((e) => (
              <li key={e.id} className="flex w-[3.6rem] flex-col items-center gap-0.5 p-0.5 sm:w-16" title={list.reasons[e.id] ?? undefined}>
                <Piece size={48} color={color} image={e.icon}><Mark e={e} block={ranked} px={48} /></Piece>
                <span className="w-full truncate text-center text-[11px] font-bold leading-tight">{e.name}</span>
              </li>
            ))}
          </TierRow>
        ))}
      </BoardCard>
      {Object.keys(list.reasons).length > 0 && (
        <section className="mt-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Why</h2>
          <ul className="mt-1 grid gap-1.5">
            {tiers.flatMap((t) => (list.rows[t.key] ?? []).filter((id) => list.reasons[id]).map((id) => (
              <li key={id} className="rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-line">
                <span className="font-bold">{entries.get(id)?.name}</span> <span className="text-muted">({t.label})</span>: {list.reasons[id]}
              </li>
            )))}
          </ul>
        </section>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/g/${gameId}/${page.id}#${block.id}`} className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
          <Users size={15} aria-hidden="true" /> See the community’s tiers
        </Link>
        <Link href={`/g/${gameId}/${page.id}?mine=${block.id}#${block.id}`} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink">
          Make your own list
        </Link>
      </div>
    </div>
  );
}
