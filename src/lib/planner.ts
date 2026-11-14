import type { Block, Entry, Page, Route, Tint } from '@/data/pages';
import { DESCRIPTION, isCategory, shownFields, valueOf } from './fields.ts';

// The Planner (docs/blocks/planner.md): a player's own party for their run, picked from a Characters
// Block (the roster), with a build per unit (class steps and gear) and a next-step line. Plain and
// tested (planner.test.ts).

/** A gear slot builders set up: where its items come from, and how many fit. */
export interface PlanSlot {
  key: string;
  label: string;
  /** The Items Block it draws from. */
  from: string;
  /** Only items with one of these values of a tag (Type: Weapon). */
  tag?: { key: string; values: string[] };
  /** How many items fit (1 by default, 10 at most). */
  count?: number;
}

/** A Planner Block's setup, set by builders (in Set up from slice 3; the starter data until then). */
export interface PlanSetup {
  /** The Characters Block a party is picked from, on any Page of the game. */
  roster: string;
  /** The most units a party holds. Missing: no limit (100 at most, as the database allows). */
  size?: number;
  /** The fields that say how to get a unit, in order, joined on the next-step line ("Recruit",
   *  "@description"). Missing: the roster's first field named like recruit or unlock. */
  unlock?: string[];
  /** The Classes Block whose tiers make the class steps. Missing: no class steps. */
  classes?: string;
  /** Gear slots. Missing: no gear. */
  slots?: PlanSlot[];
}

/** The database's own ceilings. */
export const MAX_PARTY = 100;
export const MAX_SLOT = 10;

export const partySize = (setup?: PlanSetup) => Math.min(setup?.size && setup.size > 0 ? Math.floor(setup.size) : MAX_PARTY, MAX_PARTY);
export const slotCount = (slot: PlanSlot) => Math.max(0, Math.min(slot.count && slot.count > 0 ? Math.floor(slot.count) : 1, MAX_SLOT));
export const slotsOf = (setup?: PlanSetup) => (setup?.slots ?? []).filter((s) => s.key && s.from);

/** One unit's build: a class per tier (band), each done or not, and items per gear slot. */
export interface Build {
  classes?: Record<string, { id: string; done?: boolean }>;
  gear?: Record<string, string[]>;
}

/** One plan: the party's units (entry ids of the roster) in the player's order, and their builds. */
export interface Plan { party: string[]; builds?: Record<string, Build> }

export const EMPTY_PLAN: Plan = { party: [] };

/** A plan is kept per route on games with routes ('' when there are none). */
export const planKey = (route: Route | 'all') => (route === 'all' ? '' : route);

const isEmptyBuild = (b?: Build) => !b || (!Object.keys(b.classes ?? {}).length && !Object.values(b.gear ?? {}).some((x) => x.length));

/** The plan with one unit's build changed (an empty build is dropped). */
function withBuild(plan: Plan, id: string, build: Build): Plan {
  const builds = { ...(plan.builds ?? {}) };
  const clean: Build = {};
  if (Object.keys(build.classes ?? {}).length) clean.classes = build.classes;
  if (Object.values(build.gear ?? {}).some((x) => x.length)) clean.gear = Object.fromEntries(Object.entries(build.gear!).filter(([, x]) => x.length));
  if (isEmptyBuild(clean)) delete builds[id]; else builds[id] = clean;
  return Object.keys(builds).length ? { party: plan.party, builds } : { party: plan.party };
}

export const buildOf = (plan: Plan, id: string): Build => plan.builds?.[id] ?? {};

/** Adds a unit at the end. Refused (same plan back) when it's already there or the party is full. */
export function addMember(plan: Plan, id: string, size: number): Plan {
  if (plan.party.includes(id) || plan.party.length >= size) return plan;
  return { ...plan, party: [...plan.party, id] };
}

/** Takes a unit out, with their build. */
export function removeMember(plan: Plan, id: string): Plan {
  return withBuild({ ...plan, party: plan.party.filter((x) => x !== id) }, id, {});
}

/** Moves a unit up (-1) or down (+1) one place. */
export function moveMember(plan: Plan, id: string, by: -1 | 1): Plan {
  const i = plan.party.indexOf(id), j = i + by;
  if (i < 0 || j < 0 || j >= plan.party.length) return plan;
  const party = [...plan.party];
  [party[i], party[j]] = [party[j], party[i]];
  return { ...plan, party };
}

