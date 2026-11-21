import type { Entry, Route } from '@/data/pages';
import { bandOf, bandOrder, choiceFor, classShape, rankLine } from '@/lib/classes';
import { aboutParts } from '@/lib/fields';
import type { Source } from '@/lib/planner';
import { onRoute } from '@/components/app/entries';

// The Classes Block as a Planner reads it (docs/blocks/planner.md): its tiers in ladder order, which
// tiers are spoilers, each class's tier and exam. Built from the Classes Block's own shape
// (src/lib/classes.ts), so it works for any game's ladder.

export interface ClassLadder {
  bands: string[];
  /** Tiers hidden as spoilers (Master, Divine). */
  spoilerBands: Set<string>;
  byId: Map<string, Entry>;
  /** Classes (not header cards) in a tier, on the player's route. */
  inBand: (band: string) => Entry[];
  bandOf: (e: Entry) => string;
  /** "Swords B · Bows B", or '' when the Block has no skill ranks. */
  exam: (e: Entry) => string;
  /** What a tier takes ("Level 20 · Renown 4 · Specialty License"): its list choice's first line, else its header card's. */
  needs: (band: string) => string;
}

export function ladderOf(src: Source | undefined, route: Route | 'all'): ClassLadder | undefined {
  if (!src) return undefined;
  const shape = classShape(src.block);
  if (!shape.band) return undefined;
  const all = src.block.entries;
  const classes = all.filter((e) => !e.header);
  const bands = bandOrder(all, shape.band, shape.choices);
  if (!bands.length) return undefined;
  return {
    bands,
    // A tier is a spoiler when its card is one, or every class in it is (Master and Divine, Part III).
    spoilerBands: new Set(bands.filter((band) => all.some((e) => e.header && e.spoiler && bandOf(e, shape.band) === band)
      || (classes.some((e) => bandOf(e, shape.band) === band) && classes.every((e) => bandOf(e, shape.band) !== band || e.spoiler)))),
    byId: new Map(classes.map((e) => [e.id, e])),
    inBand: (band) => classes.filter((e) => bandOf(e, shape.band) === band && onRoute(e, route)).sort((a, b) => a.name.localeCompare(b.name)),
    bandOf: (e) => bandOf(e, shape.band),
    exam: (e) => rankLine(e, shape.ranks),
    needs: (band) => {
      const fromList = aboutParts(choiceFor(band, shape.choices)?.about).short;
      if (fromList) return fromList;
      const card = all.find((e) => e.header && bandOf(e, shape.band) === band);
      const text = card?.sections.find((x) => /unlock|need|require/i.test(x.label))?.text ?? card?.description ?? '';
      return text.split('\n')[0].trim();
    },
  };
}
