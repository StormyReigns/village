import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Backpack, BookOpen, Check, Flag, Hourglass, House, MapPin, Plus, Users, type LucideIcon } from 'lucide-react';
import { Piece } from '@/components/Piece';

export const metadata: Metadata = { title: 'Brand samples', robots: { index: false } };

// A design playground for the piece (rules in CLAUDE.md, "Brand rules"), so it can be
// checked at every size before the rest of the site uses it. Not linked from the site.
// Ink and signal yellow are written out until they become site colors.

const INK = '#15171c';
const SIGNAL = '#FFC53D';
const SIZES = [260, 160, 96, 48, 32, 24, 16];

const PAGES: { title: string; tint: string; Icon: LucideIcon }[] = [
  { title: 'Units and classes', tint: 'berry', Icon: Users },
  { title: 'Items', tint: 'sun', Icon: Backpack },
  { title: 'Last chances', tint: 'plum', Icon: Hourglass },
  { title: 'Story', tint: 'sky', Icon: Flag },
  { title: 'World', tint: 'teal', Icon: MapPin },
  { title: 'Guides', tint: 'leaf', Icon: BookOpen },
];

const UNITS = ['Leda', 'Buccar', 'Sirocco', 'Mu', 'Olympia', 'Maria'];
const TABS: { label: string; color: string; Icon: LucideIcon; on?: boolean }[] = [
  { label: 'Home', color: INK, Icon: House },
  { label: 'Units', color: 'var(--berry)', Icon: Users, on: true },
  { label: 'Items', color: 'var(--sun)', Icon: Backpack },
  { label: 'Missables', color: 'var(--plum)', Icon: Hourglass },
];

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="text-sm text-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

/** An entry: initials in the piece, the name underneath. */
function Entry({ name, color, size = 120 }: { name: string; color: string; size?: number }) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <Piece size={size} color={color}>{name.slice(0, 2)}</Piece>
      <figcaption className="text-sm font-bold">{name}</figcaption>
    </figure>
  );
}

export default function BrandLab() {
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-6 sm:px-6">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Village square" className="grid size-9 place-items-center rounded-full bg-card ring-1 ring-line hover:ring-ink">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Lab</p>
          <h1 className="text-2xl font-extrabold">The piece</h1>
        </div>
      </header>

      <Section title="Every size" note="One shape, only scaled. The slice stays visible down to tab-icon size.">
        <div className="flex flex-wrap items-end gap-6 rounded-2xl bg-card p-6 ring-1 ring-line">
          {SIZES.map((s) => <Piece key={s} size={s} color={INK} label={`${s} pixels wide`} />)}
        </div>
        <div className="flex flex-wrap items-end gap-6 rounded-2xl p-6" style={{ background: INK }}>
          {SIZES.map((s) => <Piece key={s} size={s} color={SIGNAL} />)}
        </div>
      </Section>

      <Section title="One color per Page" note="Each Page's symbol sits in a piece of its color. These are today's colors; step 3 deepens them.">
        <div className="flex flex-wrap gap-6 rounded-2xl bg-card p-6 ring-1 ring-line">
          {PAGES.map(({ title, tint, Icon }) => (
            <figure key={title} className="flex w-28 flex-col items-center gap-1 text-center">
              <Piece size={96} color={`var(--${tint})`}><Icon size={22} strokeWidth={2.4} aria-hidden="true" /></Piece>
              <figcaption className="text-sm font-bold leading-tight">{title}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="Entries" note="Initials in the piece, below the slice; the name underneath. A clear gap, so tabs never reach a neighbour.">
        <div className="flex flex-wrap gap-x-3 gap-y-4 rounded-2xl p-6" style={{ background: 'var(--berry-soft)' }}>
          {UNITS.map((u) => <Entry key={u} name={u} color="var(--berry)" />)}
        </div>
      </Section>

      <Section title="Navigation" note="A symbol per Page; only the current one sits in a piece.">
        <nav aria-label="Sample tabs" className="grid max-w-md grid-cols-4 rounded-2xl bg-card px-2 pb-3 pt-2 ring-1 ring-line">
          {TABS.map(({ label, color, Icon, on }) => (
            <span key={label} className={`flex flex-col items-center gap-1 text-xs font-bold ${on ? 'text-ink' : 'text-muted'}`}>
              {on
                ? <Piece size={46} color={color}><Icon size={16} strokeWidth={2.4} aria-hidden="true" /></Piece>
                : <span className="grid h-[33px] place-items-center" style={{ color }}><Icon size={20} aria-hidden="true" /></span>}
              {label}
            </span>
          ))}
        </nav>
      </Section>

      <Section title="Built, and not built yet" note="Solid is in the app. The pink and violet split outline is an empty slot, an unticked box, or something to add.">
        <div className="flex flex-wrap items-center gap-8 rounded-2xl bg-card p-6 ring-1 ring-line">
          <span className="flex items-center gap-3 text-sm font-bold">
            <Piece size={46} color="var(--plum)" label="Done"><Check size={16} strokeWidth={3} /></Piece> Done
          </span>
          <span className="flex items-center gap-3 text-sm font-bold">
            <Piece size={46} outline ink={INK} label="Not done" /> Not done
          </span>
          <Entry name="Glirmosa" color="var(--leaf)" />
          <figure className="flex flex-col items-center gap-1">
            <Piece size={120} outline ink={INK}><Plus size={22} strokeWidth={2.6} aria-hidden="true" /></Piece>
            <figcaption className="text-sm font-bold">Add an item</figcaption>
          </figure>
        </div>
        <div className="flex flex-wrap items-center gap-8 rounded-2xl p-6" style={{ background: INK }}>
          <Piece size={160} color="var(--berry)" />
          <Piece size={160} color="var(--sun)" />
          <Piece size={160} outline ink="#fff" />
        </div>
      </Section>
    </main>
  );
}