/** Picks a unit's class for one tier, or clears it (null). A new pick starts not done. */
export function setClassStep(plan: Plan, id: string, band: string, classId: string | null): Plan {
  if (!plan.party.includes(id)) return plan;
  const b = buildOf(plan, id);
  const classes = { ...(b.classes ?? {}) };
  if (classId) classes[band] = classes[band]?.id === classId ? classes[band] : { id: classId };
  else delete classes[band];
  return withBuild(plan, id, { ...b, classes });
}

/** Marks a tier's class done, or not done again. */
export function toggleStepDone(plan: Plan, id: string, band: string): Plan {
  const b = buildOf(plan, id);
  const step = b.classes?.[band];
  if (!step) return plan;
  return withBuild(plan, id, { ...b, classes: { ...b.classes, [band]: step.done ? { id: step.id } : { id: step.id, done: true } } });
}

/** Puts an item in a slot, or takes it out if it's there. Refused when the slot is full. */
export function toggleGear(plan: Plan, id: string, slot: string, itemId: string, count: number): Plan {
  if (!plan.party.includes(id)) return plan;
  const b = buildOf(plan, id);
  const now = b.gear?.[slot] ?? [];
  const next = now.includes(itemId) ? now.filter((x) => x !== itemId) : now.length < count ? [...now, itemId] : now;
  if (next === now) return plan;
  const gear = { ...(b.gear ?? {}), [slot]: next };
  if (!next.length) delete gear[slot];
  return withBuild(plan, id, { ...b, gear });
}

/** What a stored plan may hold, to tidy it against: the roster, each class's tier, each slot's items. */
export interface Known {
  ids: Set<string>;
  size: number;
  /** Class id to its tier. */
  classBand?: Map<string, string>;
  /** Slot key to its items and count. */
  slots?: Record<string, { ids: Set<string>; count: number }>;
}

/** Keeps only units still in the roster (each once, within the size), and builds that still fit. */
export function tidyPlan(plan: unknown, known: Known): Plan {
  const raw = plan && typeof plan === 'object' && Array.isArray((plan as Plan).party) ? (plan as Plan).party : [];
  const seen = new Set<string>();
  const party = raw.filter((x): x is string => typeof x === 'string' && known.ids.has(x) && !seen.has(x) && Boolean(seen.add(x))).slice(0, known.size);
  const rawBuilds = plan && typeof plan === 'object' && (plan as Plan).builds && typeof (plan as Plan).builds === 'object' ? (plan as Plan).builds! : {};
  let out: Plan = { party };
  for (const id of party) {
    const b = rawBuilds[id];
    if (!b || typeof b !== 'object') continue;
    const classes: NonNullable<Build['classes']> = {};
    for (const [band, step] of Object.entries(b.classes ?? {})) {
      if (step && typeof step === 'object' && typeof step.id === 'string' && known.classBand?.get(step.id) === band) {
        classes[band] = step.done ? { id: step.id, done: true } : { id: step.id };
      }
    }
    const gear: NonNullable<Build['gear']> = {};
    for (const [slot, items] of Object.entries(b.gear ?? {})) {
      const s = known.slots?.[slot];
      if (!s || !Array.isArray(items)) continue;
      const kept = [...new Set(items.filter((x): x is string => typeof x === 'string' && s.ids.has(x)))].slice(0, s.count);
      if (kept.length) gear[slot] = kept;
    }
    out = withBuild(out, id, { classes, gear });
  }
  return out;
}

/** Two plans are the same when they'd be saved the same. */
export const samePlan = (a: Plan, b: Plan) => JSON.stringify(normal(a)) === JSON.stringify(normal(b));
function normal(p: Plan) {
  return p.party.map((id) => {
    const b = p.builds?.[id];
    const classes = Object.entries(b?.classes ?? {}).sort(([x], [y]) => x.localeCompare(y)).map(([band, s]) => [band, s.id, Boolean(s.done)]);
    const gear = Object.entries(b?.gear ?? {}).sort(([x], [y]) => x.localeCompare(y));
    return [id, classes, gear];
  });
}

