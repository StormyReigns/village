// Starter cards for Fire Emblem: Fortune's Weave.
//
// Condensed and reworded from the "Fortune's Weave Codex" (Sept 18, 2026), which drew on
// Game8, RPG Site, Polygon, IGN, the Fire Emblem fan wikis and GameFAQs in the game's first
// days. Everything here starts as unverified: it's the community's job to confirm or fix
// it in the Workshop. Entries the codex flagged are marked `unconfirmed` or `disputed`.

import type { Card, Route } from './types';

const SOURCE = "Fortune's Weave Codex (Sept 18, 2026): Game8, RPG Site, Polygon, IGN, fan wikis";
const ALL: Route[] = ['cai', 'dietrich', 'theodora', 'leda'];

/** Recruit conditions for each Flame Lord. "3/9" means Support level 3 and Renown 9. */
function per(c: string, d: string, t: string, l: string): string {
  const fmt = (s: string) => (s === '—' ? "can't recruit" : s === 'auto' ? 'joins automatically' : s.replace(/^(\d)\/(\d+)/, 'Support $1, Renown $2'));
  return [`Cai: ${fmt(c)}`, `Dietrich: ${fmt(d)}`, `Theodora: ${fmt(t)}`, `Leda: ${fmt(l)}`].join('\n');
}
function routesOf(c: string, d: string, t: string, l: string): Route[] {
  return ALL.filter((_, i) => [c, d, t, l][i] !== '—');
}

type UnitRow = [name: string, joins: string, perRoute: [string, string, string, string] | null, extra: string, likes?: string, meta?: Partial<Card>];

