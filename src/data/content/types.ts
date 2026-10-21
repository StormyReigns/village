export type Route = 'cai' | 'dietrich' | 'theodora' | 'leda';

export interface Card {
  block: string;
  /** Field values, keyed by the block's field keys (see src/lib/blocks.ts). */
  content: Record<string, string>;
  /** Which routes or paths the card applies to. Game-specific; empty = all. */
  routes?: Route[];
  /** Hidden behind the spoiler switch until the player turns spoilers on. */
  spoiler?: boolean;
  /** unconfirmed = not documented yet; disputed = sources disagree. */
  flag?: 'unconfirmed' | 'disputed';
  /** Where the facts came from. */
  source?: string;
}

export interface PlacedCard extends Card {
  slug: string;
  title: string;
}
