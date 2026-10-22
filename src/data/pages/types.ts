// The game app's shape: Pages (topics) made of Blocks (preset types) holding Entries.
// See "Game app" in CLAUDE.md. Starter content lives in files for now; it moves to the
// database when Builders start editing it.

import type { Route } from '@/data/content/types';

export type { Route };

/** A Page's color, from a fixed set. */
export type Tint = 'leaf' | 'sky' | 'berry' | 'sun' | 'plum' | 'teal';

/** How a Collection shows its entries: portrait cards, inventory slots, or a list. */
export type Look = 'portraits' | 'slots' | 'rows';

/** The four preset Block types. New ones come from community requests. */
export type BlockType = 'collection' | 'guide' | 'checklist' | 'timeline';

/** A "+" section on an entry: a label the Builder chose, and its text. Lines become a list. */
export interface Section { label: string; text: string }

export interface Entry {
  id: string;
  name: string;
  /** A picture, once uploads exist. Until then the tile shows initials. */
  icon?: string;
  description?: string;
  sections: Section[];
  /** Filter values, keyed by the Block's filter names, e.g. { Group: 'Fiery Mane' }. */
  categories: Record<string, string>;
  /** Routes it appears on. Missing or empty means every route. */
  routes?: Route[];
  /** Sections that only show for one route, e.g. how to recruit someone as Theodora. */
  perRoute?: Partial<Record<Route, Section[]>>;
  /** A short key fact shown on the tile or row, like "Lv 12". */
  stat?: string;
  /** Timeline position. */
  order?: number;
  spoiler?: boolean;
  flag?: 'unconfirmed' | 'disputed';
  source?: string;
  /** Where it lives in the database: the entry and its Stable revision. Drafts edit these. */
  ref?: { card: string; revision: number };
}

/** What a Draft proposes for an entry: everything except its address. */
export type EntryContent = Omit<Entry, 'id' | 'ref'>;

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  icon: string;
  /** Collection only: how entries are shown. */
  look?: Look;
  /** Collection only: what the entries' stat means when it's a number, e.g. "Level". Adds a sort. */
  statName?: string;
  /** A sentence under the title saying what's here. */
  intro?: string;
  /** Category names players can filter by (Collection only). */
  filters?: string[];
  /** Entries change with the player's route, so the page shows a route switcher. */
  byRoute?: boolean;
  entries: Entry[];
}

export interface Page {
  id: string;
  title: string;
  /** A one-word name for tight spaces, like the phone's bottom bar. */
  short: string;
  icon: string;
  tint: Tint;
  blurb: string;
  blocks: Block[];
}
