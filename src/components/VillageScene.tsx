// The village scene in the square. Simple shapes for now; Village Projects will add
// decorations to it later.
export function VillageScene() {
  return (
    <svg viewBox="0 0 800 160" className="h-auto w-full" role="img" aria-label="A small village of houses on rolling hills">
      <path d="M0 120 C 120 70, 240 70, 360 110 S 600 150, 800 90 L 800 160 L 0 160 Z" fill="var(--leaf-soft)" />
      <path d="M0 140 C 160 110, 320 120, 480 140 S 700 150, 800 130 L 800 160 L 0 160 Z" fill="var(--leaf)" opacity="0.35" />
      <circle cx="690" cy="38" r="18" fill="var(--sun)" opacity="0.8" />
      {[
        { x: 150, y: 86, c: 'var(--berry)' },
        { x: 250, y: 92, c: 'var(--sky)' },
        { x: 470, y: 108, c: 'var(--sun)' },
        { x: 560, y: 100, c: 'var(--berry)' },
      ].map((h, i) => (
        <g key={i} transform={`translate(${h.x} ${h.y})`}>
          <rect x="-16" y="-18" width="32" height="24" rx="3" fill="var(--card)" stroke="var(--line)" />
          <path d="M-21 -16 L0 -34 L21 -16 Z" fill={h.c} />
          <rect x="-5" y="-8" width="10" height="14" rx="2" fill={h.c} opacity="0.55" />
        </g>
      ))}
      <g transform="translate(360 96)">
        <rect x="-26" y="-26" width="52" height="34" rx="4" fill="var(--card)" stroke="var(--line)" />
        <path d="M-32 -24 L0 -50 L32 -24 Z" fill="var(--leaf)" />
        <rect x="-7" y="-12" width="14" height="20" rx="3" fill="var(--leaf)" opacity="0.6" />
      </g>
      {[90, 320, 640, 720].map((x, i) => (
        <g key={i} transform={`translate(${x} ${i % 2 ? 110 : 100})`}>
          <rect x="-2" y="-4" width="4" height="12" fill="var(--muted)" opacity="0.6" />
          <circle cx="0" cy="-12" r="11" fill="var(--leaf)" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}
