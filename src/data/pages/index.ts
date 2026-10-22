import type { Page } from './types';
import { PAGES as FORTUNES_WEAVE } from './fortunes-weave';

export type * from './types';

const BY_GAME: Record<string, Page[]> = {
  'fortunes-weave': FORTUNES_WEAVE,
};

export function pagesFor(gameId: string): Page[] {
  return BY_GAME[gameId] ?? [];
}
