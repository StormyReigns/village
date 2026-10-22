// Ocarina of Time: the Pages and Blocks ready for launch day, with no entries yet.
// The community fills them in the Workshop.

import type { Page } from './types.ts';

export const PAGES: Page[] = [
  {
    id: 'story', title: 'Dungeons', short: 'Dungeons', icon: 'Flag', tint: 'sky',
    blurb: 'Every temple and dungeon in order, kept spoiler-light.',
    blocks: [{ id: 'story', type: 'timeline', title: 'Dungeons', icon: 'Flag', entries: [] }],
  },
  {
    id: 'collectibles', title: 'Hearts and Skulltulas', short: 'Collect', icon: 'Trophy', tint: 'berry',
    blurb: 'Pieces of Heart, Gold Skulltulas and other things worth collecting. Tick them off as you go.',
    blocks: [{ id: 'collectibles', type: 'checklist', title: 'Collectibles', icon: 'Trophy', entries: [] }],
  },
  {
    id: 'items', title: 'Items', short: 'Items', icon: 'Backpack', tint: 'sun',
    blurb: 'Gear, songs and key items: where to find them and what they do.',
    blocks: [{ id: 'items', type: 'collection', look: 'slots', title: 'Items', icon: 'Backpack', filters: ['Type'], entries: [] }],
  },
  {
    id: 'world', title: 'World', short: 'World', icon: 'MapPin', tint: 'teal',
    blurb: 'Places to explore, and the foes you will meet there.',
    blocks: [
      { id: 'places', type: 'collection', look: 'rows', title: 'Places', icon: 'MapPin', filters: ['Region'], entries: [] },
      { id: 'foes', type: 'collection', look: 'rows', title: 'Foes', icon: 'Swords', entries: [] },
    ],
  },
  {
    id: 'guides', title: 'Guides', short: 'Guides', icon: 'BookOpen', tint: 'leaf',
    blurb: "How things work, and the questions nobody has answered yet.",
    blocks: [
      { id: 'how-to', type: 'guide', title: 'How to', icon: 'BookOpen', entries: [] },
      { id: 'mysteries', type: 'collection', look: 'rows', title: 'Mysteries', icon: 'CircleHelp', filters: ['Status'], entries: [] },
    ],
  },
];
