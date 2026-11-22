import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Block, Entry, Page } from '@/data/pages';
import { findGame } from '@/lib/games-data';
import { getApp } from './app-data';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './supabase/config';
import { bandOf, bandOrder, classShape } from './classes';
import { fromSaved, plannerRosters, slotsOf, type Roster } from './planner';

// A shared party (docs/blocks/planner.md, slice 3), read for its page and its share picture. Only a
// party its maker shared can be read (row-level security), so a private one is simply not found.

export interface SharedMember {
  unit: Entry;
  /** The planned classes, in ladder order, each reached or not. */
  classes: { band: string; entry: Entry; done: boolean }[];
  /** Planned items, by slot. */
  gear: { label: string; items: Entry[] }[];
}

export interface SharedPlan {
  page: Page;
  block: Block;
  roster: Roster;
  members: SharedMember[];
  maker: string;
  /** "Theodora run" (shown as "Matt’s Theodora run"), or "party" on a game without routes. */
  title: string;
  updatedAt: string;
}

/** The made-up plan the build uses for the page's shell: never a real one. */
export const NO_PLAN = '00000000-0000-0000-0000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const backOf = (es: Entry[]) => new Map(es.flatMap((e) => (e.ref ? [[e.ref.card, e] as const] : [])));

export async function getSharedPlan(gameId: string, planId: string): Promise<SharedPlan | null> {
  'use cache';
  cacheTag(`party-plan:${planId}`);
  cacheLife('minutes');
  if (!supabaseConfigured || !UUID.test(planId) || planId === NO_PLAN) return null;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const head = await db.from('party_plans').select('block_key, profile_id, route, plan, updated_at').eq('id', planId).eq('game_id', gameId).maybeSingle();
  if (head.error || !head.data) return null;
  const row = head.data as { block_key: string; profile_id: string; route: string; plan: unknown; updated_at: string };
  const pages = await getApp(gameId);
  const page = pages.find((p) => p.blocks.some((b) => b.id === row.block_key && b.type === 'planner'));
  const block = page?.blocks.find((b) => b.id === row.block_key);
  const roster = page && block ? plannerRosters(pages, page)[block.id] : undefined;
  if (!page || !block || !roster) return null;

  const units = backOf(roster.block.entries.filter((e) => !e.header));
  const classes = backOf((roster.classes?.block.entries ?? []).filter((e) => !e.header));
  const items = Object.fromEntries(Object.entries(roster.slots ?? {}).map(([k, s]) => [k, backOf(s.block.entries)]));
  const plan = fromSaved(row.plan, {
    roster: (c) => units.get(c)?.id,
    classes: (c) => classes.get(c)?.id,
    item: (slot, c) => items[slot]?.get(c)?.id,
  });
  const byId = (m: Map<string, Entry>) => new Map([...m.values()].map((e) => [e.id, e]));
  const unitById = byId(units), classById = byId(classes);
  const itemById = Object.fromEntries(Object.entries(items).map(([k, m]) => [k, byId(m)]));
  const shape = roster.classes ? classShape(roster.classes.block) : undefined;
  const bands = roster.classes && shape?.band ? bandOrder(roster.classes.block.entries, shape.band, shape.choices) : [];

  // Spoilers stay out of a shared page: a spoiler unit, class or item is left off.
  const members: SharedMember[] = plan.party.flatMap((id) => {
    const unit = unitById.get(id);
    if (!unit || unit.spoiler) return [];
    const b = plan.builds?.[id];
    const steps = Object.entries(b?.classes ?? {}).flatMap(([band, s]) => {
      const entry = classById.get(s.id);
      return entry && !entry.spoiler && bandOf(entry, shape?.band) === band ? [{ band, entry, done: Boolean(s.done) }] : [];
    }).sort((x, y) => bands.indexOf(x.band) - bands.indexOf(y.band));
    const gear = slotsOf(block.planSetup).flatMap((slot) => {
      const list = (b?.gear?.[slot.key] ?? []).map((x) => itemById[slot.key]?.get(x)).filter((e): e is Entry => Boolean(e && !e.spoiler));
      return list.length ? [{ label: slot.label, items: list }] : [];
    });
    return [{ unit, classes: steps, gear }];
  });

  const who = await db.from('profiles').select('display_name, username').eq('id', row.profile_id as string).maybeSingle();
  const maker = (who.data?.display_name as string | undefined)?.trim() || (who.data?.username as string | undefined) || 'A villager';
  const route = (await findGame(gameId))?.paths?.options.find((o) => o.key === row.route)?.label;
  return { page, block, roster, members, maker, title: route ? `${route} run` : 'party', updatedAt: row.updated_at as string };
}