/** How entry ids and cards turn into each other, per Block (ids are slugs; cards never change). */
export interface Refs {
  roster: (id: string) => string | undefined;
  classes?: (id: string) => string | undefined;
  item?: (slot: string, id: string) => string | undefined;
}
export interface BackRefs {
  roster: (card: string) => string | undefined;
  classes?: (card: string) => string | undefined;
  item?: (slot: string, card: string) => string | undefined;
}

/** What the account stores (save_party_plan in the Planner SQL): cards, with each member's build. */
export function toSaved(plan: Plan, refs: Refs) {
  return {
    party: plan.party.flatMap((id) => {
      const card = refs.roster(id);
      if (!card) return [];
      const b = plan.builds?.[id];
      const classes = Object.entries(b?.classes ?? {}).flatMap(([band, s]) => {
        const c = refs.classes?.(s.id);
        return c ? [{ band, card: c, ...(s.done ? { done: true } : {}) }] : [];
      });
      const gear = Object.entries(b?.gear ?? {}).flatMap(([slot, ids]) => {
        const cards = ids.map((x) => refs.item?.(slot, x)).filter((c): c is string => Boolean(c));
        return cards.length ? [{ slot, cards }] : [];
      });
      return [{ card, ...(classes.length ? { classes } : {}), ...(gear.length ? { gear } : {}) }];
    }),
  };
}

export function fromSaved(saved: unknown, back: BackRefs): Plan {
  const party = saved && typeof saved === 'object' && Array.isArray((saved as { party?: unknown }).party) ? (saved as { party: unknown[] }).party : [];
  let out: Plan = { party: [] };
  for (const m of party) {
    if (!m || typeof m !== 'object') continue;
    const row = m as { card?: unknown; classes?: unknown; gear?: unknown };
    const id = back.roster(String(row.card ?? ''));
    if (!id || out.party.includes(id)) continue;
    out = { ...out, party: [...out.party, id] };
    const classes: NonNullable<Build['classes']> = {};
    for (const s of Array.isArray(row.classes) ? row.classes : []) {
      const c = s && typeof s === 'object' ? back.classes?.(String((s as { card?: unknown }).card ?? '')) : undefined;
      const band = s && typeof s === 'object' ? String((s as { band?: unknown }).band ?? '') : '';
      if (c && band) classes[band] = (s as { done?: unknown }).done === true ? { id: c, done: true } : { id: c };
    }
    const gear: NonNullable<Build['gear']> = {};
    for (const s of Array.isArray(row.gear) ? row.gear : []) {
      if (!s || typeof s !== 'object') continue;
      const slot = String((s as { slot?: unknown }).slot ?? '');
      const cards = Array.isArray((s as { cards?: unknown }).cards) ? (s as { cards: unknown[] }).cards : [];
      const ids = cards.map((c) => back.item?.(slot, String(c))).filter((x): x is string => Boolean(x));
      if (slot && ids.length) gear[slot] = ids;
    }
    out = withBuild(out, id, { classes, gear });
  }
  return out;
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
  /** 'recruit': not got yet, with how; 'gear': an item to get; 'class': the next class to reach;
   *  'planned': everything planned is done; 'got': recruited, nothing planned; 'none': nothing to say. */
  kind: 'recruit' | 'gear' | 'class' | 'planned' | 'got' | 'none';
  /** What to show after the label ("Killing Edge · Hightown armory."). */
  text: string;
}

/** What the next-step line needs to know beyond the unit: their build, and the classes and items in it. */
export interface StepContext {
  roster: Pick<Block, 'fields'> & Partial<Pick<Block, 'type'>>;
  route: Route | 'all';
  /** Ticked Recruited; undefined when the roster has no recruiting. */
  recruited: boolean | undefined;
  setup?: PlanSetup;
  build?: Build;
  /** The class steps' tiers, in ladder order. */
  bands?: string[];
  classOf?: (id: string) => { name: string; exam: string } | undefined;
  itemOf?: (slot: string, id: string) => { name: string; where: string; got: boolean } | undefined;
}

