// Fortune's Weave's classes (docs/blocks/classes.md): one entry per class, plus a header card for
// each tier saying what the tier takes. Matt chose "as much as we find" (2026-11-11), so this
// gathers what the guides had in the game's first weeks, in our own words:
//   * exam skill ranks, route and quest locks: gameoverdrive.com.br, "todas as classes e requisitos"
//   * class skills and how each class moves: Pocket Tactics, "Fire Emblem: Fortune's Weave classes"
//   * growth modifiers (added to a unit's own growths while in the class): KeenGamer, "Growth rates
//     for all characters and classes"
//   * mastery skills: allthings.how, "Class guide: all tiers and masteries"
//   * the secret classes' unlocks: our starter codex (src/data/content/fortunes-weave.ts)
// Where the guides disagree the entry is marked, for the community to settle in the Workshop.

import type { Entry, Route } from './types.ts';

const SOURCE = "Guides, Nov 2026: gameoverdrive.com.br (exam ranks, locks), Pocket Tactics (skills, movement), KeenGamer (growth modifiers), allthings.how (mastery skills); Fortune's Weave Codex (unlocks)";

function slug(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
}

/** The tiers, top of the ladder first, with what each takes. Their ids are the old tier cards'
 *  ("beginner-classes"...), so links to those keep opening the right tier. */
const TIERS: { tier: string; name: string; needs: string; about: string; spoiler?: boolean }[] = [
  { tier: 'Beginner', name: 'Beginner classes', needs: 'Level 5 · Renown 1 · Beginner License',
    about: "Every unit's first step. Each class's mastery skill adds +1 to its main stats." },
  { tier: 'Specialty', name: 'Specialty classes', needs: 'Level 20 · Renown 4 · Specialty License',
    about: 'Twelve classes, none of them secret.' },
  { tier: 'Advanced', name: 'Advanced classes', needs: 'Level 35 · Renown 8 · Advanced License',
    about: 'Eight open to everyone, nine more locked to a route, a quest or Part III. A class unlocked on one route opens on every route.' },
  { tier: 'Master', name: 'Master classes', needs: 'Level 45 · Part III', spoiler: true,
    about: 'Unlocked in Part III. Six of them need a god’s temple restored first.' },
  { tier: 'Divine', name: 'Divine classes', needs: 'Part III, fourth section · the five Keys of the Diadem', spoiler: true,
    about: 'Opened at the Diadem Temple. The exam needs S ranks and a 100% pass chance, and only one unit can hold each Divine class at a time.' },
];

type Moves = 'On foot' | 'Armored' | 'Riding' | 'Flying';
// Name, tier, how it moves (blank when no guide says), exam ranks ("Swords B, Bows C"), then growth
// modifiers: HP, Str, Mag, Spd, Dex, Def, Res, Lck, Cha.
type Row = [name: string, tier: string, moves: Moves | '', exam: string, growths: number[]];