const UNITS: UnitRow[] = [
  // Promised One's Army
  ['Eshmel', "Promised One's Army", null, 'Your avatar (male or female), created in the Prologue. "Descend Again" lets you remake them and change difficulty.', '', { routes: ALL }],
  ['Hong Hua', "Promised One's Army", null, 'Joins automatically in the Prologue, and again in Part III.', '', { routes: ALL }],
  ['Troy', "Promised One's Army", null, 'Joins automatically in the Prologue, and again in Part III.', '', { routes: ALL }],
  // Ribeira Winds
  ['Cai', "Ribeira Winds (Cai's house)", null, "Flame Lord of the Fox Obelisk. Leads Cai's Path.", '', { routes: ['cai'] }],
  ['Tialla', 'Ribeira Winds', ['auto', '3/9', '3/10', '3/8'], "Off-route: clear Cai's Paralogue, then pay 3,000G."],
  ['Peter', 'Ribeira Winds', ['auto', '3/8', '3/7', '3/10'], 'Off-route: finish his request quest. Game8 lists a hard negotiation instead.', '', { flag: 'disputed' }],
  ['Ultand', 'Ribeira Winds', ['auto (Ch 6)', '3/5', '3/6', '3/8'], 'Off-route: finish her request quest. Birthday 4/28.', 'Eastern Love Story'],
  ['Castor', 'Ribeira Winds', null, "Cai's father. Only playable in limited situations.", '', { routes: ['cai'], flag: 'unconfirmed' }],
  // House Lamine
  ['Dietrich', "House Lamine (Dietrich's house)", null, 'Flame Lord of the Lion Obelisk. Wields Answerer, tied to the Crest of Lamine.', '', { routes: ['dietrich'] }],
  ['Fabio', 'House Lamine', ['—', 'auto', '—', '3/9'], "Leda only: clear Dietrich's Paralogue, wait until Dietrich's team is knocked out of the tournament (around Ch 12), then give him a suitable item. One tester used a Da Mina weapon.", '', { spoiler: true }],
  ['Esmeralda', 'House Lamine', ['3/7', 'auto', '3/9', '3/6'], 'Off-route: finish her request.'],
  ['Mikaela', 'House Lamine', ['3/5', 'auto', '3/8', '3/6'], 'Off-route: pay 3,000G.', 'Flexible Fishing Rod, Mane Ornament, Sturdy Rucksack'],
  // Megaira's Beacon
  ['Theodora', "Megaira's Beacon (Theodora's house)", null, 'Flame Lord of the Wolf Obelisk.', '', { routes: ['theodora'] }],
  ['Bonaventure', "Megaira's Beacon", null, "Only on Theodora's route.", '', { routes: ['theodora'] }],
  ['Tobias', "Megaira's Beacon", null, "Only on Theodora's route.", '', { routes: ['theodora'] }],
  ['Lysander', "Megaira's Beacon", ['3/8', '3/6', 'auto', '3/7'], 'Off-route: deliver 5 Iron Spears (RPG Site, Polygon). Game8 says a hard negotiation.', '', { flag: 'disputed' }],
  ['Lilian', "Megaira's Beacon", ['2/8', '2/8', 'auto', '2/7'], 'Off-route: pay 5,000G.'],
  // Rose Tempest
  ['Leda', "Rose Tempest (Leda's house)", null, 'Flame Lord of the Eagle Obelisk.', '', { routes: ['leda'] }],
  ['Buccar', 'Rose Tempest', ['—', '3/8', '3/8', 'auto'], "Off-route: clear Leda's Paralogue. Cai can't recruit him."],
  ['Sirocco', 'Rose Tempest', ['3/9', '3/9', '1/5', 'auto'], 'Off-route: finish his request. Game8 says give him a copy of the Bard\'s Monument.', '', { flag: 'disputed' }],
  ['Mu', 'Rose Tempest', ['3/9', '3/7', '3/9', 'auto'], "Off-route: deliver 3 Glirmosa, found on Mount Orgus Trail, Rear Mountain Path, Forest of No Return and Giant's Mount (Pasithea). Game8 lists a moderate negotiation.", '', { flag: 'disputed' }],
  ['Olympia', 'Rose Tempest', ['3/8', '3/6', '3/9', 'auto'], 'Off-route: finish 3 request quests. Game8 says give her Scarlet Drops.', '', { flag: 'disputed' }],
  ['Maria', 'Rose Tempest', null, 'Only playable in limited situations.', '', { routes: ['leda'], flag: 'unconfirmed' }],
  // Fiery Mane
  ['Bertrand', 'Fiery Mane', null, "Guest in Part II, joins fully in Part III. Clear Bertrand's Paralogue in Part I to be safe.", '', { routes: ALL, spoiler: true }],
  ['Gaitz', 'Fiery Mane', ['—', '3/10', '—', '—'], "Dietrich only: clear Bertrand's Paralogue, then wait until Bertrand's team is eliminated (around Ch 12).", '', { spoiler: true }],
  ['Dante', 'Fiery Mane', ['3/10', '2/8', '3/6', '3/10'], 'Pay 8,000G.'],
  ['Goliath', 'Fiery Mane', ['3/7', '3/6', '3/9', '3/10'], "Deliver 3 Giant's Meat. A giant always appears in Sand-Shadow Fort, and giant-icon skirmishes drop it too."],
  ['Jester', 'Fiery Mane', ['3/10', '3/6', '3/9', '3/10'], 'Finish 3 request quests. Game8 calls it a challenging negotiation.', '', { flag: 'disputed' }],
  // Tale of the Moon
  ['Talimun', 'Tale of the Moon', null, "Joins automatically early in Part III. Clear Talimun's Paralogue in Part I to be safe.", '', { routes: ALL, spoiler: true }],
  ['Ursula', 'Tale of the Moon', ['3/10', '3/7', '3/9', '—'], 'Clear Talimun\'s Paralogue, then answer "Yes" three times. Leda can\'t recruit her. She runs the Storage feature.'],
  ['Simon', 'Tale of the Moon', ['3/8', '3/7', '3/7', '3/6'], 'He flips a coin: pick Tails.'],
  ['Ludia', 'Tale of the Moon', ['3/9', '3/9', '3/7', '3/7'], 'Finish her request.'],
  ['Fianna', 'Tale of the Moon', ['3/8', '3/7', '3/9', '3/5'], 'Pay 3,000G.'],
  // Linaria Dewdrops
  ['Orchel', 'Linaria Dewdrops', null, "Joins automatically early in Part III. Clear Orchel's Regret in Part I to be safe.", '', { routes: ALL, spoiler: true }],
  ['Diego', 'Linaria Dewdrops', ['3/10', '3/9', '2/8', '3/8'], "Clear Orchel's Regret, the only paralogue open on all four routes."],
  ['Ninae', 'Linaria Dewdrops', ['3/6', '3/8', '3/6', '3/6'], 'Deliver 1 Paradise Fish. Easiest at Lake Brontes in Saveilon, past Valhalla Mine.', 'Eastern Black Silk'],
  ['Seteth', 'Linaria Dewdrops', ['3/6', '—', '3/6', '3/10'], "Finish his request. Dietrich can't recruit him."],
  ['Loretta', 'Linaria Dewdrops', ['3/7', '3/9', '3/5', '3/5'], 'Deliver 3 Iron Swords.'],
  // Bridal Party of the Pale Raven
  ['Anatolia', 'Bridal Party of the Pale Raven', null, "Joins automatically early in Part III. Clear Anatolia's Paralogue in Part I to be safe. Runs the weekly fortune-telling booth in east Midtown.", '', { routes: ALL, spoiler: true }],
  ['Sha Lan', 'Bridal Party of the Pale Raven', ['—', '3/10', '—', '3/8'], "Clear Anatolia's Paralogue, then answer her questions: Saramis, Da Mina, Grounded Ship."],
  ['Nezha', 'Bridal Party of the Pale Raven', ['3/6', '3/10', '2/6', '3/9'], 'Deliver 3 Sandworm Meat.'],
  ['Dadao', 'Bridal Party of the Pale Raven', ['3/7', '3/10', '2/5', '2/5'], 'Deliver 2 Kothar Gar.'],
  ['Halvin', 'Bridal Party of the Pale Raven', ['3/9', '3/9', '3/7', '3/7'], 'Deliver 10 Dates.', 'Potted Vegetables, Young Shosh, Gaudy Bangle'],
  ['Long', 'Bridal Party of the Pale Raven', null, "Listed as playable on the wiki. How to get Long isn't known yet.", '', { routes: ALL, flag: 'unconfirmed' }],
  // Kingdom of Arago (later joiners)
  ['Creek', 'Kingdom of Arago', null, "Joins in Part II, Ch 2 after you defeat him, but only if you finished \"My Late Sister's Accessory\" in Part I on that Flame Lord's route.", '', { routes: ALL, spoiler: true }],
  ['Nathan', 'Kingdom of Arago', null, 'Have Creek land the finishing blow on Nathan in Part II, Ch 3.', '', { routes: ALL, spoiler: true }],
  ['Aswan', 'Kingdom of Arago', null, 'Joins in Part III if Aswan survives as a guest in Part II, Ch 3.', '', { routes: ALL, spoiler: true }],
  ['Tahonia', 'Kingdom of Arago', null, 'Joins in Part III if Tahonia survives as a guest in Part II, Ch 3.', '', { routes: ALL, spoiler: true }],
  // Other clan leaders
  ['Benditz', 'Clan leader', ['3/9', '2/7', '1/8', '3/7'], 'Appears in Dagsion around 4/11.'],
  ['Alexandra', 'Clan leader', ['2/7', '3/8', '1/6', '3/10'], 'Appears around 5/29.'],
  ['Zarcone', 'Clan leader', ['3/8', '3/7', '1/4', '2/5'], 'Haggle his fee: refuse 10,000G and 1,000G, then pay 500G. One guide got him for 10G.'],
  ['Jasmine', 'Clan leader', ['1/8, 2,000G', '3/9, 5,000G', '3/8, 5,000G', '2/4, 500G'], 'Appears around 5/8.'],
  ['Kiroc', 'Clan leader', ['3/8, 8 Pure Water', '1/4, 3 Pure Water', '3/10, 8 Pure Water', '1/4, 3 Pure Water'], 'Appears around 5/4.'],
  ['Inyoni', 'Clan leader', ['3/8, 6,000G', '3/8, 6,000G', '1/9, 4,000G', '1/7, 3,000G'], 'Appears around 7/10.'],
  ['Peppe', 'Clan leader', ['1/9', '3/8', '2/7', '—'], "Clear Bertrand's Paralogue. Refuses to join Leda."],
  // Temple Army
  ['Centurio', 'Temple Army', null, 'Joins in Part III after the quest "Rescue Centurio". Also one of Cai\'s mentors in Part I.', '', { routes: ALL, spoiler: true }],
  ['Sofia', 'Temple Army', ['3/9', '3/9', 'auto', '3/7'], 'Theodora gets her in the recruitment tutorial (form the bond with Saraminian Sweets).'],
  ['Anna', 'Temple Army', null, 'Listed as playable, and runs the "Golden Secret" paralogue. How she joins isn\'t known yet.', '', { routes: ALL, flag: 'unconfirmed' }],
  // Unaffiliated
  ['Guzran', 'Unaffiliated', ['auto (tutorial)', '3/8', '3/8', '1/3'], 'No extra condition.'],
  ['Yang Jie', 'Unaffiliated', ['2/3', 'auto (tutorial)', '3/9', '3/8'], 'Answer his three drinking questions: Cheese, Moon, Potatoes.', 'The Works of Dante'],
  ['Io', 'Unaffiliated', ['3/10, 4,000G', '2/3, 800G', '3/10, 4,000G', '1/6, 1,500G'], 'Joins at level 20 as cavalry.'],
  ['Catania', 'Unaffiliated', ['3/10', '1/8', '3/7', 'auto (tutorial)'], 'No extra condition.'],
  ['Noctula', 'Unaffiliated', ['1/4', '1/6', '1/3', '3/8'], 'No extra condition.'],
  ['Nydine', 'Unaffiliated', ['1/6, 2 Bronze Axes', '2/5, 2 Bronze Axes', '3/5, 3 Iron Axes', '3/10, 3 Iron Axes'], 'Bring the axes listed for your route.'],
  ['Nuzzuo', 'Unaffiliated', ['2/6, 3 Iron Bows', '1/9, 2 Iron Bows', '1/6, 3 Iron Bows', '3/9, 3 Iron Bows'], 'Appears around 7/1.'],
  ['Majide', 'Unaffiliated', ['2/5', '3/8', '3/8', '3/9'], 'When he asks, admit you need him, three times.', 'Mature Shosh'],
  ['Klapka', 'Unaffiliated', null, 'Joins in Part III if he survives as a guest in the section before.', '', { routes: ALL, spoiler: true }],
];

