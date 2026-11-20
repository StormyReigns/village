// When a deadline falls, as a number to sort by (the Last chances checklist's "Next up").
// Deadlines are written in words ("Ch 11, 10/18–10/27", "Choosing in Ch 8", "The end of Part I"),
// so community edits keep sorting without a separate number to maintain.
//
// The scale: the Prologue is 0, Part I's chapters are 1 to 12, the end of Part I is just after 12,
// Part II's chapters are 100 and up and Part III's 200 and up. A date in the text ("10/18") breaks
// ties inside a chapter. Something that comes back every week has no deadline of its own and sorts
// last. Text with no chapter at all sorts after every dated one.

export const NO_DEADLINE = 10_000;
export const EVERY_WEEK = 20_000;

/** A month/day as a fraction under 1, so it only orders things within the same chapter. */
function dateFraction(text: string) {
  const m = text.match(/\b(1[0-2]|0?[1-9])\/([0-2]?\d|3[01])\b/);
  return m ? (Number(m[1]) * 32 + Number(m[2])) / 1000 : 0;
}

export function deadlineRank(text: string | undefined): number {
  if (!text?.trim()) return NO_DEADLINE;
  const t = text.trim();
  if (/\b(each|every)\s+week\b|\bweekly\b/i.test(t)) return EVERY_WEEK;
  const part = /\bPart\s+III\b/i.test(t) ? 3 : /\bPart\s+II\b/i.test(t) ? 2 : /\bPart\s+I\b/i.test(t) ? 1 : 0;
  const ch = t.match(/\b(?:Ch|Chapter)\.?\s*(\d{1,2})\b/i);
  if (ch) return (part >= 2 ? part * 100 - 100 : 0) + Number(ch[1]) + dateFraction(t);
  if (/\bprologue\b/i.test(t)) return dateFraction(t);
  // "The end of Part I", "Moving into Part II": after Part I's last chapter, before Part II.
  if (/\bend of Part\s+I\b/i.test(t) || (part === 2 && /\b(moving|going|before|entering)\b/i.test(t))) return 12.9;
  if (/\bend of Part\s+II\b/i.test(t) || (part === 3 && /\b(moving|going|before|entering)\b/i.test(t))) return 199.9;
  if (part === 2) return 100;
  if (part === 3) return 200;
  return NO_DEADLINE;
}

/** The earliest of several deadlines (an entry whose deadline differs by route, with All picked). */
export const earliest = (texts: (string | undefined)[]) => Math.min(NO_DEADLINE, ...texts.map(deadlineRank));

interface Dated {
  sections: { label: string; text: string }[];
  perRoute?: Partial<Record<string, { label: string; text: string }[]>>;
}

/** An entry's deadline text for a route (its route's line first, then "Before"). */
export function deadlineText(e: Dated, route: string): string | undefined {
  const before = e.sections.find((s) => s.label === 'Before')?.text;
  return route !== 'all' ? e.perRoute?.[route]?.[0]?.text ?? before : before;
}

/** Checklist entries in the order their deadlines come, for a route (All: each by its earliest). */
export function byDeadline<T extends Dated>(entries: T[], route: string): T[] {
  const when = (e: T) => route !== 'all' ? deadlineRank(deadlineText(e, route))
    : earliest([deadlineText(e, 'all'), ...Object.values(e.perRoute ?? {}).map((x) => x?.[0]?.text)]);
  return entries.map((e, i) => ({ e, i, w: when(e) })).sort((a, b) => a.w - b.w || a.i - b.i).map((x) => x.e);
}

/**
 * A choose-one last chance's options, from its text: each quoted name followed by what it "leads to" or
 * "gives" ('"A Letter of Some Gravity" leads to the Haze Badge. "For the Empire's Safety" gives a
 * Specialty License.'). Two or more means the player picks one; fewer means it isn't a choice.
 */
export function choiceOptions(text: string | undefined): { name: string; gives: string }[] {
  const out: { name: string; gives: string }[] = [];
  for (const m of (text ?? '').matchAll(/["“]([^"”]{2,80})["”]\s+(?:leads to|gives|unlocks|rewards)\s+(?:you\s+)?(?:the|a|an)?\s*([^.;]{2,80})/gi)) {
    out.push({ name: m[1].trim(), gives: m[2].trim() });
  }
  return out.length >= 2 ? out : [];
}

/**
 * Which party members an option helps: a "<Tier> License" helps everyone with a class still to reach in
 * that tier, and an item helps whoever has it planned. `bands` and `items` come from the device's party
 * index for the route (src/lib/planner.ts, partyIndexRoute).
 */
export function helpsWho(gives: string, bands: Record<string, string[]> = {}, items: Record<string, string[]> = {}): string[] {
  const names = new Set<string>();
  const lic = gives.match(/\b([A-Z][a-z]+)\s+License\b/);
  if (lic) for (const [band, who] of Object.entries(bands)) if (band.toLowerCase().startsWith(lic[1].toLowerCase())) who.forEach((n) => names.add(n));
  const slug = gives.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const [key, who] of Object.entries(items)) if (key.endsWith(`.${slug}`)) who.forEach((n) => names.add(n));
  return [...names];
}