/** How to get a unit: "Support 3, Renown 9 · Deliver 3 Giant's Meat." for the route, or why there's nothing. */
function recruitLine(entry: Entry, c: StepContext): NextStep {
  const fields = unlockFields(c.roster, c.setup);
  const texts = fields.map((f) => {
    const v = valueOf(entry, f);
    const mine = c.route !== 'all' ? v.byRoute.find(([r]) => r === c.route)?.[1] : undefined;
    return [mine, v.text].filter((t): t is string => Boolean(t)).map(firstSentence).filter(Boolean);
  });
  const parts = texts.flat();
  const line = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i).join(' · ');
  // Joins on their own on this route (a Flame Lord's own house, a tutorial recruit): nothing to do.
  if (/^joins automatically/i.test(texts[0]?.[0] ?? '')) return { kind: 'got', text: firstSentence(texts[0][0]).replace(/\.$/, '') };
  // No recruiting steps written (only a description, say): not something to chase, so no "To recruit".
  const main = fields[0] ? valueOf(entry, fields[0]) : undefined;
  if (c.recruited === undefined || !(main?.text || main?.byRoute.length)) return { kind: 'none', text: line };
  return { kind: 'recruit', text: line || 'Not recruited yet' };
}

/**
 * A party member's line, the first thing still to do, in the order a player meets them:
 *   1. recruit them ("Support 3, Renown 9 · Deliver 3 Giant's Meat."), for the player's route;
 *   2. get their planned gear (the first item not "Got it", and where to get it);
 *   3. reach their next class (the first tier not done, and its exam).
 * With all of it done, the plan ("Swordmaster · Killing Edge"); with nothing planned, "Recruited".
 */
export function nextStep(entry: Entry, c: StepContext): NextStep {
  const how = c.recruited ? null : recruitLine(entry, c);
  if (how?.kind === 'recruit') return how;
  const b = c.build ?? {};
  for (const slot of slotsOf(c.setup)) {
    for (const id of b.gear?.[slot.key] ?? []) {
      const item = c.itemOf?.(slot.key, id);
      if (item && !item.got) return { kind: 'gear', text: [item.name, item.where && firstSentence(item.where)].filter(Boolean).join(' · ') };
    }
  }
  const bands = [...(c.bands ?? []), ...Object.keys(b.classes ?? {}).filter((x) => !c.bands?.includes(x))];
  for (const band of bands) {
    const step = b.classes?.[band];
    const cls = step && c.classOf?.(step.id);
    if (cls && !step!.done) return { kind: 'class', text: [cls.name, cls.exam].filter(Boolean).join(' · ') };
  }
  const lastClass = [...bands].reverse().map((band) => b.classes?.[band] && c.classOf?.(b.classes[band].id)?.name).find(Boolean);
  const firstGear = slotsOf(c.setup).flatMap((s) => (b.gear?.[s.key] ?? []).map((id) => c.itemOf?.(s.key, id)?.name)).filter(Boolean);
  const planned = [lastClass, ...firstGear].filter(Boolean) as string[];
  if (planned.length) return { kind: 'planned', text: planned.join(' · ') };
  if (c.recruited) return { kind: 'got', text: 'Recruited' };
  return how ?? { kind: 'none', text: '' };
}

/** The label before a line: what kind of step it is. */
export const STEP_LABEL: Partial<Record<NextStep['kind'], string>> = {
  recruit: 'To recruit', gear: 'Get', class: 'Next class', planned: 'Planned',
};

// ------------------------------------------------------------------ Server: what a Planner picks from

/** A Block a Planner picks from, and the Page it lives on (for links and its color). */
export interface Source { block: Block; page: { id: string; title: string; tint: Tint } }

/** A Planner's roster, classes and gear Blocks, handed from the server to the Party Page. */
export interface Roster extends Source {
  classes?: Source;
  /** Slot key to its Items Block. */
  slots?: Record<string, Source>;
}

function findBlock(pages: Page[], id: string | undefined, type: Block['type']): Source | undefined {
  if (!id) return undefined;
  for (const p of pages) {
    const block = p.blocks.find((x) => x.id === id && x.type === type);
    if (block) return { block, page: { id: p.id, title: p.title, tint: p.tint } };
  }
  return undefined;
}