const people: Card[] = UNITS.map(([name, joins, pr, extra, likes, meta]) => ({
  block: 'people',
  content: {
    name,
    joins,
    how: (pr ? per(...pr) + '\n' : '') + extra + (pr ? '\nEvery recruit starts with a gift to form a bond.' : ''),
    likes: likes ? likes.split(', ').join('\n') : '',
  },
  routes: meta?.routes ?? (pr ? routesOf(...pr) : ALL),
  ...meta,
}));

const progress: Card[] = [
  { block: 'progress', content: { name: 'Prologue: Descent', order: '0', summary: 'Create Eshmel, meet Hong Hua and Troy. "The White Bird" and "The Ruined Land".' }, routes: ALL },
  { block: 'progress', content: { name: "Part I: Cai's Path", order: '1', route: 'Cai', summary: '12 chapters, starting in Ribeira. Cai can capture mounts and farm.' }, routes: ['cai'] },
  { block: 'progress', content: { name: "Part I: Dietrich's Path", order: '1', route: 'Dietrich', summary: '12 chapters, starting with a stranger arriving in Dagda. Dietrich fights Dread Warrior duels.' }, routes: ['dietrich'] },
  { block: 'progress', content: { name: "Part I: Theodora's Path", order: '1', route: 'Theodora', summary: '12 chapters, starting at the Iron Bastion. Theodora commands battalions.' }, routes: ['theodora'] },
  { block: 'progress', content: { name: "Part I: Leda's Path", order: '1', route: 'Leda', summary: '12 chapters, starting with "The Vengeful Dancer". Leda performs to learn Songs.' }, routes: ['leda'] },
  { block: 'progress', content: { name: 'Part II: War Arc', order: '2', summary: 'Six chapters, played once per Flame Lord and nearly the same for each. You can skip it, which sets everyone to level 45. Up to 15 units deploy.' }, routes: ALL, spoiler: true },
  { block: 'progress', content: { name: 'Part III: Salvation', order: '3', summary: 'Six chapters. Only Flame Lords who finished Part II take part. Free time and map exploration return.' }, routes: ALL, spoiler: true },
];