const ROWS: Row[] = [
  ['Diviner', 'Beginner', 'On foot', 'White Magic D, Black Magic D', [5, -5, 15, 0, 5, -5, 10, 0, 0]],
  ['Gladiator', 'Beginner', 'On foot', 'Gauntlets D, Axes D, Swords D', [10, 10, 0, 0, 0, 0, 0, 0, 0]],
  ['Hunter', 'Beginner', 'On foot', 'Bows D, Swords D', [10, 0, 0, 10, 10, 0, 0, 0, 0]],
  ['Ornius Rider', 'Beginner', 'Riding', 'Riding E+, Axes D, Spears D', [10, 0, 0, 10, 5, 0, 5, 5, 0]],
  ['Soldier', 'Beginner', 'Armored', 'Axes D, Spears D', [10, 5, 0, -5, 5, 10, 0, 0, 0]],

  ['Archer', 'Specialty', 'On foot', 'Bows C', [10, 5, 0, 10, 10, 5, 0, 5, 5]],
  ['Armored Knight', 'Specialty', 'Armored', 'Armor E+, Axes C, Spears C', [10, 10, -5, -5, 5, 25, -5, 0, 5]],
  ['Armored Ornius Rider', 'Specialty', 'Riding', 'Riding D, Axes C, Spears C', [10, 0, -5, 10, 5, 10, 0, 5, 5]],
  ['Brigand', 'Specialty', 'On foot', 'Axes C, Swords C', [15, 15, -5, 5, 0, 5, 0, 0, 5]],
  ['Charioteer', 'Specialty', 'Riding', 'Riding D, Bows C', [10, 5, -5, -5, 15, 10, 0, 5, 10]],
  ['Light Cavalry', 'Specialty', 'Riding', 'Riding D, Spears C, Swords C', [10, 5, -5, 5, 0, 5, 0, 5, 10]],
  ['Myrmidon', 'Specialty', 'On foot', 'Swords C', [10, 0, 0, 15, 10, 0, 0, 5, 5]],
  ['Priest', 'Specialty', 'On foot', 'White Magic C', [5, -5, 10, 5, 5, -10, 15, 15, 10]],
  ['Pugilist', 'Specialty', 'On foot', 'Gauntlets C', [15, 10, -5, 10, 5, 10, 0, 0, 5]],
  ['Rogue', 'Specialty', 'On foot', 'Bows C, Swords C', [10, 0, 0, 15, 10, 0, 5, 5, 0]],
  ['Shaman', 'Specialty', 'On foot', 'Black Magic C', [5, -5, 15, 10, 10, -10, 10, 10, 0]],
  ['Wing Soldier', 'Specialty', 'Flying', 'Flying D, Spears C, Swords C', [10, 0, 5, 0, 5, 5, 5, 5, 10]],

  ['Bardinger', 'Advanced', 'Riding', 'Riding C, Spears B, Swords B', [10, 10, -5, 0, 0, 5, 10, 5, 10]],
  ['Bishop', 'Advanced', 'On foot', 'White Magic B', [10, -5, 15, 0, 0, -10, 20, 20, 10]],
  ['Blacksmith', 'Advanced', 'On foot', 'Black Magic D, Axes C', [15, 10, 10, 0, 5, 10, 10, 0, 5]],
  ['Caladrius', 'Advanced', 'Riding', 'Riding D, Black Magic B', [15, 0, 10, 5, 10, 10, 10, 5, 5]],
  ['Cataphract', 'Advanced', 'Riding', 'Armor E+, Riding D, Axes B, Spears B', [15, 15, -5, -10, 0, 10, -5, 0, 5]],
  ['Dancer', 'Advanced', 'On foot', 'Bows B, Swords B', [15, 5, 0, 25, 10, 0, 5, 10, 20]],
  ['Dragoon', 'Advanced', 'Flying', 'Flying C, Axes B, Spears B', [15, 5, 0, 0, 5, 10, 10, 10, 5]],
  ['Dreadnought', 'Advanced', 'Armored', 'Armor D, Axes B, Spears B', [15, 15, -5, -10, 5, 30, -10, 0, 5]],
  ['Elephant Rider', 'Advanced', 'Riding', 'Riding C', [20, 10, -5, 20, -10, 15, -5, 5, 10]],
  ['Forest Knight', 'Advanced', 'Riding', 'Riding D, Bows B', [10, 5, 0, 10, 10, 5, 5, 5, 5]],
  ['Guardian', 'Advanced', 'On foot', 'Spears B', [10, 10, 0, 0, 5, 10, 15, 5, 5]],
  ['Ovate', 'Advanced', 'On foot', 'Black Magic B', [10, -5, 20, 5, 15, -10, 15, 10, 0]],
  ['Ranger', 'Advanced', 'On foot', 'Bows B, Swords B', [10, 5, 0, 15, 15, 0, 10, 15, 0]],
  ['Shido', 'Advanced', 'On foot', 'Swords B', [10, 5, 0, 15, 10, 0, -5, 5, 5]],
  ['Sniper', 'Advanced', 'On foot', 'Bows B', [10, 5, 0, 10, 20, 5, 5, 5, 5]],
  ['Troubadour', 'Advanced', 'Riding', 'Riding D, Black Magic B, White Magic B', [10, 0, 15, 5, 0, 5, 15, 15, 10]],
  ['Warrior', 'Advanced', 'On foot', 'Gauntlets B, Axes B, Swords B', [20, 20, -5, 0, 0, 5, -5, 0, 5]],

  ['Battlemaster', 'Master', 'On foot', 'Gauntlets A, Axes A, Swords A', [25, 25, -5, -5, 5, 10, -5, -5, 5]],
  ['Bau Lord', 'Master', 'Flying', 'Flying C, Axes A, Spears A', [15, 5, 0, 5, 0, 10, 10, 10, 5]],
  ['Bow Adept', 'Master', 'On foot', 'Bows A', [15, 5, 0, 15, 20, 5, 5, 5, 5]],
  ['Bow Knight', 'Master', 'Riding', 'Riding D, Bows A', [10, 10, 0, 15, 10, 5, 0, 5, 5]],
  ['Castle Knight', 'Master', 'Armored', 'Armor C, Axes A, Spears A', [25, 20, -5, -15, 5, 30, -10, 0, 5]],
  ['Celestial Trooper', 'Master', 'Flying', 'Flying C, Spears A, Swords A', [15, 5, -5, 10, 5, 5, 15, 15, 10]],
  ['Druid', 'Master', 'On foot', 'Black Magic A', [10, -5, 30, 15, 10, -10, 20, 10, 0]],
  ['Great Knight', 'Master', 'Riding', 'Armor D, Riding D, Axes A, Spears A', [20, 20, -5, -10, 0, 15, -10, 0, 5]],
  ['High Savant', 'Master', 'Riding', 'Riding D, Black Magic D', [10, 15, 15, 10, 5, 5, 5, 5, 5]],
  ['Orichaldia', 'Master', 'Riding', 'Riding B, Spears A, Swords A', [15, 15, -5, 0, 5, 5, 5, 5, 10]],
  ['Sentinel', 'Master', 'On foot', 'Spears A', [15, 15, 0, 5, 5, 10, 15, 5, 5]],
  ['Shadow Seeker', 'Master', 'On foot', 'Bows A, Swords A', [15, 5, 0, 15, 25, 0, 10, 15, 0]],
  ['Swordmaster', 'Master', 'On foot', 'Swords A', [15, 10, 0, 20, 15, 0, 0, 5, 5]],
  ['Valkyrium', 'Master', 'Riding', 'Riding D, Black Magic A, White Magic A', [10, 0, 15, 5, 5, 5, 10, 15, 10]],
  ['War Monk', 'Master', 'On foot', 'White Magic D, Gauntlets B', [15, 10, 0, 15, 0, 5, 15, 5, 5]],
  ['Wiseman', 'Master', 'On foot', 'White Magic A', [10, -5, 20, 0, 5, -10, 25, 20, 10]],

  ['The Apsara', 'Divine', '', 'Swords A, Bows C', [15, 5, 10, 25, 15, 5, 5, 10, 30]],
  ['The Avatar', 'Divine', '', 'White Magic S, Black Magic S', [10, -5, 30, 10, 5, -5, 30, 20, 10]],
  ['The Blade', 'Divine', '', 'Gauntlets A, Axes A, Swords A', [15, 10, 10, 20, 20, 5, 5, 5, 10]],
  ['The Calamity', 'Divine', '', 'Bows S, Swords S', [15, 5, 15, 25, 20, 5, 15, 15, 5]],
  ['The Cavalier', 'Divine', '', 'Swords S, Spears S, Axes S', [20, 15, 5, 10, 10, 15, 10, 5, 15]],
  ['The Eternal', 'Divine', '', 'Axes S, Swords S, Gauntlets S', [30, 30, 0, 10, 0, 15, 0, 0, 0]],
  ['The Godhand', 'Divine', '', 'Gauntlets S, White Magic C', [15, 10, 10, 15, 5, 10, 15, 5, 10]],
  ['The Trident', 'Divine', '', 'Spears S', [15, 15, 5, 10, 10, 15, 15, 5, 10]],
];

