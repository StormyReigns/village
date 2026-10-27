import {
  Backpack, BookOpen, CircleHelp, Flag, Hourglass, House, LayoutGrid, MapPin, Megaphone, Shield, Swords, Trophy, Users,
  Bird, Castle, Compass, Crown, Droplet, Flame, Flower2, Landmark, Lighthouse, Moon, Star, Tent, Wind,
  type LucideIcon, type LucideProps,
} from 'lucide-react';
import { Piece, pieceHeight } from './Piece';

// Only the icons blocks, navigation and entry symbols use, so the bundle stays small.
const ICONS: Record<string, LucideIcon> = {
  Backpack, BookOpen, CircleHelp, Flag, Hourglass, House, LayoutGrid, MapPin, Megaphone, Shield, Swords, Trophy, Users,
  Bird, Castle, Compass, Crown, Droplet, Flame, Flower2, Landmark, Lighthouse, Moon, Star, Tent, Wind,
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