// Paralogues: Part I only, each open for a short window of in-game dates.
type Para = [title: string, owner: string, reward: string, windows: [string, string, string, string], note: string, flag?: Card['flag']];
const PARALOGUES: Para[] = [
  ['Diversionary Tactics', 'Leda', 'Silver Shield', ['', 'Ch 9, 9/2–9/8', 'Ch 10, 9/2–9/8', ''], 'Unlocks Buccar off-route.'],
  ['Missing Brave-Warrior Statue', 'Theodora', 'Pilum', ['', 'Ch 9, 9/3–9/15', '', ''], 'Starts at the Purification Shrine.'],
  ['Secret of the Vanished Carriage', 'Talimun', 'Cleansing Blade', ['Ch 10, 9/17–9/22 and 10/1–10/12', 'Ch 9, 9/17–9/19 and 10/1–10/12', 'Ch 11, same dates as Cai', ''], 'Starts at Dragdon Pass. Unlocks Ursula.'],
  ["Friendly Match with Brigid's King", 'Bertrand', 'Extra Large Bullion', ['Ch 10, 9/17–9/25', 'Ch 9, 9/17 only', 'Ch 11, 9/17–9/25', ''], 'Talk to Gabriel in Dagsion. Unlocks Gaitz and Peppe. Dietrich gets a one-day window.'],
  ['Golden Secret', 'Anna', 'Orichalcum', ['Ch 10, 9/24–10/5', 'Ch 10, 9/29–10/5', 'Ch 11, 9/24–10/5', ''], ''],
  ['Queen of the Erased', 'Anatolia', 'Electron Agitator', ['', 'Ch 11, 10/5–10/17', '', 'Ch 10, 10/5–10/17'], "Starts at Pale Raven's Perch. Unlocks Sha Lan."],
  ['Sealed-Off Past', 'Dietrich', 'Salamander', ['', '', '', 'Ch 11, 10/16–11/1'], 'Starts at Shadowy Cave. Unlocks Fabio for Leda.'],
  ['Great Escape', 'Cai', 'Gem Box', ['', 'Ch 10, 10/16–10/22', 'Ch 12, 10/16–10/22', 'Ch 11, 10/16–10/22'], 'Talk to Cai in Dagsion. Unlocks Tialla off-route.'],
  ["Orchel's Regret", 'Orchel', 'Healing Staff', ['Ch 11, 10/18–10/27', 'Ch 11, 10/18–10/27', 'Ch 12, 10/18–10/27', 'Ch 11, 10/18–10/27'], 'Starts at Fort Galcar. Unlocks Diego. The only one open on every route.'],
];
const LORDS = ['Cai', 'Dietrich', 'Theodora', 'Leda'];

