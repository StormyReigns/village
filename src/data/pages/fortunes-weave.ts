// Fortune's Weave as Pages and Blocks, rebuilt from the 156 starter cards.

import { CARDS } from '../content/fortunes-weave.ts';
import type { Card, Route } from '../content/types.ts';
import type { Block, Entry, Page, Section } from './types.ts';
import { WEAPON_STATS, weapons } from './fortunes-weave-weapons.ts';
import { GROWTH_STATS, GROWTHS } from './fortunes-weave-growths.ts';
import { COMMON_FIELDS, ITEM_FIELDS, STATS, withCommon } from '../../lib/fields.ts';
import { DEFAULT_TIERS } from '../../lib/tiers.ts';

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
      stats: GROWTHS[c.content.name],
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

// Weapons live with the other weapons, in the stats table.
const isWeapon = (c: Card) => /weapon|sword/i.test(c.content.type ?? '');

function items(): Entry[] {
  return of('items').filter((c) => !isWeapon(c)).map((c) => ({
    ...base(c, c.content.name),
    sections: sections(['Where to get it', c.content.where], ['Used for', c.content.use]),
    categories: { Type: c.content.type || 'Other' },
  }));
}

function weaponItems(): Entry[] {
  return of('items').filter(isWeapon).map((c) => ({
    ...base(c, c.content.name),
    sections: sections(['Where to get it', c.content.where], ['Used for', c.content.use], ['Note', /1\.01/.test(c.content.type ?? '') ? 'Added in update 1.01.' : undefined]),
    categories: { Rank: 'Unlisted' },
  }));
}

/** A place's Group (docs/blocks/world.md), read only from its name; none rather than a guess.
 *  The live places got theirs from supabase/migrations/20261110120000_place_groups.sql. */
