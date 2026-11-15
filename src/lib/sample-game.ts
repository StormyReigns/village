// A small made-up game, "The Lantern Isles", whose entries fill the preview when a Builder adds a
// Block in the Workshop. The same example shows in every game: no spoilers for anything real, and
// it works for a brand-new game with nothing in it yet. The Builder's choices (the Block's name,
// symbol, intro, the Page's color) are laid over it, so the example becomes theirs as they type.

import type { Block, BlockType, Entry, Page, StatDef, Tint } from '@/data/pages/types';
import { commonFor, DESCRIPTION, LEADS_TO, MADE_FROM } from './fields';
import { STEPS, TIP, WATCH_OUT } from './guides.ts';
import { DEFAULT_TIERS } from './tiers';

const entry = (id: string, name: string, more: Partial<Entry> = {}): Entry => ({ id, name, sections: [], categories: {}, ...more });
const sec = (o: Record<string, string>) => Object.entries(o).map(([label, text]) => ({ label, text }));

const STATS: StatDef[] = ['HP', 'Str', 'Mag', 'Spd', 'Def'].map((l) => ({ key: l.toLowerCase(), label: l, better: 'high' as const }));

const CAST: Entry[] = [
  entry('sample-wren', 'Wren', {
    categories: { 'Role or class': 'Ranger' }, description: 'A lighthouse keeper\'s daughter who knows every reef on the isles.',
    sections: sec({ Location: 'Gull Point', 'Time of arrival': 'Chapter 1', Skills: 'Keen Eye: Sees hidden paths\nVolley: Hits two foes at once', 'How to recruit': 'Joins you at the start of the game.', Relationships: 'Tomas: Older brother' }),
    stats: { hp: 60, str: 45, mag: 20, spd: 70, def: 30 },
  }),
  entry('sample-tomas', 'Tomas', {
    categories: { 'Role or class': 'Knight' }, description: 'Steady, slow and very hard to knock over.',
    sections: sec({ Location: 'Gull Point', 'Time of arrival': 'Chapter 1', Skills: 'Shield Wall: Takes a hit for a friend nearby', 'How to recruit': 'Joins with Wren.', Relationships: 'Wren: Younger sister' }),
    stats: { hp: 85, str: 60, mag: 5, spd: 25, def: 75 },
  }),
  entry('sample-isolde', 'Isolde', {
    categories: { 'Role or class': 'Mage' }, description: 'A scholar from the mainland, chasing an old map.',
    sections: sec({ Location: 'The Old Library', 'Time of arrival': 'Chapter 3', Skills: 'Lantern Light: Lights up the dark caves', 'How to recruit': 'Talk to her in the library in Chapter 3, then win the battle outside.' }),
    stats: { hp: 45, str: 15, mag: 80, spd: 50, def: 20 },
  }),
  entry('sample-brannoc', 'Brannoc', {
    categories: { 'Role or class': 'Pirate' }, description: 'Says he\'s retired. Nobody believes him.',
    sections: sec({ Location: 'Smuggler\'s Cove', 'Time of arrival': 'Chapter 5', Skills: 'Plunder: Steals an item after a hit', 'How to recruit': 'Pay his tavern bill (500 gold) in Smuggler\'s Cove.' }),
    stats: { hp: 70, str: 65, mag: 10, spd: 55, def: 40 },
  }),
  entry('sample-maeve', 'Maeve', {
    categories: { 'Role or class': 'Healer' }, description: 'Runs the island clinic and the island gossip.',
    sections: sec({ Location: 'Harbor Town', 'Time of arrival': 'Chapter 2', Skills: 'Mend: Heals a friend nearby', 'How to recruit': 'Bring her three Sea Herbs.' }),
    stats: { hp: 50, str: 20, mag: 65, spd: 45, def: 30 },
  }),
];