const missables: Card[] = [
  ...PARALOGUES.map(([title, owner, reward, w, note]): Card => ({
    block: 'missables',
    content: {
      what: `${owner}'s Paralogue: ${title}`,
      before: w.map((x, i) => (x ? `${LORDS[i]}: ${x}` : '')).filter(Boolean).join('\n'),
      how: `Pays 20,000G, 150 Renown and the ${reward}. ${note} Dates differ a little between guides.`.replace('  ', ' '),
    },
    routes: ALL.filter((_, i) => w[i]),
  })),
  { block: 'missables', content: { what: 'Recruiting anyone at all', before: 'The end of Part I', how: 'Recruiting only works in Part I. Everyone you recruit on any route is carried into Part III, with their stats from every route merged.' }, routes: ALL },
  { block: 'missables', content: { what: 'Creek', before: 'Part I, Ch 9 on that route', how: 'Finish "My Late Sister\'s Accessory" (the Violet Brooch from Axion Gorge). Without it, Creek never joins in Part II.' }, routes: ALL, spoiler: true },
  { block: 'missables', content: { what: 'Support conversations from Part I', before: 'Moving into Part II', how: "Part I supports can't be watched once you're in Part II. Watch them at the Inn as they appear." }, routes: ALL },
  { block: 'missables', content: { what: 'One of two quest chains (Ch 8)', before: 'Choosing in Ch 8', how: '"A Letter of Some Gravity" leads to the Haze Badge. "For the Empire\'s Safety" gives a Specialty License. You can only do one chain per route.' }, routes: ALL },
  { block: 'missables', content: { what: 'Weekly activities', before: 'Sunday each week', how: 'Gifts, Arena training, meals, Temple Service, Bird Time, fortune-telling and the Stable all reset on Sunday. Use them before the week turns.' }, routes: ALL },
];

// Classes: tier cards plus the secret Advanced classes that need special unlocks.
const builds: Card[] = [
  { block: 'builds', content: { name: 'Beginner classes', for: 'Level 5, Renown 1, Beginner License', path: 'Diviner (Magic Basics)\nGladiator (Attack Basics)\nHunter (Hunting Basics)\nOrnius Rider (Offense Basics, can dismount)\nSoldier (Defense Basics)', why: 'Each has a mastery skill that adds +1 to its main stats.' }, routes: ALL },
  { block: 'builds', content: { name: 'Specialty classes', for: 'Level 20, Renown 4, Specialty License', path: 'Archer, Armored Knight, Armored Ornius Rider, Brigand\nCharioteer (new class), Light Cavalry, Myrmidon\nPriest, Pugilist, Rogue, Shaman, Wing Soldier', why: 'No secret classes in this tier.' }, routes: ALL },
  { block: 'builds', content: { name: 'Advanced classes', for: 'Level 35, Renown 8, Advanced License', path: 'Shido, Warrior, Sniper, Forest Knight\nDreadnought, Bardinger, Ovate, Bishop', why: 'These unlock automatically. Secret Advanced classes are their own cards.' }, routes: ALL },
  { block: 'builds', content: { name: 'Dancer', for: "Leda's route", path: 'Ch 9: "Great Dancer\'s Successor"\nDeliver a Hingosh from Baina Oasis', why: 'Special Dance.' }, routes: ['leda'] },
  { block: 'builds', content: { name: 'Ranger', for: "Leda's route", path: 'Finish "Elegant Drink Recipes"', why: 'Countershot.' }, routes: ['leda'] },
  { block: 'builds', content: { name: 'Troubadour', for: 'Cai or Leda', path: 'Cai: Bertrand\'s mentoring ("White-Maned Demon\'s Request", Renown 10)\nLeda: "Elegant Drink Recipes"', why: 'Song of Courage.' }, routes: ['cai', 'leda'] },
  { block: 'builds', content: { name: 'Caladrius', for: "Cai's route", path: 'Castor\'s mentoring: "Special Request from Pop" (Renown 7)\nDeliver 2 Angelica', why: 'Overtake.' }, routes: ['cai'] },
  { block: 'builds', content: { name: 'Dragoon', for: 'Cai or Theodora', path: 'Cai: Aurora\'s mentoring ("Special Request from Mom", Renown 8)\nTheodora: Send Supplies of Lir Fish and Sea-Star Stone (Ch 11)', why: 'Besieger.' }, routes: ['cai', 'theodora'] },
  { block: 'builds', content: { name: 'Guardian', for: 'Dietrich or Theodora', path: 'Dietrich: beat Il-Lara (Dread Warrior, Ch 9)\nTheodora: Send Supplies of Roca and Kothar Gar (Ch 9)', why: 'Brace.' }, routes: ['dietrich', 'theodora'] },
  { block: 'builds', content: { name: 'Cataphract', for: "Theodora's route", path: 'Send Supplies of Ladon Loach and Steel Fish (Ch 9)', why: 'Pavise.' }, routes: ['theodora'] },
  { block: 'builds', content: { name: 'Blacksmith', for: "Dietrich's route", path: "Reach Smyrnos's Blessing level 1 and Renown 8", why: 'Makeshift. Only Polygon lists this unlock so far.' }, routes: ['dietrich'], flag: 'disputed' },
  { block: 'builds', content: { name: 'Master classes', for: 'Level 45, Part III', path: 'Battlemaster, Bow Adept, Castle Knight, Druid\nOrichaldia (mounted), Sentinel, Shadow Seeker\nValkyrium (mounted), War Monk, Wiseman', why: 'Unlocked through Part III quests. The exact conditions are still being worked out.' }, routes: ALL, spoiler: true, flag: 'unconfirmed' },
];

