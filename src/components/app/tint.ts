import type { Tint } from '@/data/pages';

// Each Page has its own color. Written out in full so Tailwind keeps every class.
export const TINT: Record<Tint, { solid: string; soft: string; text: string; ring: string }> = {
  leaf: { solid: 'bg-leaf', soft: 'bg-leaf-soft', text: 'text-leaf', ring: 'ring-leaf' },
  sky: { solid: 'bg-sky', soft: 'bg-sky-soft', text: 'text-sky', ring: 'ring-sky' },
  berry: { solid: 'bg-berry', soft: 'bg-berry-soft', text: 'text-berry', ring: 'ring-berry' },
  sun: { solid: 'bg-sun', soft: 'bg-sun-soft', text: 'text-sun', ring: 'ring-sun' },
  plum: { solid: 'bg-plum', soft: 'bg-plum-soft', text: 'text-plum', ring: 'ring-plum' },
  teal: { solid: 'bg-teal', soft: 'bg-teal-soft', text: 'text-teal', ring: 'ring-teal' },
};
