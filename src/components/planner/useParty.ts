'use client';

import { useEffect, useMemo } from 'react';
import type { Block, Entry, Route } from '@/data/pages';
import { onRoute, useTicks } from '@/components/app/entries';
import { valueOf, shownFields } from '@/lib/fields';
import { buildOf, nextStep, partyIndexRoute, partySize, planKey, readPartyIndex, slotCount, slotsOf, type NextStep, type Roster } from '@/lib/planner';
import { usePlan, type PlanSources } from './usePlan';
import { ladderOf } from './sources';

// One Planner's party for the player's route, with each member's next step (docs/blocks/planner.md).
// Shared by the Party Page and the "Your party" card on the game's home. It also keeps a small index
// on the device (who's in the party, which items are planned for whom) so cards on other Pages can say
// "In your party" without loading the Planner.

export const partyIndexKey = (gameId: string) => `village:${gameId}:party`;
export const PARTY_EVENT = 'village-party';

export function useParty(gameId: string, block: Block, roster: Roster, route: Route | 'all', href: string) {
  const size = partySize(block.planSetup);
  const setup = block.planSetup;
  const rb = roster.block;
  // Every unit on this route (header cards aside).
  const onThisRoute = useMemo(() => rb.entries.filter((e) => !e.header && (!rb.byRoute || onRoute(e, route))), [rb, route]);
  const ladder = useMemo(() => ladderOf(roster.classes, route), [roster.classes, route]);
  // Each slot's items, and the field that says where to get one ("Where to get it").
  const slots = useMemo(() => slotsOf(setup).flatMap((slot) => {
    const src = roster.slots?.[slot.key];
    if (!src) return [];
    const where = shownFields(src.block).find((f) => /where|source|how to get/i.test(`${f.key} ${f.label}`) && f.kind !== 'tag');
    return [{ slot, src, where, byId: new Map(src.block.entries.map((e) => [e.id, e])) }];
  }), [setup, roster.slots]);
  const sources: PlanSources = useMemo(() => ({
    roster: onThisRoute,
    classes: ladder && roster.classes ? { entries: [...ladder.byId.values()], band: ladder.bandOf } : undefined,
    slots: slots.map(({ slot, src }) => ({ key: slot.key, entries: src.block.entries.filter((e) => !e.header), count: slotCount(slot) })),
  }), [onThisRoute, ladder, roster.classes, slots]);
  const saving = usePlan(gameId, block.id, sources, route, size);
  const { plan, ready } = saving;
  const [ticks, toggle] = useTicks(gameId);
  const recruits = (rb.fields ?? []).some((f) => !f.off && /recruit/i.test(`${f.key} ${f.label}`));
  const byId = useMemo(() => new Map(onThisRoute.map((e) => [e.id, e])), [onThisRoute]);
  const members = useMemo(() => plan.party.map((id) => byId.get(id)).filter((e): e is Entry => Boolean(e)), [plan.party, byId]);
  const recruitKey = (e: Entry) => `recruited:${rb.id}.${e.id}`;

  const stepOf = (e: Entry): NextStep => nextStep(e, {
    roster: rb, route, recruited: recruits ? ticks.has(recruitKey(e)) : undefined, setup, build: buildOf(plan, e.id), bands: ladder?.bands,
    classOf: (id) => { const c = ladder?.byId.get(id); return c ? { name: c.name, exam: ladder!.exam(c) } : undefined; },
    itemOf: (slot, id) => {
      const s = slots.find((x) => x.slot.key === slot);
      const item = s?.byId.get(id);
      if (!s || !item) return undefined;
      const v = s.where ? valueOf(item, s.where) : undefined;
      return { name: item.name, where: v?.text ?? '', got: ticks.has(`got:${s.src.block.id}.${id}`) };
    },
  });

  // Keep the index for other Pages' marks up to date for this route.
  useEffect(() => {
    if (!ready) return;
    try {
      const prev = readPartyIndex(JSON.parse(localStorage.getItem(partyIndexKey(gameId)) ?? 'null'));
      const here = partyIndexRoute(plan, rb.id, (id) => byId.get(id)?.name, (slot) => roster.slots?.[slot]?.block.id);
      const next = { href, byRoute: { ...(prev?.byRoute ?? {}), [planKey(route)]: here } };
      const text = JSON.stringify(next);
      if (localStorage.getItem(partyIndexKey(gameId)) === text) return;
      localStorage.setItem(partyIndexKey(gameId), text);
      window.dispatchEvent(new Event(PARTY_EVENT));
    } catch { /* storage unavailable */ }
  }, [ready, plan, rb.id, byId, roster.slots, gameId, route, href]);

  return { ...saving, size, setup, rb, onThisRoute, ladder, slots, ticks, toggle, recruits, recruitKey, byId, members, stepOf };
}