type Dungeon = [name: string, region: string, level: string, chests: string, ores: string, note?: string];
const DUNGEONS: Dungeon[] = [
  ['Niraga Mine', 'Amalthea', '5', 'Coin, Miracle Gem, Coin, White-Magic Manual', 'Smithing Stone, Black-Sand Steel, Blue Snoll'],
  ['Collapsed Fort', 'Amalthea', '6', 'Bowbreak Amulet, Black-Magic Manual', 'Smithing Stone, Black-Sand Steel, Windstone', 'The Jurah Carving quest item is here.'],
  ["Heretics' Cave", 'Thaleia', '7', 'Dew of Protection, Vulnerary', 'Smithing Stone, Black-Sand Steel, Thunderstone, Spellshard'],
  ['Galen Fort Ruins', 'Idyia', '8', "Wooden Shield, Vulnerary, Hunter's Bow", 'Smithing Stone, Black-Sand Steel, Cullet'],
  ['Rubess Forest', 'Melias', '9', 'Healing Staff, Riding Manual, Lucky Coin', 'Venomstone, Umbral Steel'],
  ["Nowah's Cave", 'Elektra', '10', 'Tactics Manual, Luxury Veg. Crate, Turmoil Mask, Pure Water', 'Smithing Stone, Black-Sand Steel, Sea-Star Stone, Sunstone'],
  ['Shadowy Cave', 'Lambath', '12', 'Coin, Killing Edge, White-Magic Manual, Black-Magic Manual, Coin', 'Smithing Stone, Black-Sand Steel, Sea-Star Stone, Cullet, Lunar Stone, Umbral Steel', "Some routes may need Dietrich's Paralogue first."],
  ['Corroios Fort Ruins', 'Thaleia', '13', 'Tactics Manual, Magic Staff, Poisonbane Chain', 'Smithing Stone, Black-Sand Steel, Sunstone'],
  ['Hundred-Hole Cave', 'Pasithea', '14', 'Poisonbane Gem, Venin Edge, Bullion', 'Phlogiston, Agarthium'],
  ['Masked Woods', 'Melias', '15', 'Heavy-Armor Manual, Venin Bow, Veroquine (sword)', 'Venomstone, Wootz Steel, Lunar Stone'],
  ['Coris Mine', 'Thaleia', '16', "Vulnerary, Archer's Ring, Large Coin", 'Smithing Stone, Black-Sand Steel, Windstone, Thunderstone, Sunstone'],
  ['Fort Hayn', 'Braxithea', '18', 'Dew of Peace, Axebreak Amulet', 'Smithing Stone, Thunderstone'],
  ['Dione Fort', 'Castalia', '18', 'Flying Manual, Concoction, Dual Fish Knives, Hexlock Shield', 'Smithing Stone, Windstone, Thunderstone'],
  ['Valhalla Mine', 'Saveilon', '20', "Large Bullion, Antitoxin, Azaga's Bow", 'Smithing Stone, Wootz Steel, Blue Snoll'],
  ['Dragonbone Tangle', 'Nysiades', '20', "Hunter's Ring, Hexlock Shield, Lucky Coin", 'Smithing Stone, Sunstone, Lunar Stone, Agarthium'],
  ["Beast's Path", 'Braxithea', '20', 'Concoction, Poisonhunt Gem, Bullion', 'Smithing Stone, Thunderstone, Wootz Steel, Umbral Steel'],
  ['Cindered Road Cave', 'Solidus', '22', 'Concoction, Conflagrant Gem, Flying Manual', 'Phlogiston, Agarthium'],
  ['Cave Behind the Falls', 'Castalia', '22', 'Archive B, Bullion, Pure Water', 'Phlogiston, Agarthium'],
  ['Cougar Woodlands', 'Braxithea', '23', 'Muen (spear), School Scandal, Bullion, Bullion', 'Venomstone, Windstone, Lunar Stone, Spellshard'],
  ['Sand-Shadow Fort', 'Nysiades', '23', 'Gundogya (axe), Large Bullion, Concoction', 'Smithing Stone, Venomstone, Cullet, Umbral Steel', "A giant always appears here (Giant's Meat, for Goliath)."],
  ['Enno Isle', 'Danann Sea', '24', 'Bullion, Healing Staff, Short Axe', 'Smithing Stone, Sea-Star Stone, Windstone, Cullet, Blue Snoll', 'Theodora only in Part I.'],
  ['Stoppered Shrine', 'Idyia', '25', 'Flower Painting, Velheit (axe)', 'Venomstone, Windstone, Lunar Stone, Umbral Steel'],
  ["Aditi's Cave", 'Nysiades', '28', 'Large Bullion, Archive L, Spirit Board', 'Smithing Stone, Black-Sand Steel, Cullet, Lunar Stone, Spellshard'],
  ['Nemea Cavern', 'Pasithea', '30', 'Heavy-Armor Manual, Elixir, Hammer, Sturdy Rucksack', 'Smithing Stone, Thunderstone, Nemearite, Umbral Steel'],
  ['Uncharted Isle', 'Lir Sea', '30', 'Anguishing Shield, Thick Foreign Tome', 'Sea-Star Stone, Blue Snoll', 'Theodora anytime; Dietrich in Ch 8 only.'],
  ['Iapetus Cavern', 'Solidus', '32', 'Archive θ, Black-Magic Manual', 'Smithing Stone, Black-Sand Steel, Venomstone, Sunstone, Lunar Stone, Blue Snoll'],
  ["Giant's-Print Fort", 'Ogmios', '35', 'Onoa (spear), Elixir, Advanced License', 'Smithing Stone, Venomstone, Thunderstone, Lunar Stone, Spellshard'],
];
const places: Card[] = [
  { block: 'places', content: { name: 'Dagsion', unlock: 'The capital, your hub between chapters.', notable: 'Hightown: Exam Proctor, License Vendor, Smyrnos\'s Temple\nMidtown: Headhunter (Dietrich), Anatolia\'s fortune booth\nLowtown: Tavern, Stable (Cai), Vandahl Trading Co.\nTemple Row: the six gods\' temples\nShopping Arcade, Arena, Theater, Thermae, Inns\nA Pale Raven\'s Perch in every district' }, routes: ALL },
  ...DUNGEONS.map(([name, region, level, chests, ores, note]): Card => ({
    block: 'places',
    content: { name, unlock: `${region}. Suggested level ${level}.${note ? ' ' + note : ''}`, notable: `Chests: ${chests}\nOres: ${ores}` },
    routes: name === 'Enno Isle' ? ['theodora'] : ALL,
  })),
];

