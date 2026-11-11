'use client';

import { createContext, useContext } from 'react';
import type { Kin } from '@/lib/class-fit';

// What a Page's cards know about the kin Block on the other side (units on a class card, classes
// on a unit card): built on the server by classKin in src/lib/class-fit.ts and handed down here, so
// a card can show "Classes for <name>" or "Who suits it" without loading another Page.
// Without a provider (Workshop previews, samples, share pictures) there's no kin, and nothing shows.

const KinContext = createContext<Kin[]>([]);

export function KinProvider({ kin, children }: { kin?: Kin[]; children: React.ReactNode }) {
  return <KinContext.Provider value={kin ?? []}>{children}</KinContext.Provider>;
}

/** The kin of the Block a card belongs to, if any. */
export const useKin = (blockId?: string) => {
  const all = useContext(KinContext);
  return blockId ? all.find((k) => k.forBlock === blockId) : undefined;
};
