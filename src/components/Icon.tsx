import {
  Backpack, BookOpen, CircleHelp, Flag, Hourglass, House, LayoutGrid, MapPin, Megaphone, Shield, Swords, Trophy, Users,
  Bird, Castle, Compass, Crown, Droplet, Flame, Flower2, Landmark, Lighthouse, Moon, Star, Tent, Wind,
  BadgeCheck, Gem, KeyRound, Package, ScrollText, Sparkles,
  BedDouble, Building2, Mountain, Pickaxe, Skull, Store, TreePalm, Trees, ClipboardList,
  FlaskConical, Gift, Scroll, Wheat,
  Axe, BowArrow, HandFist, Sun, Sword, WandSparkles,
  createLucideIcon, type LucideIcon, type LucideProps,
} from 'lucide-react';
import { Piece, pieceHeight } from './Piece';

/** A spear, which Lucide doesn't have, drawn in its style: a shaft corner to corner, a
 *  leaf-shaped head and a small guard. */
const Spear = createLucideIcon('spear', [
  ['path', { d: 'M3 21 13.5 10.5', key: 'shaft' }],
  ['path', { d: 'M13.5 10.5 15 5.5 21 3 18.5 9Z', key: 'head' }],
  ['path', { d: 'm11 8 5 5', key: 'guard' }],
]);

// Only the icons blocks, navigation and entry symbols use, so the bundle stays small.
const ICONS: Record<string, LucideIcon> = {
  Backpack, BookOpen, CircleHelp, Flag, Hourglass, House, LayoutGrid, MapPin, Megaphone, Shield, Swords, Trophy, Users,
  Bird, Castle, Compass, Crown, Droplet, Flame, Flower2, Landmark, Lighthouse, Moon, Star, Tent, Wind,
  BadgeCheck, Gem, KeyRound, Package, ScrollText, Sparkles,
  // Places' groups on the World map (src/lib/world-map.ts, groupSymbol).
  BedDouble, Building2, Mountain, Pickaxe, Skull, Store, TreePalm, Trees,
  // The Party Page (the Planner, docs/blocks/planner.md).
  ClipboardList,
  // Weapon types (docs/blocks/items.md): Sword, Spear, Axe, Bow, Gauntlet, Black and White Magic.
  Axe, BowArrow, HandFist, Spear, Sun, Sword, WandSparkles,
  // Item types (Fortune's Weave): consumables, gifts, spell scrolls, trade goods.
  FlaskConical, Gift, Scroll, Wheat,
};

/** Whether a symbol name is one we can draw. */
export const hasIcon = (name?: string) => Boolean(name && ICONS[name]);

export function BlockIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name] ?? CircleHelp;
  return <Cmp aria-hidden="true" {...props} />;
}

/**
 * A Page's symbol in navigation (brand rules in CLAUDE.md): plain in `color`, or inside a
 * piece of that color when it's the Page you're on. Both take the same space, so nothing
 * shifts when the choice moves.
 */
export function NavSymbol({ name, color, on, size = 40 }: { name: string; color: string; on: boolean; size?: number }) {
  const icon = Math.round(size * 0.4);
  if (on) return <Piece size={size} color={color}><BlockIcon name={name} size={icon} strokeWidth={2.4} /></Piece>;
  return (
    <span className="grid shrink-0 place-items-center" style={{ width: size, height: pieceHeight(size), color }}>
      <BlockIcon name={name} size={icon + 4} />
    </span>
  );
}
