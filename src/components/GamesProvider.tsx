'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { STARTER_GAMES, type Game } from '@/data/games';

// The games list in the browser (docs/games.md): read once on the server by the root layout (getGames, cached) and
// handed down, so names and shades come from the database like everything else.

const Games = createContext<Game[]>(STARTER_GAMES);

export function GamesProvider({ games, children }: { games: Game[]; children: ReactNode }) {
  return <Games.Provider value={games}>{children}</Games.Provider>;
}

/** Every game in the village. */
export const useGames = () => useContext(Games);

/** One game by its address, or undefined. */
export function useGame(id?: string) {
  const games = useGames();
  return id ? games.find((g) => g.id === id) : undefined;
}