const items: Card[] = [
  { block: 'items', content: { name: 'Keys of the Diadem (5)', type: 'Key item', where: "Part III chests in Heretics' Cave, Enno Isle, Cougar Woodlands, Sand-Shadow Fort and Giant's-Print Fort.", use: 'All five open the Diadem Temple and its Divine classes.' }, routes: ALL, spoiler: true },
  { block: 'items', content: { name: 'Paradise Fish', type: 'Material', where: 'Lake Brontes in Saveilon, past Valhalla Mine.', use: 'Recruits Ninae (deliver 1).' }, routes: ALL },
  { block: 'items', content: { name: "Giant's Meat", type: 'Material', where: 'The giant in Sand-Shadow Fort, and giant-icon skirmishes.', use: 'Recruits Goliath (deliver 3).' }, routes: ALL },
  { block: 'items', content: { name: 'Glirmosa', type: 'Material', where: "Mount Orgus Trail, Rear Mountain Path, Forest of No Return, Giant's Mount (Pasithea).", use: 'Recruits Mu off-route (deliver 3).' }, routes: ALL, flag: 'disputed' },
  { block: 'items', content: { name: 'Violet Brooch', type: 'Quest item', where: 'Axion Gorge, during "My Late Sister\'s Accessory" (Ch 9).', use: 'Needed for Creek to join in Part II.' }, routes: ALL, spoiler: true },
  { block: 'items', content: { name: 'Hingosh', type: 'Quest item', where: 'Baina Oasis.', use: 'Unlocks the Dancer class for Leda (Ch 9).' }, routes: ['leda'] },
  { block: 'items', content: { name: 'Beginner, Specialty and Advanced Licenses', type: 'License', where: 'The License Vendor in Hightown, next to the Exam Proctor. Stock is limited; some world-map vendors sell them cheaper.', use: 'Needed to take a Certification Exam for that tier.' }, routes: ALL },
  { block: 'items', content: { name: 'Chosen Sword, Chosen Lance, Royal Sword, Breidablik', type: 'Weapons (update 1.01)', where: 'Arrive automatically in Part I, Ch 4, on every route.', use: 'Free bonus weapons. Each route gets its own copy.' }, routes: ALL },
  { block: 'items', content: { name: 'Answerer', type: 'Sword', where: "Dietrich's own weapon.", use: 'Tied to the Crest of Lamine. Also powers "Answerer\'s Cry", which reveals enemies on the world map.' }, routes: ['dietrich'] },
  { block: 'items', content: { name: 'Divine Sand', type: 'Resource', where: 'Refills at every main battle.', use: 'Spent each time you use a Temple Blessing.' }, routes: ALL },
  { block: 'items', content: { name: 'Karma Shards', type: 'Resource', where: "Claim them for Notable Deeds at a Pale Raven's Perch or the Shrine of Causality.", use: 'Buy Boons of Salvation, like +10% battle EXP (500 shards) or shop discounts (300).' }, routes: ALL },
];