const ITEMS: Entry[] = [
  entry('sample-sea-herb', 'Sea Herb', { categories: { Type: 'Material' }, sections: sec({ 'What it does': 'Used for healing potions.', 'Where to get it': 'Gull Point: On the beach\nHarbor Town: Sold at the market' }) }),
  entry('sample-potion', 'Potion', { categories: { Type: 'Potion' }, sections: sec({ 'What it does': 'Heals 20 HP.', 'Where to get it': 'Harbor Town: Sold at the clinic', [MADE_FROM]: 'Sea Herb: 2' }) }),
  entry('sample-iron-sword', 'Iron Sword', { categories: { Type: 'Weapon' }, sections: sec({ 'What it does': 'A plain sword that never breaks.', 'Where to get it': 'Harbor Town: Sold at the smithy' }) }),
  entry('sample-driftwood-bow', 'Driftwood Bow', { categories: { Type: 'Weapon' }, sections: sec({ 'What it does': 'Light and quick. Rangers only.', 'Where to get it': 'Smuggler\'s Cove: In a chest' }) }),
  entry('sample-lantern-oil', 'Lantern Oil', { categories: { Type: 'Material' }, sections: sec({ 'What it does': 'Keeps a lantern lit for one cave.', 'Where to get it': 'The Old Library: From Isolde' }) }),
  entry('sample-pearl', 'Black Pearl', { categories: { Type: 'Treasure' }, sections: sec({ 'What it does': 'Sells for 1,000 gold, or trade it to Brannoc.', 'Where to get it': 'Smuggler\'s Cove: Win the dive' }) }),
];

const CLASSES: Entry[] = [
  entry('sample-ranger', 'Ranger', { categories: { Tier: 'Starting' }, sections: sec({ [LEADS_TO]: 'Sharpshooter: at level 20', 'How to unlock': 'Wren starts as one.', Skills: 'Volley: Hits two foes at once' }) }),
  entry('sample-knight', 'Knight', { categories: { Tier: 'Starting' }, sections: sec({ [LEADS_TO]: 'Warden: at level 20', 'How to unlock': 'Tomas starts as one.', Skills: 'Shield Wall: Takes a hit for a friend' }) }),
  entry('sample-mage', 'Mage', { categories: { Tier: 'Starting' }, sections: sec({ [LEADS_TO]: 'Lightkeeper: at level 20', 'How to unlock': 'Isolde starts as one.', Skills: 'Lantern Light: Lights up dark caves' }) }),
  entry('sample-sharpshooter', 'Sharpshooter', { categories: { Tier: 'Advanced' }, sections: sec({ 'Exam needs': 'Level: 20', 'How to unlock': 'Use a Seal of Skill on a Ranger.' }) }),
  entry('sample-warden', 'Warden', { categories: { Tier: 'Advanced' }, sections: sec({ 'Exam needs': 'Level: 20', 'How to unlock': 'Use a Seal of Skill on a Knight.' }) }),
  entry('sample-lightkeeper', 'Lightkeeper', { categories: { Tier: 'Advanced' }, sections: sec({ 'Exam needs': 'Level: 20', 'How to unlock': 'Use a Seal of Skill on a Mage.' }) }),
];

const GUIDES: Entry[] = [
  entry('sample-beat-kraken', 'Beat the Reef Kraken', {
    description: 'Kill the two tentacles first, then hit the head while it\'s stunned.',
    sections: sec({ [WATCH_OUT]: 'Its ink blinds anyone in front of it', [STEPS]: 'Put Tomas on the left tentacle\nHave Wren shoot the right one\nWhen both are down, everyone hits the head\n||It comes back at half HP for a second round||', [TIP]: 'Bring two Potions for Tomas.' }),
  }),
  entry('sample-recruit-brannoc', 'Recruit Brannoc', {
    description: 'Pay his tavern bill in Smuggler\'s Cove before Chapter 6.',
    sections: sec({ [STEPS]: 'Save up 500 gold\nGo to the tavern in Smuggler\'s Cove\nTalk to the barkeep, then to Brannoc' }),
  }),
  entry('sample-money', 'Make money early', {
    description: 'Dive for Black Pearls in Smuggler\'s Cove and sell them.',
    sections: sec({ [STEPS]: 'Win the dive in Smuggler\'s Cove\nSell the pearl in Harbor Town', [TIP]: 'The dive resets every chapter.' }),
  }),
];

