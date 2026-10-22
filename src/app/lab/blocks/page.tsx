import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { BlockIcon } from '@/components/Icon';

export const metadata: Metadata = { title: 'Block samples', robots: { index: false } };

// A design playground for the village block: roof shapes, where the roof sits, and how
// a whole row feels when every block is a little different. Not linked from the site.

interface Sample {
  id: string;
  name: string;
  tint: string;
  icon: string;
  label: string;
  roof?: string;
  at?: string;
  side?: 'left' | 'right';
  tilt?: 'left' | 'right';
  color?: 'deep' | 'full' | 'pale';
  on?: boolean;
}

function Chip({ s, caption = true }: { s: Sample; caption?: boolean }) {
  const style = { '--tint': `var(--${s.tint})`, ...(s.at ? { '--at': s.at } : {}) } as React.CSSProperties;
  return (
    <figure className="flex flex-col items-center gap-2">
      <span style={style} data-roof={s.roof} data-roof-side={s.side} data-tilt={s.tilt} data-roof-color={s.color}
        className={'vblock flex w-28 shrink-0 flex-col items-center gap-1.5 px-2 pb-2.5 pt-3 text-center ' + (s.on ? 'is-on gloss' : '')}>
        <span className={'grid size-9 place-items-center rounded-xl ' + (s.on ? 'bg-white/25' : 'bg-white/70')}><BlockIcon name={s.icon} size={18} /></span>
        <span className="text-xs font-bold leading-tight">{s.label}</span>
      </span>
      {caption && <figcaption className="text-center text-xs"><span className="font-bold">{s.id}</span> <span className="text-muted">{s.name}</span></figcaption>}
    </figure>
  );
}

function Card({ tint, kind, name, roof, at, tilt, color }: { tint: string; kind: string; name: string; roof?: string; at?: string; tilt?: 'left' | 'right'; color?: 'deep' | 'full' | 'pale' }) {
  return (
    <span style={{ '--tint': `var(--${tint})`, ...(at ? { '--at': at } : {}) } as React.CSSProperties} data-roof={roof} data-tilt={tilt} data-roof-color={color}
      className="vblock flex w-52 shrink-0 flex-col gap-2 px-3 pb-3 pt-3.5 text-left">
      <span className="text-[11px] font-bold uppercase tracking-wide">{kind}</span>
      <span className="font-bold leading-tight text-ink">{name}</span>
      <span className="flex items-center gap-1.5 text-xs font-bold">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80"><span className="block h-full w-2/5 rounded-full bg-current" /></span>
        2 of 5 votes
      </span>
    </span>
  );
}

const SHAPES: Sample[] = [
  { id: 'A1', name: 'Peak (today)', tint: 'berry', icon: 'Users', label: 'Units' },
  { id: 'A2', name: 'Dome', tint: 'sun', icon: 'Backpack', label: 'Items', roof: 'dome' },
  { id: 'A3', name: 'Steep', tint: 'plum', icon: 'Hourglass', label: 'Last chances', roof: 'steep' },
  { id: 'A4', name: 'Wide', tint: 'sky', icon: 'Flag', label: 'Story', roof: 'wide' },
  { id: 'A5', name: 'Stepped gable', tint: 'teal', icon: 'MapPin', label: 'World', roof: 'gable' },
  { id: 'A6', name: 'Thatch', tint: 'leaf', icon: 'BookOpen', label: 'Guides', roof: 'thatch' },
  { id: 'A7', name: 'Chimney', tint: 'berry', icon: 'Shield', label: 'Classes', roof: 'chimney' },
  { id: 'A8', name: 'Flag', tint: 'sun', icon: 'Trophy', label: 'Collect', roof: 'flag' },
  { id: 'A9', name: 'Bump', tint: 'sky', icon: 'Swords', label: 'Foes', roof: 'bump' },
  { id: 'A10', name: 'Sprout', tint: 'teal', icon: 'CircleHelp', label: 'Mysteries', roof: 'sprout' },
];

const PLACES: Sample[] = [
  { id: 'B1', name: 'Left', color: 'deep', tint: 'sun', icon: 'Backpack', label: 'Items', at: '26%' },
  { id: 'B2', name: 'Center', color: 'deep', tint: 'sun', icon: 'Backpack', label: 'Items' },
  { id: 'B3', name: 'Right', color: 'deep', tint: 'sun', icon: 'Backpack', label: 'Items', at: '74%' },
  { id: 'B4', name: 'Tilted', color: 'deep', tint: 'sun', icon: 'Backpack', label: 'Items', at: '36%', tilt: 'left' },
  { id: 'B5', name: 'Right side', color: 'deep', tint: 'sun', icon: 'Backpack', label: 'Items', side: 'right', at: '40%' },
  { id: 'B6', name: 'Left side', color: 'deep', tint: 'sun', icon: 'Backpack', label: 'Items', side: 'left', at: '60%' },
];

