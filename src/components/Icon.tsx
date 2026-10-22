import {
  Backpack, BookOpen, CircleHelp, Flag, Hourglass, LayoutGrid, MapPin, Shield, Swords, Trophy, Users,
  type LucideIcon, type LucideProps,
} from 'lucide-react';

// Only the icons blocks use, so the bundle stays small.
const ICONS: Record<string, LucideIcon> = {
  Backpack, BookOpen, CircleHelp, Flag, Hourglass, LayoutGrid, MapPin, Shield, Swords, Trophy, Users,
};

export function BlockIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name] ?? CircleHelp;
  return <Cmp aria-hidden="true" {...props} />;
}
