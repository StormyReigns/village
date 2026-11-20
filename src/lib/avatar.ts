// Profile pictures (supabase/migrations/20261125000000_profile_pictures.sql). A profile's
// `picture` is null (use the Discord picture in avatar_url), 'none' (initials), or a file the
// villager uploaded to the "avatars" bucket. Every place that shows a villager reads it here.

import { SUPABASE_URL } from './supabase/config.ts';

export const AVATAR_BUCKET = 'avatars';

/** The address of an uploaded picture. */
export const pictureAddress = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;

/**
 * The picture to show for a profile row (or null for initials). `fallback` is a Discord picture
 * known some other way (the signed-in villager's own sign-in details).
 */
export function avatarOf(p: { picture?: unknown; avatar_url?: unknown } | null | undefined, fallback?: string | null): string | null {
  const picture = typeof p?.picture === 'string' ? p.picture : null;
  if (picture === 'none') return null;
  if (picture) return pictureAddress(picture);
  return (typeof p?.avatar_url === 'string' && p.avatar_url) || fallback || null;
}