const foes: Card[] = [
  { block: 'foes', content: { name: 'Borges', where: 'Niraga Mine', weak: '', tips: 'A Dread Warrior solo duel from the Headhunter in Midtown. Winning teaches Hidden Soulrend.' }, routes: ['dietrich'] },
  { block: 'foes', content: { name: 'Sepente', where: 'Corroios Fort Ruins', weak: '', tips: 'Dread Warrior duel. Winning teaches Hidden Flowform.' }, routes: ['dietrich'] },
  { block: 'foes', content: { name: 'Aguirre', where: 'Rubess Forest', weak: '', tips: 'Dread Warrior duel. Winning teaches Hidden Birdbane. Game8 files this under Cai instead.' }, routes: ['dietrich'], flag: 'disputed' },
  { block: 'foes', content: { name: 'Camilo', where: 'Fort Hayn', weak: '', tips: 'Dread Warrior duel.' }, routes: ['dietrich'] },
  { block: 'foes', content: { name: 'Il-Lara, the Piercer', where: 'Dione Fort (Renown 6)', weak: '', tips: 'Dread Warrior duel. Winning unlocks the Guardian class.' }, routes: ['dietrich'] },
  { block: 'foes', content: { name: 'The giant of Sand-Shadow Fort', where: 'Sand-Shadow Fort, Nysiades', weak: '', tips: "Always there. Drops Giant's Meat, which Goliath wants." }, routes: ALL },
];

const howto: Card[] = [
  { block: 'howto', content: { name: 'Recruit a unit', steps: 'Give them any gift to form a bond. That unlocks the Recruit option\nRaise your Support with them and your Renown to the levels their card shows for your Flame Lord\nMeet any extra condition (a quest, an item, a payment)', tip: 'Recruiting later in Part I gives better starting levels and gear; earlier gives you more time to train them.' }, routes: ALL },
  { block: 'howto', content: { name: 'Change class', steps: 'Buy the license from the License Vendor in Hightown\nTake the Certification Exam from the Exam Proctor next to him\nAim for a 75%+ pass chance', tip: 'The game autosaves before showing the result. Advanced classes unlocked on one route open on every route.' }, routes: ALL },
  { block: 'howto', content: { name: 'Earn Temple Blessings', steps: 'Do Temple Service at Temple Row (up to 2 units, costs Motivation)\nServe on a god\'s holy day to fill the gauge faster (see the Calendar)\nEquip up to 4 Blessings', tip: "Fortuna's Blessing rewinds turns: free on Normal, 5 Divine Sand on Hard." }, routes: ALL },
  { block: 'howto', content: { name: 'Carry progress between routes', steps: 'Finish a route before starting the next\nYour map, finished subquests, Blessings, supports and Boons carry forward\nReplaying Chapter 12 updates the party that route takes into Part II', tip: 'Finished general subquests auto-complete on later routes and pay their rewards again.' }, routes: ALL },
  { block: 'howto', content: { name: 'Find Dagsion\'s services', steps: 'Hightown: classes and Smyrnos\'s Temple\nMidtown: Headhunter and fortune-telling\nLowtown: Tavern, Stable, trading\nTemple Row: Temple Service', tip: "The Theater and Thermae raise Support; Inns serve meals and support conversations." }, routes: ALL },
];

const mysteries: Card[] = [
  { block: 'mysteries', content: { name: 'How does Long join?', known: 'Long is listed as playable on the wiki, in the Bridal Party of the Pale Raven. Nobody has documented how to get them yet.', status: 'Open' }, routes: ALL },
  { block: 'mysteries', content: { name: 'How does Anna join?', known: 'Anna runs the "Golden Secret" paralogue and is listed as playable, but the joining condition is unknown.', status: 'Open' }, routes: ALL },
  { block: 'mysteries', content: { name: 'How do you unlock the Elephant Rider?', known: 'A new mount type that appears in Part III. Conditions not documented.', status: 'Open' }, routes: ALL, spoiler: true },
  { block: 'mysteries', content: { name: 'Who uses Song of Beasts?', known: 'The wiki says it summons Demonic Beasts. Which unit has it is unconfirmed.', status: 'Open' }, routes: ALL },
  { block: 'mysteries', content: { name: "What is Bertrand's Blaze Art called?", known: 'It cuts physical damage for a turn, seen when fighting him. The name hasn\'t been recorded.', status: 'Theory' }, routes: ALL },
  { block: 'mysteries', content: { name: 'Do quest offers depend on route order?', known: 'Which subquests appear seems partly random, and may depend on the order you play the routes in.', status: 'Theory' }, routes: ALL },
];

export const CARDS: Card[] = [...progress, ...missables, ...people, ...builds, ...places, ...items, ...foes, ...howto, ...mysteries]
  .map((c) => ({ ...c, source: c.source ?? SOURCE }));