/** Class skills (Pocket Tactics), one per line. */
const SKILLS: Record<string, string[]> = {
  Diviner: ['Magic Basics'],
  Gladiator: ['Attack Basics'],
  Hunter: ['Hunting Basics'],
  'Ornius Rider': ['Offense Basics', 'Mount/Dismount'],
  Soldier: ['Defense Basics'],
  Archer: ['Bow Hit +5', 'Combat Arts +1', 'Crescendo'],
  'Armored Knight': ['Combat Arts +1', 'Great Counter', 'Strike-Last Def +3'],
  'Armored Ornius Rider': ['Mount/Dismount', 'Sense Threat'],
  Brigand: ['Axe Hit +3', 'Combat Arts +1', 'Regroup'],
  Charioteer: ['Charger', 'Chariot Armor', "Charioteer's Path", 'Charioteer Tactics'],
  'Light Cavalry': ['Bolster Health', 'Mount/Dismount'],
  Myrmidon: ['Combat Arts +1', 'Ravaging Arts', 'Sword Crit +3'],
  Priest: ['Magic Heal +5', 'Piety', 'White-Magic Seeker'],
  Pugilist: ['Attack Get Back', 'Brawl Avo +3', 'Combat Arts +1'],
  Rogue: ['Combat Arts +1', 'In Shadow', 'Locktouch', 'Search'],
  Shaman: ['Bind Dexterity', 'Black-Magic Seeker', 'Magic Hit +3'],
  'Wing Soldier': ['Mount/Dismount', 'Protecting Wings'],
  Bardinger: ['Aegis', 'Combat Arts +2', 'Mount/Dismount'],
  Bishop: ['Barrier', 'Magic Heal +10', 'White-Magic Seeker'],
  Blacksmith: ['Makeshift', 'Black-Magic Seeker', 'Axe Hit +5'],
  Caladrius: ['Black-Magic Seeker', 'Combat Arts +1', 'Mount/Dismount', 'Overtake'],
  Cataphract: ['Combat Arts +1', 'Mount/Dismount'],
  Dancer: ['Special Dance', 'Combat Arts +2', 'Dance'],
  Dragoon: ['Besieger', 'Mount/Dismount', 'Combat Arts +1'],
  Dreadnought: ['Combat Arts +2', 'Focused Counter', 'Strike-Last Def +5'],
  'Elephant Rider': ['Elephant Vanguard', 'War-Elephant Boots', 'Elephant Tactics', "Elephant Rider's Path"],
  'Forest Knight': ['Bow Hit +5', 'Combat Arts +1', "Hunter's Eye", 'Mount/Dismount'],
  Guardian: ['Combat Arts +2'],
  Ovate: ['Bind Speed', 'Black-Magic Seeker', 'Magic Hit +5'],
  Ranger: ['Countershot', 'Combat Arts +2', 'Locktouch', 'Advanced Search'],
  Shido: ['Combat Arts +2', 'Ever Vigilant', 'Sword Crit +5'],
  Sniper: ['Bow Hit +10', 'Combat Arts +2', 'Marksmanship'],
  Troubadour: ['Magic Heal +5', 'Magic Hit +3', 'Mount/Dismount'],
  Warrior: ['Axe Hit +5', 'Brawl Hit +5', 'Combat Arts +2', 'Practiced Art'],
  Swordmaster: ['Astra', 'Combat Arts +3', 'Sword Crit +7'],
  'High Savant': ['Combat Arts +2', 'Mount/Dismount', 'Black-Magic Seeker'],
  Battlemaster: ["War Master's Strike", 'Combat Arts +3', 'Axe Hit +7', 'Brawl Hit +7'],
  'War Monk': ['White-Magic Seeker', 'Combat Arts +3'],
  'Bow Adept': ['Sky Hunter', 'Combat Arts +3', 'Bow Hit +15'],
  'Bow Knight': ["Hunter's Cross", 'Combat Arts +2', 'Mount/Dismount', 'Bow Hit +10'],
  'Shadow Seeker': ['Dropshadow Blade', 'Locktouch', 'Combat Arts +3', 'Master Search'],
  Sentinel: ['Resolute Stance', 'White-Magic Seeker', 'Magic Heal +10', 'Combat Arts +3'],
  'Castle Knight': ['Intercept', 'Combat Arts +3', 'Strike-Last Def +7'],
  Orichaldia: ['Fierce Spear', 'Mount/Dismount', 'Combat Arts +3'],
  'Great Knight': ['Fierce Shield', 'Combat Arts +2', 'Mount/Dismount'],
  'Celestial Trooper': ['Lightning Reflexes', 'Mount/Dismount', 'Combat Arts +1', 'Flying Avo +7'],
  'Bau Lord': ['Ambush', 'Combat Arts +2', 'Mount/Dismount'],
  Druid: ['Bind Resistance', 'Black-Magic Seeker', 'Magic Hit +7'],
  Wiseman: ['Dominate Magic', 'White-Magic Seeker', 'Magic Heal +15'],
  Valkyrium: ['Mount/Dismount', 'Magic Heal +10'],
};

