// Where a game's cover picture is (docs/games.md, slice 4): a starter game's file in /public ("/games/x/cover.webp"),
// or a Builder's upload, kept as its path in the guide-pictures bucket ("game/person/file.webp"). Works on the
// server and in the browser, so the front page can be prerendered with it.

import { SUPABASE_URL } from './supabase/config';

export const coverSrc = (cover: string) =>
  cover.startsWith('/') ? cover : `${SUPABASE_URL}/storage/v1/object/public/guide-pictures/${cover.split('/').map(encodeURIComponent).join('/')}`;
