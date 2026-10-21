import type { PlacedCard } from '@/data/content/types';

const ROUTE_TINT: Record<string, string> = {
  cai: 'bg-sun-soft text-sun',
  dietrich: 'bg-sky-soft text-sky',
  theodora: 'bg-leaf-soft text-leaf',
  leda: 'bg-berry-soft text-berry',
};

/** Small labels on a card: which routes it's for, and whether it's checked. */
export function CardChips({ card, showRoutes, routeLabels }: { card: PlacedCard; showRoutes: boolean; routeLabels: Record<string, string> }) {
  const partial = card.routes && card.routes.length > 0 && card.routes.length < Object.keys(routeLabels).length;
  const chips: { text: string; cls: string }[] = [];
  if (showRoutes && partial) for (const r of card.routes!) chips.push({ text: routeLabels[r] ?? r, cls: ROUTE_TINT[r] ?? 'bg-card-2 text-muted' });
  if (card.flag === 'disputed') chips.push({ text: 'Sources disagree', cls: 'bg-sun-soft text-sun' });
  if (card.flag === 'unconfirmed') chips.push({ text: 'Unconfirmed', cls: 'bg-card-2 text-muted' });
  if (!chips.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map((c) => <span key={c.text} className={'rounded-full px-2 py-0.5 text-xs font-bold ' + c.cls}>{c.text}</span>)}
    </span>
  );
}
