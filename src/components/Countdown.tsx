'use client';

import { useSyncExternalStore } from 'react';
import { daysUntil } from '@/data/games';

// Dates are computed in the browser so pages can be prerendered once and stay correct.
const subscribe = () => () => {};

export function Countdown({ date, before, after }: { date: string; before: string; after: string }) {
  const days = useSyncExternalStore(subscribe, () => daysUntil(date), () => null);
  if (days === null) return <span>{before}</span>;
  if (days > 1) return <span>{before} in {days} days</span>;
  if (days === 1) return <span>{before} tomorrow</span>;
  if (days === 0) return <span>{before} today</span>;
  return <span>{after}</span>;
}

/** Market Day is the weekly release. Sunday for now. */
export function MarketDay() {
  const days = useSyncExternalStore(subscribe, () => (7 - new Date().getDay()) % 7, () => null);
  if (days === null) return <span>Market Day each Sunday</span>;
  return <span>{days === 0 ? 'Market Day is today' : days === 1 ? 'Market Day tomorrow' : `Market Day in ${days} days`}</span>;
}