/** Mastery skills, kept for good once a unit masters the class: "Name: what it does", in our words.
 *  From allthings.how, and our codex for the secret classes. */
const MASTERY: Record<string, string> = {
  Archer: 'Crescendo: +3 Hit for each foe defeated, up to +30, for the rest of the battle',
  'Armored Knight': 'Great Counter: Atk +3 when the foe attacks first',
  'Armored Ornius Rider': 'Sense Threat: Avo +20 against foes effective against this unit',
  Rogue: 'In Shadow: Avo +10 in the next fight after a defeat',
  Warrior: 'Practiced Art: Hit +10 when attacking with a combat art',
  Sniper: 'Marksmanship: Hit +15 with a bow equipped',
  Ranger: 'Countershot: 50% chance to counter adjacent foes with a bow',
  Dragoon: 'Besieger: Hit +20 when the foe stands on favorable terrain',
  Blacksmith: 'Makeshift: 10% chance a combat art uses no durability',
  Shido: 'Ever Vigilant: restores some HP after a critical hit that defeats a foe',
  Dreadnought: 'Focused Counter: Hit +10 when the foe attacks first',
  Caladrius: 'Overtake: Mov +1 for each defeat, up to +3, until the end of the next turn',
  Dancer: 'Special Dance',
  Troubadour: 'Song of Courage',
  Guardian: 'Brace',
  Cataphract: 'Pavise',
  Swordmaster: 'Astra: five strikes at half damage',
  Battlemaster: "War Master's Strike: damage × 1.5",
  'War Monk': 'Strike and Heal: use assist magic after a fight',
  'Bow Adept': 'Sky Hunter: Hit +50 against fliers, Mt +7, range 2',
  'Bow Knight': "Hunter's Cross: Mt +8, Hit +20, Crit +10, range 2",
  'Shadow Seeker': "Dropshadow Blade: ignores the foe's favorable terrain",
  Sentinel: 'Resolute Stance: a shield, only at full HP',
  'Castle Knight': 'Intercept: takes 5 less damage when attacked (10 against a foe that doubles)',
  Orichaldia: "Fierce Spear: the foe can't make a follow-up attack",
  'Celestial Trooper': 'Lightning Reflexes: a follow-up lands before the counter with 10+ more Attack Speed than the foe',
};

