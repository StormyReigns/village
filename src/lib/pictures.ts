import 'server-only';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Game } from '@/data/games';

const EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg'];

/**
 * Finds a picture saved in /public under a fixed name, whatever its file type.
 * `base` is the path without the extension, e.g. '/village/hero'.
 * Checked when the site is built, so a new picture shows up on the next deploy.
 */
export function findPicture(base: string): string | undefined {
  for (const ext of EXTENSIONS) {
    const url = `${base}.${ext}`;
    if (existsSync(join(process.cwd(), 'public', url))) return url;
  }
  return undefined;
}

/** Adds each game's cover from public/games/<id>/cover.* when one exists. */
export function withCovers(games: Game[]): Game[] {
  return games.map((g) => ({ ...g, cover: g.cover ?? findPicture(`/games/${g.id}/cover`) }));
}