/** Every Planner on this Page, with the Blocks it picks from. */
export function plannerRosters(pages: Page[], page: Page): Record<string, Roster> {
  const out: Record<string, Roster> = {};
  for (const b of page.blocks) {
    if (b.type !== 'planner' || !b.planSetup?.roster) continue;
    const roster = findBlock(pages, b.planSetup.roster, 'characters');
    if (!roster) continue;
    const classes = findBlock(pages, b.planSetup.classes, 'classes');
    const slots: Record<string, Source> = {};
    for (const s of slotsOf(b.planSetup)) {
      const src = findBlock(pages, s.from, 'items');
      if (src) slots[s.key] = src;
    }
    out[b.id] = { ...roster, ...(classes ? { classes } : {}), ...(Object.keys(slots).length ? { slots } : {}) };
  }
  return out;
}

/** Moves a unit to a place in the party (dragging). */
export function moveMemberTo(plan: Plan, id: string, to: number): Plan {
  const from = plan.party.indexOf(id);
  if (from < 0) return plan;
  const party = plan.party.filter((x) => x !== id);
  party.splice(Math.max(0, Math.min(to, party.length)), 0, id);
  return party.join('\n') === plan.party.join('\n') ? plan : { ...plan, party };
}

// ------------------------------------------------------------------ The party index (marks elsewhere)

/** What other Pages need to mark a party: who's in it ("units.goliath") and which items are planned
 *  for whom ("weapons-and-magic.levin-sword-plus-1": ["Goliath"]). Kept on the device per route. */
export interface PartyIndexRoute { members: string[]; items: Record<string, string[]> }
export interface PartyIndex { href: string; byRoute: Record<string, PartyIndexRoute> }

export function partyIndexRoute(plan: Plan, rosterBlock: string, nameOf: (id: string) => string | undefined, slotBlock: (slot: string) => string | undefined): PartyIndexRoute {
  const items: Record<string, string[]> = {};
  for (const id of plan.party) {
    const name = nameOf(id);
    if (!name) continue;
    for (const [slot, ids] of Object.entries(plan.builds?.[id]?.gear ?? {})) {
      const block = slotBlock(slot);
      if (!block) continue;
      for (const item of ids) (items[`${block}.${item}`] ??= []).push(name);
    }
  }
  return { members: plan.party.map((id) => `${rosterBlock}.${id}`), items };
}

/** Reads a stored index, keeping only what has the right shape. */
export function readPartyIndex(raw: unknown): PartyIndex | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PartyIndex>;
  if (typeof r.href !== 'string' || !r.href.startsWith('/') || !r.byRoute || typeof r.byRoute !== 'object') return null;
  const byRoute: Record<string, PartyIndexRoute> = {};
  for (const [k, v] of Object.entries(r.byRoute)) {
    if (!v || !Array.isArray(v.members)) continue;
    const items = v.items && typeof v.items === 'object' ? Object.fromEntries(Object.entries(v.items).filter(([, n]) => Array.isArray(n)).map(([key, n]) => [key, n.filter((x) => typeof x === 'string')])) : {};
    byRoute[k] = { members: v.members.filter((x) => typeof x === 'string'), items };
  }
  return { href: r.href, byRoute };
}

// ------------------------------------------------------------------ Set up (the Workshop)

/** A new slot's key from its name, unique among the slots; it never changes after (plans keep it). */
export function slotKeyFor(label: string, taken: string[]): string {
  const base = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'slot';
  let key = base, n = 2;
  while (taken.includes(key)) key = `${base.slice(0, 21)}-${n++}`;
  return key;
}

/** A setup as Set up saves it: a whole size within the ceiling (or none), named slots with a count of
 *  1 to 10 and no empty tag limit, and no empty lists left behind. */
export function tidySetup(s: PlanSetup): PlanSetup {
  const out: PlanSetup = { roster: s.roster };
  if (s.size && s.size > 0) out.size = Math.min(Math.floor(s.size), MAX_PARTY);
  if (s.unlock?.length) out.unlock = [...new Set(s.unlock)];
  if (s.classes) out.classes = s.classes;
  const slots = (s.slots ?? []).filter((x) => x.key && x.from && x.label.trim()).map((x) => ({
    key: x.key, label: x.label.trim().replace(/\s+/g, ' '), from: x.from,
    ...(x.tag?.key && x.tag.values.length ? { tag: { key: x.tag.key, values: [...new Set(x.tag.values)] } } : {}),
    count: slotCount(x),
  }));
  if (slots.length) out.slots = slots;
  return out;
}