/** How to unlock a class beyond its tier's License and exam: routes, quests, temples, items. */
const UNLOCK: Record<string, string> = {
  Dancer: 'Leda: Ch 9, "Great Dancer\'s Successor": deliver a Hingosh from Baina Oasis.',
  Ranger: 'Leda: finish "Elegant Drink Recipes".\nDietrich: win the Dread Warrior battles (two guides list this; our codex doesn\'t).',
  Troubadour: 'Cai: Bertrand\'s mentoring, "White-Maned Demon\'s Request" (Renown 10).\nLeda: finish "Elegant Drink Recipes".',
  Caladrius: 'Cai: Castor\'s mentoring, "Special Request from Pop" (Renown 7): deliver 2 Angelica.',
  Dragoon: 'Cai: Aurora\'s mentoring, "Special Request from Mom" (Renown 8).\nTheodora: Send Supplies of Lir Fish and Sea-Star Stone (Ch 11).',
  Guardian: 'Dietrich: beat Il-Lara, the Dread Warrior (Ch 9).\nTheodora: Send Supplies of Roca and Kothar Gar (Ch 9).',
  Cataphract: 'Theodora: Send Supplies of Ladon Loach and Steel Fish (Ch 9).',
  Blacksmith: "Dietrich: reach Smyrnos's Blessing level 1 and Renown 8 (Polygon), or enhance ten combat arts (Pocket Tactics).",
  'Elephant Rider': 'A Part III mission, and an Elephant License.',
  Swordmaster: "Restore Mars's Temple (Part III).",
  'High Savant': "Restore Smyrnos's Temple (Part III).",
  'War Monk': "Restore Aurora's Temple (Part III).",
  'Bow Knight': "Restore Kalla's Temple (Part III).",
  'Great Knight': "Restore Credna's Temple (Part III).",
  Valkyrium: "Restore Jurah's Temple (Part III).",
  'The Apsara': "The Muses' Necklace, as well as the Keys of the Diadem.",
};

