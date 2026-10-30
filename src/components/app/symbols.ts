import type { Block, EntryContent } from '@/data/pages';
import { hasIcon } from '@/components/Icon';

/** The symbol for an entry's group (its first filter value), when its Block sets one. */
export function symbolFor(entry: EntryContent, block: Partial<Pick<Block, 'symbols' | 'filters'>>) {
  const value = block.filters?.[0] ? entry.categories[block.filters[0]] : undefined;
  const name = value ? block.symbols?.[value] : undefined;
  return hasIcon(name) ? name : undefined;
}
