export type Route = 'cai' | 'dietrich' | 'theodora' | 'leda';

export interface Card {
  block: string;
  /** Field values for the starter codex, before it was turned into Pages. */
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