function placeGroup(name: string) {
  if (name === 'Dagsion') return 'Town';
  return /Cave|Cavern/.test(name) ? 'Cave' : /Fort/.test(name) ? 'Fort' : /Mine/.test(name) ? 'Mine'
    : /Forest|Woods|Woodlands/.test(name) ? 'Forest' : /Isle$/.test(name) ? 'Island' : /Shrine/.test(name) ? 'Shrine' : undefined;
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
      categories: { Region: region ?? 'Hub', ...(placeGroup(c.content.name) ? { Group: placeGroup(c.content.name)! } : {}) },
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

/** "In short" for each starter guide: the gist, from what its steps already say. */
export const IN_SHORT: Record<string, string> = {
  'Recruit a unit': 'Give them a gift to unlock Recruit, then raise your Support with them and your Renown to what their card asks for your Flame Lord.',
  'Change class': 'Buy the license in Hightown and pass the Certification Exam next to the vendor. Go in with a pass chance of 75% or more.',
  'Earn Temple Blessings': "Send up to two units to Temple Service at Temple Row, best on a god's holy day, then equip up to four Blessings.",
  'Carry progress between routes': 'Finish one route before starting the next: your map, finished subquests, Blessings, supports and Boons carry over.',
  "Find Dagsion's services": 'Classes and the temple are in Hightown, the Headhunter in Midtown, the Tavern, Stable and trading in Lowtown, and Temple Service on Temple Row.',
};

function howtos(): Entry[] {
  return of('howto').map((c) => ({
    ...base(c, c.content.name),
    description: IN_SHORT[c.content.name],
    sections: sections(['Steps', c.content.steps], ['Tip', c.content.tip]),
    categories: {},
  }));
}

const block = (b: Omit<Block, 'id'>): Block => ({ id: slug(b.title), ...b });

/** A simple symbol per faction, picked from its name (our own icons, not the game's crests). */
/** The common character fields, plus each unit's group, and the names our starter cards already
 *  use. The chart holds stat growths (fortunes-weave-growths.ts). */
const UNIT_FIELDS = [
  { key: 'Group', label: 'Group', kind: 'tag' as const },
  ...COMMON_FIELDS.map((f) => (f.key === 'How to recruit' ? { ...f, key: 'Recruit' } : f.key === 'Likes and gifts' ? { ...f, key: 'Likes', off: false }
    : f.key === STATS ? { ...f, label: 'Stat growths' } : f)),
];

const FACTIONS: Record<string, string> = {
  "Promised One's Army": 'Star',
  'Ribeira Winds': 'Wind',
  'House Lamine': 'Castle',
  "Megaira's Beacon": 'Lighthouse',
  'Rose Tempest': 'Flower2',
  'Fiery Mane': 'Flame',
  'Tale of the Moon': 'Moon',
  'Linaria Dewdrops': 'Droplet',
  'Bridal Party of the Pale Raven': 'Bird',
  'Kingdom of Arago': 'Crown',
  'Clan leader': 'Tent',
  'Temple Army': 'Landmark',
  Unaffiliated: 'Compass',
};

/** Items: the common item fields, with the names our starter cards already use ("Used for"). */
const ITEMS_FIELDS = ITEM_FIELDS.map((f) => (f.key === 'What it does' ? { ...f, key: 'Used for', label: 'Used for' } : f));

/** Weapons and magic: Rank and the four numbers on the tile; the effect, notes and where to get it in the full view. */
const WEAPON_FIELDS = withCommon([
  { key: 'Rank', label: 'Rank', kind: 'tag', tile: true },
  { key: STATS, label: 'Stats', kind: 'chart', tile: true, noWeb: true },
  { key: 'Effect', label: 'What it does', kind: 'longtext' },
  { key: 'Note', label: 'Note', kind: 'longtext' },
  { key: 'Where to get it', label: 'Where to get it', kind: 'list' },
  { key: 'Used for', label: 'Used for', kind: 'longtext' },
], 'items');

/** A symbol for each kind of item. */
const ITEM_TYPES: Record<string, string> = {
  'Key item': 'KeyRound',
  Material: 'Gem',
  'Quest item': 'ScrollText',
  License: 'BadgeCheck',
  Resource: 'Sparkles',
};

export const PAGES: Page[] = [
  {
    id: 'units', title: 'Units', short: 'Units', icon: 'Users', tint: 'berry',
    blurb: "Who can join your army, how to recruit them, and who's worth a spot.",
    blocks: [
      block({ type: 'characters', title: 'Units', icon: 'Users', filters: ['Group'], byRoute: true, entries: units(), symbols: FACTIONS, fields: UNIT_FIELDS, stats: GROWTH_STATS,
        intro: 'Pick your Flame Lord to see who can join you and what it takes.' }),
      // A Tier list ranks the Units above (docs/blocks/tier-lists.md). Builders can rename the tiers later.
      block({ type: 'tierlist', title: 'Unit tiers', icon: 'Trophy', entries: [], tierSetup: { ranks: 'units', tiers: DEFAULT_TIERS },
        intro: "Who's worth a spot in your army, across the whole game? Rank them in My list, and the community list is everyone's lists together." }),
    ],
  },
  {
    // Moved off Units onto a Page of its own (Matt, 2026-11-11); indigo is the seventh Page color.
    id: 'classes', title: 'Classes', short: 'Classes', icon: 'Shield', tint: 'indigo',
    blurb: 'Every class, its tier, and how to reach it.',
    blocks: [
      block({ type: 'collection', look: 'slots', title: 'Classes', icon: 'Shield', filters: ['Tier'], entries: classes() }),
    ],
  },
  {
    id: 'items', title: 'Items', short: 'Items', icon: 'Backpack', tint: 'sun',
    blurb: 'Key items, materials, weapons and magic: where to find them and how they compare.',
    blocks: [
      block({ type: 'items', title: 'Items', icon: 'Backpack', filters: ['Type'], symbols: ITEM_TYPES, fields: ITEMS_FIELDS, entries: items(),
        intro: 'What each one is for and where to find it. Tap one for the details.' }),
      block({ type: 'items', title: 'Weapons and magic', icon: 'Swords', filters: ['Rank'], stats: WEAPON_STATS, fields: WEAPON_FIELDS, entries: [...weapons(), ...weaponItems()],
        intro: 'The stronger the color, the better the number. Compare puts every number side by side.' }),
    ],
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
      block({ type: 'collection', look: 'map', title: 'Dungeons and places', icon: 'MapPin', filters: ['Region', 'Group'], statName: 'Level', entries: places() }),
      block({ type: 'collection', look: 'rows', title: 'Foes', icon: 'Swords', byRoute: true, entries: foes() }),
    ],
  },
  {
    id: 'guides', title: 'Guides', short: 'Guides', icon: 'BookOpen', tint: 'leaf',
    blurb: "How the game's systems work, and the questions nobody has answered yet.",
    blocks: [
      block({ type: 'guide', title: 'How to', icon: 'BookOpen', entries: howtos() }),
    ],
  },
];
