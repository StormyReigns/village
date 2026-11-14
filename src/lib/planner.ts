import type { Block, Entry, Page, Route, Tint } from '@/data/pages';
import { DESCRIPTION, isCategory, shownFields, valueOf } from './fields.ts';

// The Planner (docs/blocks/planner.md): a player's own party for their run, picked from a Characters
// Block (the roster), with a next-step line per unit. Plain and tested (planner.test.ts).

/** A Planner Block's setup, set by builders (in Set up from slice 3; the starter data until then). */
export interface PlanSetup {
  /** The Characters Block a party is picked from, on any Page of the game. */
  roster: string;
  /** The most units a party holds. Missing: no limit (100 at most, as the database allows). */
  size?: number;
  /** The fields that say how to get a unit, in order, joined on the next-step line ("Recruit",
   *  "@description"). Missing: the roster's first field named like recruit or unlock. */
  unlock?: string[];
}

/** The database's own ceiling on a party. */
export const MAX_PARTY = 100;

export const partySize = (setup?: PlanSetup) => Math.min(setup?.size && setup.size > 0 ? Math.floor(setup.size) : MAX_PARTY, MAX_PARTY);

/** One plan: the party's units (entry ids of the roster) in the player's order. */
export interface Plan { party: string[] }

export const EMPTY_PLAN: Plan = { party: [] };

/** A plan is kept per route on games with routes ('' when there are none). */
export const planKey = (route: Route | 'all') => (route === 'all' ? '' : route);

/** Adds a unit at the end. Refused (same plan back) when it's already there or the party is full. */
export function addMember(plan: Plan, id: string, size: number): Plan {
  if (plan.party.includes(id) || plan.party.length >= size) return plan;
  return { party: [...plan.party, id] };
}

export const removeMember = (plan: Plan, id: string): Plan => ({ party: plan.party.filter((x) => x !== id) });

/** Moves a unit up (-1) or down (+1) one place. */
export function moveMember(plan: Plan, id: string, by: -1 | 1): Plan {
  const i = plan.party.indexOf(id), j = i + by;
  if (i < 0 || j < 0 || j >= plan.party.length) return plan;
  const party = [...plan.party];
  [party[i], party[j]] = [party[j], party[i]];
  return { party };
}

/** Keeps only units still in the roster, each once, no more than the size. */
export function tidyPlan(plan: unknown, ids: Set<string>, size: number): Plan {
  const raw = plan && typeof plan === 'object' && Array.isArray((plan as Plan).party) ? (plan as Plan).party : [];
  const seen = new Set<string>();
  const party = raw.filter((x): x is string => typeof x === 'string' && ids.has(x) && !seen.has(x) && Boolean(seen.add(x))).slice(0, size);
  return { party };
}

export const samePlan = (a: Plan, b: Plan) => a.party.join('\n') === b.party.join('\n');

/** What the account stores: cards, not entry ids (ids are slugs, cards never change). */
export const toSaved = (plan: Plan, cardOf: (id: string) => string | undefined) =>
  ({ party: plan.party.flatMap((id) => { const card = cardOf(id); return card ? [{ card }] : []; }) });

export function fromSaved(saved: unknown, idOf: (card: string) => string | undefined): Plan {
  const party = saved && typeof saved === 'object' && Array.isArray((saved as { party?: unknown }).party) ? (saved as { party: unknown[] }).party : [];
  return { party: party.flatMap((m) => { const id = m && typeof m === 'object' ? idOf(String((m as { card?: unknown }).card ?? '')) : undefined; return id ? [id] : []; }) };
}

// ------------------------------------------------------------------ The next-step line

/** The fields that say how to get a unit. */
export function unlockFields(roster: Pick<Block, 'fields'> & Partial<Pick<Block, 'type'>>, setup?: PlanSetup) {
  const fields = shownFields(roster);
  if (setup?.unlock?.length) {
    return setup.unlock.flatMap((k) => (k === DESCRIPTION ? [{ key: DESCRIPTION, label: 'Description', kind: 'longtext' as const }] : fields.filter((f) => f.key === k)));
  }
  const f = fields.find((x) => !isCategory(x) && /recruit|unlock/i.test(`${x.key} ${x.label}`));
  return f ? [f] : [];
}

/** The first sentence of a text, short enough for one line. */
export function firstSentence(text: string) {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const m = /^(.+?[.!?])(\s|$)/.exec(line);
  return (m ? m[1] : line).trim();
}

export interface NextStep {
  /** 'recruit': not got yet, with how; 'got': recruited (or a roster without recruiting); 'none': nothing to say. */
  kind: 'recruit' | 'got' | 'none';
  text: string;
}

/**
 * A party member's line: how to get them while they aren't recruited ("Support 3, Renown 9 · Deliver
 * 3 Giant's Meat."), for the player's route; once recruited, "Recruited". Later slices add gear and
 * class steps after recruiting.
 */
export function nextStep(entry: Entry, roster: Pick<Block, 'fields'> & Partial<Pick<Block, 'type'>>, route: Route | 'all', recruited: boolean | undefined, setup?: PlanSetup): NextStep {
  if (recruited) return { kind: 'got', text: 'Recruited' };
  const fields = unlockFields(roster, setup);
  const texts = fields.map((f) => {
    const v = valueOf(entry, f);
    const mine = route !== 'all' ? v.byRoute.find(([r]) => r === route)?.[1] : undefined;
    return [mine, v.text].filter((t): t is string => Boolean(t)).map(firstSentence).filter(Boolean);
  });
  const parts = texts.flat();
  const line = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i).join(' · ');
  // Joins on their own on this route (a Flame Lord's own house, a tutorial recruit): nothing to do.
  if (/^joins automatically/i.test(texts[0]?.[0] ?? '')) return { kind: 'got', text: firstSentence(texts[0][0]).replace(/\.$/, '') };
  // No recruiting steps written (only a description, say): not something to chase, so no "To recruit".
  const main = fields[0] ? valueOf(entry, fields[0]) : undefined;
  if (recruited === undefined || !(main?.text || main?.byRoute.length)) return { kind: 'none', text: line };
  return { kind: 'recruit', text: line || 'Not recruited yet' };
}

// ------------------------------------------------------------------ Server: the roster for a Planner

/** A Planner's roster, handed from the server to the Party Page (the roster lives on another Page). */
export interface Roster { block: Block; page: { id: string; title: string; tint: Tint } }

/** Every Planner on this Page, with the roster Block it picks from. */
export function plannerRosters(pages: Page[], page: Page): Record<string, Roster> {
  const out: Record<string, Roster> = {};
  for (const b of page.blocks) {
    if (b.type !== 'planner' || !b.planSetup?.roster) continue;
    for (const p of pages) {
      const roster = p.blocks.find((x) => x.id === b.planSetup!.roster && x.type === 'characters');
      if (roster) { out[b.id] = { block: roster, page: { id: p.id, title: p.title, tint: p.tint } }; break; }
    }
  }
  return out;
}