const ROUTES: Record<string, Route[]> = {
  Dancer: ['leda'], Ranger: ['dietrich', 'leda'], Troubadour: ['cai', 'leda'], Caladrius: ['cai'], Dragoon: ['cai', 'theodora'],
  Guardian: ['dietrich', 'theodora'], Cataphract: ['theodora'], Blacksmith: ['dietrich'],
};

const WHO: Record<string, string> = { 'Wing Soldier': 'Women only' };

/** Where guides disagree or only one says so. */
const FLAGS: Record<string, 'unconfirmed' | 'disputed'> = {
  Blacksmith: 'disputed', // two different unlocks
  Ranger: 'unconfirmed', // Dietrich's unlock is only in two guides
  Guardian: 'disputed', // its skills differ between our codex (Brace) and Pocket Tactics
  Cataphract: 'disputed', // the same (Pavise against Besieger)
  'The Apsara': 'unconfirmed',
};

const GROWTH_KEYS = ['hp', 'str', 'mag', 'spd', 'dex', 'def', 'res', 'lck', 'cha'];

/** "Swords B, Bows C" as list lines, "Swords: B". */
const examLines = (exam: string) => exam.split(',').map((p) => p.trim().replace(/\s+(\S+)$/, ': $1')).join('\n');

export function classEntries(): Entry[] {
  const headers: Entry[] = TIERS.map((t, i) => ({
    id: slug(t.name), name: t.name, header: true, order: i + 1,
    description: t.about,
    sections: [{ label: 'How to unlock', text: t.needs }],
    categories: { Tier: t.tier },
    source: SOURCE,
  }));
  const spoilerTier = new Set(TIERS.filter((t) => t.spoiler).map((t) => t.tier));
  const classes: Entry[] = ROWS.map(([name, tier, moves, exam, growths]) => ({
    id: slug(name), name,
    routes: ROUTES[name],
    // Part III classes stay hidden until the player shows spoilers.
    spoiler: spoilerTier.has(tier) || name === 'Elephant Rider' || undefined,
    flag: FLAGS[name],
    sections: [
      ['Exam needs', examLines(exam)],
      ['How to unlock', UNLOCK[name]],
      ['Who can take it', WHO[name] ?? (tier === 'Divine' ? 'One unit at a time' : undefined)],
      ['Mastery skill', MASTERY[name]],
      ['Skills', SKILLS[name]?.join('\n')],
    ].filter((s): s is [string, string] => !!s[1]).map(([label, text]) => ({ label, text })),
    categories: { Tier: tier, ...(moves ? { Moves: moves } : {}) },
    stats: Object.fromEntries(GROWTH_KEYS.map((k, i) => [k, growths[i]])),
    source: SOURCE,
  }));
  return [...headers, ...classes];
}