const CHECKLIST: Entry[] = [
  entry('sample-miss-brannoc', 'Recruit Brannoc', { description: 'Pay his tavern bill in Smuggler\'s Cove.', sections: sec({ Before: 'The end of Chapter 5' }) }),
  entry('sample-miss-bow', 'Driftwood Bow', { description: 'The chest behind the waterfall in Smuggler\'s Cove.', sections: sec({ Before: 'The cove floods in Chapter 6' }) }),
  entry('sample-miss-map', 'Isolde\'s old map', { description: 'Give her the Lantern Oil when she asks.', sections: sec({ Before: 'Leaving the Old Library' }) }),
  entry('sample-miss-kraken', 'Kraken\'s Eye', { description: 'Beat the Reef Kraken without anyone falling.', sections: sec({ Before: 'The Reef Kraken fight' }) }),
];

const STORY: Entry[] = [
  entry('sample-ch1', 'The lighthouse goes dark', { order: 1, description: 'Wren and Tomas set out to find out who put out the light.' }),
  entry('sample-ch2', 'Harbor Town', { order: 2, description: 'Maeve patches you up and points you to the library.' }),
  entry('sample-ch3', 'The Old Library', { order: 3, description: 'Isolde joins, with half of an old map.' }),
  entry('sample-ch4', 'The Reef Kraken', { order: 4, description: 'The way to the outer isles is blocked.' }),
  entry('sample-ch5', 'Smuggler\'s Cove', { order: 5, description: 'A retired pirate with a tavern bill.' }),
];

const SAMPLE_ENTRIES: Partial<Record<BlockType, Entry[]>> = {
  characters: CAST, items: ITEMS, classes: CLASSES, guide: GUIDES, checklist: CHECKLIST, timeline: STORY,
};

/** The sample game's own Blocks, which a Tier list or Planner in the preview draws from. */
const CAST_BLOCK: Block = { id: 'sample-cast', type: 'characters', title: 'Crew', icon: 'Users', fields: commonFor('characters'), stats: STATS, entries: CAST };
const CLASS_BLOCK: Block = { id: 'sample-classes', type: 'classes', title: 'Classes', icon: 'Shield', fields: commonFor('classes'), entries: CLASSES };
const ITEM_BLOCK: Block = { id: 'sample-items', type: 'items', title: 'Items', icon: 'Backpack', fields: commonFor('items'), entries: ITEMS };

export interface SampleChoices {
  type: BlockType;
  title: string;
  icon: string;
  intro?: string;
  byRoute?: boolean;
  tint: Tint;
  pageTitle: string;
  pageIcon: string;
}

/**
 * The preview's Page: the new Block, filled with the sample game's entries and wearing the
 * Builder's choices, plus the sample Blocks a Tier list or Planner draws from (not shown).
 */
export function samplePage(c: SampleChoices): { page: Page; block: Block } {
  const block: Block = {
    id: 'sample-new',
    type: c.type,
    title: c.title.trim() || 'Untitled',
    icon: c.icon,
    intro: c.intro?.trim() || undefined,
    fields: SAMPLE_ENTRIES[c.type] && (c.type === 'characters' || c.type === 'items' || c.type === 'classes' || c.type === 'guide') ? commonFor(c.type) : undefined,
    stats: c.type === 'characters' ? STATS : undefined,
    filters: c.type === 'items' ? ['Type'] : undefined,
    tierSetup: c.type === 'tierlist' ? { ranks: CAST_BLOCK.id, tiers: DEFAULT_TIERS } : undefined,
    planSetup: c.type === 'planner' ? { roster: CAST_BLOCK.id, size: 4, unlock: ['How to recruit', DESCRIPTION], classes: CLASS_BLOCK.id } : undefined,
    entries: SAMPLE_ENTRIES[c.type] ?? [],
  };
  const page: Page = {
    id: 'sample-page', title: c.pageTitle.trim() || 'New Page', short: c.pageTitle.trim().split(/\s+/)[0] || 'New', icon: c.pageIcon, tint: c.tint, blurb: '',
    blocks: [block, CAST_BLOCK, CLASS_BLOCK, ITEM_BLOCK],
  };
  return { page, block };
}
