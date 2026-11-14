import type { Block, EntryContent } from '@/data/pages';
import { hasIcon } from '@/components/Icon';

/**
 * The symbol for an entry, when its Block sets one for a tag value: its group's (the first
 * filter, e.g. a faction) first, else any of its other tags' (e.g. a weapon's type, while the
 * weapons are grouped by Rank).
 */
export function symbolFor(entry: EntryContent, block: Partial<Pick<Block, 'symbols' | 'filters'>>) {
  if (!block.symbols) return undefined;
  const first = block.filters?.[0] ? block.symbols[entry.categories[block.filters[0]]] : undefined;
  if (hasIcon(first)) return first;
  return Object.values(entry.categories).map((v) => block.symbols![v]).find(hasIcon);
}
