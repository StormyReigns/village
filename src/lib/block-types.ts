// The Block types a Builder can add in the Workshop (Add Block), each with the player's question it
// answers, since Builders think in their game's words, not ours. Collection is left out: Places and
// Foes will replace it (docs/blocks/world.md). Checklist and Timeline are first versions that
// haven't had their design pass yet (docs/blocks/README.md).

import type { Block, BlockType } from '../data/pages/types.ts';

export interface BlockTypeInfo {
  type: BlockType;
  /** Our name for it. */
  name: string;
  /** The player's question it answers, in their words. */
  question: string;
  /** Its usual symbol (src/components/Icon.tsx). */
  icon: string;
  /** A name it often has in a game, as the title box's hint. */
  example: string;
  /** Works, but hasn't been designed properly yet. */
  firstVersion?: boolean;
}

export const BLOCK_TYPES: BlockTypeInfo[] = [
  { type: 'characters', name: 'Characters', question: "Who's who, and how do I get them on my side?", icon: 'Users', example: 'Units, Party members, Villagers' },
  { type: 'items', name: 'Items', question: "What's this for, and where do I get it?", icon: 'Backpack', example: 'Items, Weapons, Materials' },
  { type: 'classes', name: 'Classes', question: 'What can my characters become?', icon: 'Shield', example: 'Classes, Jobs, Specs' },
  { type: 'guide', name: 'Guides', question: 'How do I do this, or beat this?', icon: 'BookOpen', example: 'How to, Boss guides' },
  { type: 'tierlist', name: 'Tier list', question: "Who's good? Everyone ranks, and the lists add up", icon: 'Trophy', example: 'Unit tiers, Best weapons' },
  { type: 'planner', name: 'Planner', question: 'Who am I taking, and what will they become?', icon: 'ClipboardList', example: 'Your party, Your build' },
  { type: 'checklist', name: 'Checklist', question: 'What can I still miss, and what have I done?', icon: 'Hourglass', example: 'Last chances, Collectibles', firstVersion: true },
  { type: 'timeline', name: 'Timeline', question: 'What happens when, and where am I in the story?', icon: 'Flag', example: 'Story, Chapters, Dungeons', firstVersion: true },
];

export const blockTypeInfo = (type: BlockType) => BLOCK_TYPES.find((t) => t.type === type);

/** Our name for a type, with "a" or "an" ("a Collection" for the old type Add Block no longer offers). */
export const typeName = (type: BlockType) => {
  const name = type === 'collection' ? 'Collection' : blockTypeInfo(type)?.name ?? type;
  return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`;
};

/** The types an empty Block can change to (item 6 of Matt's Ocarina review): Add Block's, apart from the
 *  ones whose settings point at other Blocks. ship_setup in 20261129000000_block_type_drafts.sql keeps the
 *  same lists. */
export const RETYPE_TO: BlockType[] = ['characters', 'items', 'classes', 'guide', 'checklist', 'timeline'];
const RETYPE_FROM: BlockType[] = ['collection', ...RETYPE_TO];

/** Why a Block can't change its type now, in a Builder's words, or null when it can. */
export function retypeProblem(block: Pick<Block, 'id' | 'type' | 'title' | 'entries'> & Partial<Pick<Block, 'look'>>, blocks: Pick<Block, 'id' | 'tierSetup' | 'planSetup'>[]): string | null {
  if (!RETYPE_FROM.includes(block.type)) return "A Tier list's or Planner's type can't be changed.";
  if (block.look === 'map') return 'A map Block keeps its type: Places on a map are their own kind of Block.';
  if (block.entries.length) return `Only a Block with nothing in it yet can change its type, and ${block.title} has entries.`;
  const uses = blocks.some((o) => o.id !== block.id && (o.tierSetup?.ranks === block.id || o.planSetup?.roster === block.id
    || o.planSetup?.classes === block.id || (o.planSetup?.slots ?? []).some((x) => x.from === block.id)));
  return uses ? `A Tier list or Planner uses ${block.title}, so its type can't change.` : null;
}

/** Blocks a Tier list can rank: ones with pieces of their own. */
export const RANKABLE: BlockType[] = ['characters', 'items', 'classes'];

/** Symbols to pick from for a new Page or Block (all drawn by BlockIcon). */
export const SYMBOLS = [
  'Users', 'Shield', 'Backpack', 'Swords', 'Sword', 'WandSparkles', 'BookOpen', 'ScrollText', 'Flag', 'Hourglass',
  'MapPin', 'Compass', 'Mountain', 'Castle', 'Trees', 'Store', 'Skull', 'Trophy', 'ClipboardList', 'Star',
  'Crown', 'Gem', 'KeyRound', 'Package', 'Sparkles', 'Flame', 'Moon', 'Sun',
];

/** Page keys the app's own routes use (src/app/g/[game]/: workshop, and plans, tiers and opengraph-image
 *  in (app)). A Page named one of these gets "-page" after it, or its address would open that route.
 *  ship_structure in 20261122000000_page_block_drafts.sql keeps the same list. */
export const RESERVED_PAGE_KEYS = ['workshop', 'plans', 'tiers', 'opengraph-image'];

/** A key from a name: lowercase words joined by dashes, as Page and Block keys are. */
export const keyFrom = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40);
