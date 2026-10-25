// Fortune's Weave as Pages and Blocks, rebuilt from the 156 starter cards.

import { CARDS } from '../content/fortunes-weave.ts';
import type { Card, Route } from '../content/types.ts';
import type { Block, Entry, Page, Section } from './types.ts';

const ROUTE_NAMES: Record<string, Route> = { Cai: 'cai', Dietrich: 'dietrich', Theodora: 'theodora', Leda: 'leda' };

function slug(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
}

/** Pulls "Cai: …" style lines out of a text into per-route sections; returns the rest. */
function splitRoutes(text: string, label: string): { rest: string; perRoute: Entry['perRoute'] } {
  const perRoute: Entry['perRoute'] = {};
  const rest: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^(Cai|Dietrich|Theodora|Leda): (.*)$/);
    if (m) perRoute[ROUTE_NAMES[m[1]]] = [{ label, text: m[2] }];
    else if (line.trim()) rest.push(line);
  }
  return { rest: rest.join('\n'), perRoute: Object.keys(perRoute).length ? perRoute : undefined };
}

const sections = (...pairs: [string, string | undefined][]): Section[] =>
  pairs.filter(([, t]) => t && t.trim()).map(([label, text]) => ({ label, text: text!.trim() }));

/** Every route means "no route limit", so it isn't stored. */
function routesOf(c: Card) {
  return c.routes && c.routes.length < 4 ? c.routes : undefined;
}

function base(c: Card, name: string): Omit<Entry, 'sections' | 'categories'> {
  return { id: slug(name), name, routes: routesOf(c), spoiler: c.spoiler, flag: c.flag, source: c.source };
}

const of = (block: string) => CARDS.filter((c) => c.block === block);

function units(): Entry[] {
  return of('people').map((c) => {
    const { rest, perRoute } = splitRoutes(c.content.how ?? '', 'Recruit');
    const lines = rest.split('\n').filter((l) => !/^Every recruit starts/.test(l));
    return {
      ...base(c, c.content.name),
      description: lines.join(' '),
      sections: sections(['Likes', c.content.likes]),
      categories: { Group: (c.content.joins ?? '').replace(/\s*\(.*\)$/, '') || 'Unaffiliated' },
      perRoute,
    };
  });
}

function classes(): Entry[] {
  return of('builds').map((c) => {
    const tier = /^(Beginner|Specialty|Advanced|Master)/.exec(c.content.name)?.[1] ?? 'Secret';
    return {
      ...base(c, c.content.name),
      description: c.content.why,
      sections: sections([tier === 'Secret' ? 'Where' : 'Requires', c.content.for], [tier === 'Secret' ? 'Path' : 'Classes', c.content.path]),
      categories: { Tier: tier },
    };
  });
}

function story(): Entry[] {
  return of('progress').map((c) => ({
    ...base(c, c.content.name),
    description: c.content.summary,
    sections: [],
    categories: {},
    order: Number(c.content.order ?? 0),
  }));
}

function missables(): Entry[] {
  return of('missables').map((c) => {
    const { rest, perRoute } = splitRoutes(c.content.before ?? '', 'Before');
    return {
      ...base(c, c.content.what),
      description: c.content.how,
      sections: sections(['Before', rest]),
      categories: {},
      perRoute,
    };
  });
}

function items(): Entry[] {
  return of('items').map((c) => ({
    ...base(c, c.content.name),
    sections: sections(['Where to get it', c.content.where], ['Used for', c.content.use]),
    categories: { Type: c.content.type || 'Other' },
  }));
}

function places(): Entry[] {
  return of('places').map((c) => {
    const unlock = c.content.unlock ?? '';
    const region = /^([A-Z][\w' ]+)\. /.exec(unlock)?.[1];
    const rest = region ? unlock.slice(region.length + 2) : unlock;
    const level = /Suggested level (\d+)\.\s*/.exec(rest);
    return {
      ...base(c, c.content.name),
      description: level ? rest.replace(level[0], '').trim() : rest,
      stat: level ? `Lv ${level[1]}` : undefined,
      sections: sections(["What's there", c.content.notable]),
      categories: { Region: region ?? 'Hub' },
    };
  });
}

function foes(): Entry[] {
  return of('foes').map((c) => ({
    ...base(c, c.content.name),
    description: c.content.tips,
    stat: c.content.where || undefined,
    sections: sections(['Weak to', c.content.weak]),
    categories: {},
  }));
}

function howtos(): Entry[] {
  return of('howto').map((c) => ({
    ...base(c, c.content.name),
    sections: sections(['Steps', c.content.steps], ['Tip', c.content.tip]),
    categories: {},
  }));
}

function mysteries(): Entry[] {
  return of('mysteries').map((c) => ({
    ...base(c, c.content.name),
    description: c.content.known,
    stat: c.content.status || 'Open',
    sections: [],
    categories: { Status: c.content.status || 'Open' },
  }));
}

const block = (b: Omit<Block, 'id'>): Block => ({ id: slug(b.title), ...b });

export const PAGES: Page[] = [
  {
    id: 'units-and-classes', title: 'Units and classes', short: 'Units', icon: 'Users', tint: 'berry',
    blurb: 'Who can join your army, how to recruit them, and every class tier.',
    blocks: [
      block({ type: 'collection', look: 'portraits', title: 'Units', icon: 'Users', filters: ['Group'], byRoute: true, entries: units(),
        intro: 'Pick your Flame Lord to see who can join you and what it takes.' }),
      block({ type: 'collection', look: 'slots', title: 'Classes', icon: 'Shield', filters: ['Tier'], entries: classes() }),
    ],
  },
  {
    id: 'items', title: 'Items', short: 'Items', icon: 'Backpack', tint: 'sun',
    blurb: 'Key items, materials and gear: where to find them and what they do.',
    blocks: [block({ type: 'collection', look: 'slots', title: 'Items', icon: 'Backpack', filters: ['Type'], entries: items() })],
  },
  {
    id: 'last-chances', title: 'Last chances', short: 'Last chances', icon: 'Hourglass', tint: 'plum',
    blurb: "Things you can miss forever, and the deadline for each. Tick them off as you go.",
    blocks: [block({ type: 'checklist', title: 'Last chances', icon: 'Hourglass', byRoute: true, entries: missables() })],
  },
  {
    id: 'story', title: 'Story', short: 'Story', icon: 'Flag', tint: 'sky',
    blurb: 'The parts of the story in order, kept spoiler-light.',
    blocks: [block({ type: 'timeline', title: 'Story', icon: 'Flag', byRoute: true, entries: story() })],
  },
  {
    id: 'world', title: 'World', short: 'World', icon: 'MapPin', tint: 'teal',
    blurb: 'Dungeons and places worth visiting, and the foes waiting in them.',
    blocks: [
      block({ type: 'collection', look: 'rows', title: 'Dungeons and places', icon: 'MapPin', filters: ['Region'], statName: 'Level', entries: places() }),
      block({ type: 'collection', look: 'rows', title: 'Foes', icon: 'Swords', byRoute: true, entries: foes() }),
    ],
  },
  {
    id: 'guides', title: 'Guides', short: 'Guides', icon: 'BookOpen', tint: 'leaf',
    blurb: "How the game's systems work, and the questions nobody has answered yet.",
    blocks: [
      block({ type: 'guide', title: 'How to', icon: 'BookOpen', entries: howtos() }),
      block({ type: 'collection', look: 'rows', title: 'Mysteries', icon: 'CircleHelp', filters: ['Status'], entries: mysteries(),
        intro: "Open questions. Found the answer? Bring it to the Workshop." }),
    ],
  },
];
