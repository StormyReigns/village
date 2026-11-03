'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

/**
 * The way between the app and the Workshop keeps your place: from a Page in the app, the
 * Workshop opens on that Page; from a Page in the Workshop, the app opens on it.
 */
export function WorkshopLink({ gameId, className, children }: { gameId: string; className?: string; children: React.ReactNode }) {
  const page = useParams<{ page?: string }>().page;
  return <Link href={`/g/${gameId}/workshop${page ? `?page=${encodeURIComponent(page)}` : ''}`} className={className}>{children}</Link>;
}

/** The Workshop's "Open the app": the Page picked in the Workshop (?page=), else the app's front. */
export function OpenAppLink({ gameId, pageIds, className, label, children }: {
  gameId: string; pageIds: string[]; className?: string; label?: string; children: React.ReactNode;
}) {
  const page = useSearchParams().get('page');
  const href = page && pageIds.includes(page) ? `/g/${gameId}/${page}` : `/g/${gameId}`;
  return <Link href={href} aria-label={label} className={className}>{children}</Link>;
}
