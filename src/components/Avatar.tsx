/** A villager's face: their Discord picture, or their initials on a soft color. */
export function Avatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return url
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from Discord's servers
    ? <img src={url} alt="" style={style} className="shrink-0 rounded-full bg-card-2 object-cover" />
    : <span style={style} className="gloss grid shrink-0 place-items-center rounded-full bg-sky font-bold text-white" aria-hidden="true">{initials}</span>;
}