// A whole row where every block is different: shape, spot and a slight lean.
const MIXED: Sample[] = [
  { id: '', name: '', tint: 'ink', icon: 'LayoutGrid', label: 'Everything', roof: 'gable' },
  { id: '', name: '', tint: 'berry', icon: 'Users', label: 'Units and classes', roof: 'chimney', at: '32%', tilt: 'right' },
  { id: '', name: '', tint: 'sun', icon: 'Backpack', label: 'Items', roof: 'dome', at: '66%', on: true },
  { id: '', name: '', tint: 'plum', icon: 'Hourglass', label: 'Last chances', roof: 'flag', at: '28%', tilt: 'left' },
  { id: '', name: '', tint: 'sky', icon: 'Flag', label: 'Story', roof: 'steep', at: '58%' },
  { id: '', name: '', tint: 'teal', icon: 'MapPin', label: 'World', roof: 'thatch', at: '42%', tilt: 'right' },
  { id: '', name: '', tint: 'leaf', icon: 'BookOpen', label: 'Guides', roof: 'sprout', at: '70%' },
  { id: '', name: '', tint: 'berry', icon: 'Flag', label: 'Notice Board', roof: 'bump', at: '30%', tilt: 'left' },
];

// The same row with one shape, just moved around: calmer, still not identical.
const CALM: Sample[] = MIXED.map((s, i) => ({ ...s, roof: undefined, tilt: undefined, at: ['50%', '30%', '68%', '40%', '60%', '34%', '72%', '45%'][i] }));
const DEEP = (list: Sample[]) => list.map((s) => ({ ...s, color: 'deep' as const }));

const COLORS: Sample[] = [
  { id: 'E1', name: 'Same as block', tint: 'berry', icon: 'Users', label: 'Units', roof: 'gable', color: 'pale' },
  { id: 'E2', name: 'Deeper shade', tint: 'berry', icon: 'Users', label: 'Units', roof: 'gable', color: 'deep' },
  { id: 'E3', name: 'Full color', tint: 'berry', icon: 'Users', label: 'Units', roof: 'gable', color: 'full' },
  { id: 'E4', name: 'Deeper, chimney', tint: 'teal', icon: 'MapPin', label: 'World', roof: 'chimney', color: 'deep', at: '38%' },
  { id: 'E5', name: 'Full, thatch', tint: 'sun', icon: 'Backpack', label: 'Items', roof: 'thatch', color: 'full', at: '60%' },
];

function Row({ items }: { items: Sample[] }) {
  return (
    <div className="chip-strip -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 pt-6">
      {items.map((s, i) => <Chip key={i} s={s} caption={false} />)}
    </div>
  );
}

function Section({ letter, title, note, children }: { letter: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-[1.75rem] p-5 sm:p-6">
      <h2 className="font-display text-2xl"><span className="text-muted">{letter}</span> {title}</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function BlockSamples() {
  return (
    <main className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-5 px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> Village square
      </Link>
      <div>
        <h1 className="font-display text-4xl">Block samples</h1>
        <p className="mt-1 text-muted">Ideas for the village block. Pick favorites by their names, like &ldquo;A5, B4, C&rdquo;.</p>
      </div>

      <Section letter="A" title="Roof shapes" note="One shape each, in the middle. A1 is what the site uses today.">
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 pt-3 sm:grid-cols-5">
          {SHAPES.map((s) => <Chip key={s.id} s={s} />)}
        </div>
      </Section>

      <Section letter="B" title="Where the roof sits" note="The same block with its roof moved along the top, tilted, or on a side (roofs in the deeper shade so they show).">
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 pt-3 sm:grid-cols-6">
          {PLACES.map((s) => <Chip key={s.id} s={s} />)}
        </div>
      </Section>

      <Section letter="C" title="A whimsical village" note="Every Page gets its own roof, spot and slight lean, so the row reads like a street of different houses.">
        <Row items={DEEP(MIXED)} />
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Open items in the same style</p>
        <div className="chip-strip -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 pt-6">
          <Card tint="sun" kind="Ready to publish" name="Paradise Fish" roof="wide" at="30%" color="deep" />
          <Card tint="leaf" kind="Your Draft" name="Silver Shield" roof="chimney" at="68%" tilt="right" color="deep" />
          <Card tint="sky" kind="Needs your vote" name="Goliath" roof="dome" at="24%" color="deep" />
          <Card tint="teal" kind="You voted" name="Niraga Mine" roof="thatch" at="55%" tilt="left" color="deep" />
        </div>
      </Section>

      <Section letter="D" title="A calmer village" note="One roof shape everywhere, only moved around. A quieter middle ground between today and C.">
        <Row items={DEEP(CALM)} />
      </Section>

      <Section letter="E" title="Roof color" note="The roof can match the block, be a deeper shade (as in C and D), or take the full color. A is all E1.">
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 pt-3 sm:grid-cols-5">
          {COLORS.map((s) => <Chip key={s.id} s={s} />)}
        </div>
      </Section>

      <Section letter="F" title="Big blocks" note="The same idea on a large Block, like the ones in the Workshop's right panel.">
        <div className="grid gap-8 pt-4 sm:grid-cols-2">
          {[{ roof: 'thatch', at: '28%', tint: 'sun', title: 'Items' }, { roof: 'chimney', at: '70%', tint: 'berry', title: 'Units' }].map((b) => (
            <div key={b.title} style={{ '--tint': `var(--${b.tint})`, '--at': b.at } as React.CSSProperties} data-roof={b.roof} data-roof-color="full" className="vblock vblock-quiet p-4">
              <p className="font-bold">{b.title}</p>
              <p className="mt-1 text-sm text-muted">Entries listed here, each with Fix. The roof sits off to one side on bigger blocks.</p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
