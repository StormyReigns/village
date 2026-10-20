// Building blocks: the reusable modules every game app is made of.
//
// A block's fields drive three things at once: the "New" Draft form in the Workshop,
// the live preview beside it, and the card as it appears in the game app. Adding a
// block type here is all it takes to make it available to every game.

export type FieldType = 'text' | 'longtext' | 'number' | 'list' | 'select';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];   // for 'select'
  required?: boolean;
  /** Shown as the card's title in previews and lists. One per block. */
  title?: boolean;
}

/** fact = checked against a source; opinion = ranked by votes; mixed = has both. */
export type BlockKind = 'fact' | 'opinion' | 'mixed';

export interface BlockDef {
  key: string;
  title: string;
  icon: string;        // lucide-react icon name
  blurb: string;       // one line for the game app and the Workshop
  kind: BlockKind;
  fields: Field[];
}

export const BLOCKS: Record<string, BlockDef> = {
  progress: {
    key: 'progress', title: 'Progress', icon: 'Flag', kind: 'fact',
    blurb: 'Where you are: chapters, dungeons or days. Everything else follows it.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', title: true, required: true, placeholder: 'Chapter 4: Threads of Fate' },
      { key: 'order', label: 'Order', type: 'number', required: true, placeholder: '4' },
      { key: 'route', label: 'Route or branch', type: 'text', placeholder: 'Leave blank if every route shares it' },
      { key: 'summary', label: 'What happens (spoiler-light)', type: 'longtext', placeholder: 'A short, spoiler-light note' },
    ],
  },
  people: {
    key: 'people', title: 'People', icon: 'Users', kind: 'fact',
    blurb: 'Who they are, how to recruit or befriend them, and what they like.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', title: true, required: true, placeholder: 'Their name' },
      { key: 'joins', label: 'Joins or appears', type: 'text', placeholder: 'Chapter 6' },
      { key: 'how', label: 'How to recruit or meet', type: 'longtext', placeholder: 'Talk to them with ... before turn 5' },
      { key: 'role', label: 'Starting class or role', type: 'text', placeholder: 'Cavalier' },
      { key: 'likes', label: 'Likes', type: 'list', placeholder: 'One per line' },
    ],
  },
  missables: {
    key: 'missables', title: 'Missables', icon: 'Hourglass', kind: 'fact',
    blurb: "Last chances: what you'll lose for good if you don't act in time.",
    fields: [
      { key: 'what', label: 'What you can miss', type: 'text', title: true, required: true, placeholder: 'Recruiting a unit, a unique item...' },
      { key: 'before', label: 'Before when', type: 'text', required: true, placeholder: 'Before the end of chapter 9' },
      { key: 'how', label: 'How not to miss it', type: 'longtext', placeholder: 'Steps, in order' },
    ],
  },
  items: {
    key: 'items', title: 'Items', icon: 'Backpack', kind: 'fact',
    blurb: "What it is, where to get it, and what it's for.",
    fields: [
      { key: 'name', label: 'Name', type: 'text', title: true, required: true, placeholder: 'Item name' },
      { key: 'type', label: 'Type', type: 'text', placeholder: 'Weapon, gift, key item...' },
      { key: 'where', label: 'Where to get it', type: 'longtext', placeholder: 'Shop, chest, drop...' },
      { key: 'use', label: 'Used for', type: 'longtext', placeholder: 'What it does or who wants it' },
    ],
  },
  collections: {
    key: 'collections', title: 'Collections', icon: 'Trophy', kind: 'fact',
    blurb: 'Checklists you can tick off: collectibles, bundles, achievements.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', title: true, required: true, placeholder: 'Piece of Heart #12' },
      { key: 'where', label: 'Where', type: 'longtext', placeholder: 'Exact spot and what you need' },
      { key: 'needs', label: 'Needs', type: 'text', placeholder: 'An item or ability you need first' },
    ],
  },
  places: {
    key: 'places', title: 'Places', icon: 'MapPin', kind: 'fact',
    blurb: "What's where, and when.",
    fields: [
      { key: 'name', label: 'Name', type: 'text', title: true, required: true, placeholder: 'Place name' },
      { key: 'unlock', label: 'How to get there', type: 'longtext' },
      { key: 'notable', label: "What's there", type: 'list', placeholder: 'One per line' },
    ],
  },
  foes: {
    key: 'foes', title: 'Foes', icon: 'Swords', kind: 'mixed',
    blurb: 'Bosses and enemies: what they do, what beats them.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', title: true, required: true, placeholder: 'Boss or enemy' },
      { key: 'where', label: 'Where', type: 'text', placeholder: 'Chapter or location' },
      { key: 'weak', label: 'Weak to', type: 'text' },
      { key: 'tips', label: 'How people beat it', type: 'longtext', placeholder: 'Your approach' },
    ],
  },
  builds: {
    key: 'builds', title: 'Builds', icon: 'Shield', kind: 'opinion',
    blurb: 'Classes, skills and setups the community rates.',
    fields: [
      { key: 'name', label: 'Build name', type: 'text', title: true, required: true, placeholder: 'Glass-cannon mage' },
      { key: 'for', label: 'For', type: 'text', placeholder: 'Which character or vehicle' },
      { key: 'path', label: 'Path', type: 'list', placeholder: 'One step per line' },
      { key: 'why', label: 'Why it works', type: 'longtext' },
    ],
  },
  howto: {
    key: 'howto', title: 'How-to', icon: 'BookOpen', kind: 'fact',
    blurb: 'Unlocks and first-time tasks, in short steps.',
    fields: [
      { key: 'name', label: 'How to...', type: 'text', title: true, required: true, placeholder: 'Unlock the second class tier' },
      { key: 'steps', label: 'Steps', type: 'list', required: true, placeholder: 'One step per line' },
      { key: 'tip', label: 'Tip', type: 'text' },
    ],
  },
  mysteries: {
    key: 'mysteries', title: 'Mysteries', icon: 'CircleHelp', kind: 'mixed',
    blurb: "Open questions nobody has cracked yet. Bring theories.",
    fields: [
      { key: 'name', label: 'The question', type: 'text', title: true, required: true, placeholder: 'What triggers the hidden ending?' },
      { key: 'known', label: 'What we know so far', type: 'longtext' },
      { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Theory', 'Confirmed'] },
    ],
  },
};

/** Genre presets: a starting set of blocks, in order. A game can add or drop blocks. */
export const PRESETS: Record<string, string[]> = {
  'tactics-rpg': ['progress', 'people', 'missables', 'builds', 'items', 'foes', 'howto', 'mysteries'],
  'action-adventure': ['progress', 'collections', 'missables', 'items', 'places', 'foes', 'howto', 'mysteries'],
  'life-sim': ['progress', 'people', 'collections', 'items', 'places', 'howto', 'mysteries'],
};

export function titleField(def: BlockDef): Field {
  return def.fields.find((f) => f.title) ?? def.fields[0];
}
