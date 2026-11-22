'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Hammer } from 'lucide-react';
import type { Game } from '@/data/games';
import type { Shade } from '@/lib/shades';
import { GameCover } from '@/components/GameCover';
import { useVillager } from '@/components/useVillager';
import { useGames } from '@/components/GamesProvider';
import { browserClient } from '@/lib/supabase/browser';
import { gamesChanged } from '@/app/actions';

// The start-a-game form (docs/games.md, slice 2): only the basics. Cover, routes and the wiki come later, from the
// game's own Workshop. start_game (20261201000000) checks everything again, makes the address and the starter its
// moderator, and refuses a game that's already here.

/** The looks a game can take, in players' words, with the color shade each one is (src/lib/shades.ts). */
const LOOKS: { shade: Shade; label: string; hint: string; hue: Game['hue'] }[] = [
  { shade: 'fantasy', label: 'Fantasy and adventure', hint: 'RPGs, quests, swords and spells', hue: 'berry' },
  { shade: 'cozy', label: 'Cozy', hint: 'Farming, life sims, gentle games', hue: 'sun' },
  { shade: 'shooter', label: 'Action and shooters', hint: 'Fast, loud, competitive', hue: 'sky' },
  { shade: 'openworld', label: 'Open world', hint: 'Big maps to explore', hue: 'leaf' },
  { shade: 'standard', label: 'Something else', hint: 'Puzzles, racing, sports, anything', hue: 'sky' },
];

/** A first guess at the look from the kind of game typed, until the Builder picks one. */
function guessLook(kind: string): Shade | null {
  const k = kind.toLowerCase();
  if (/farm|cozy|life|sim|cook|town/.test(k)) return 'cozy';
  if (/shoot|fps|battle royale|action|fight|hero/.test(k)) return 'shooter';
  if (/open world|sandbox|survival|craft/.test(k)) return 'openworld';
  if (/rpg|fantasy|adventure|tactic|quest|souls|metroid|zelda|dungeon/.test(k)) return 'fantasy';
  return k.trim() ? 'standard' : null;
}

/** What players call it: the part after the colon ("The Legend of Zelda: Ocarina of Time" → "Ocarina of Time"). */
const shortFrom = (name: string) => (name.includes(':') ? name.split(':').slice(1).join(':') : name).trim().slice(0, 40);
/** Its address, as start_game makes it (the database has the last word, and adds a number if it's taken). */
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const lettersOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const PLATFORMS = ['Nintendo Switch 2', 'Nintendo Switch', 'PlayStation 5', 'Xbox Series X|S', 'PC', 'iPhone and Android'];
const KINDS = ['Action RPG', 'Tactics RPG', 'JRPG', 'Action-adventure', 'Farming sim', 'Life sim', 'Shooter', 'Open world', 'Metroidvania', 'Platformer', 'Racing', 'Strategy', 'Survival'];

const box = 'w-full rounded-xl bg-card px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-signal';

export function StartGame() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useVillager();
  const games = useGames();
  const [name, setName] = useState(() => (params.get('name') ?? '').slice(0, 120));
  const [short, setShort] = useState<string | null>(null);
  const [platform, setPlatform] = useState('');
  const [release, setRelease] = useState('');
  const [kind, setKind] = useState('');
  const [look, setLook] = useState<Shade | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const shortName = short ?? shortFrom(name);
  const shade = look ?? guessLook(kind) ?? 'standard';
  const info = LOOKS.find((l) => l.shade === shade)!;
  // Already in Village, as start_game would see it: say so before they fill in the rest.
  const here = name.trim() ? games.find((g) => [lettersOf(name), lettersOf(shortName)].some((k) => k && (k === lettersOf(g.title) || k === lettersOf(g.shortTitle)))) : undefined;
  const preview: Game = {
    id: slugOf(shortName) || 'new-game', title: name.trim() || 'Your game', shortTitle: shortName || 'Your game', platform: platform.trim() || 'Platform',
    releaseDate: release || '2027-01-01', status: 'building', hue: info.hue, genre: kind.trim() || 'Kind of game', shade, popularity: 1000,
  };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setNote('Give the game its name.'); return; }
    if (!platform.trim()) { setNote('Say what it’s played on.'); return; }
    if (!release) { setNote('Add its release date. A guess is fine.'); return; }
    if (!kind.trim()) { setNote('Say what kind of game it is, in a few words.'); return; }
    const db = browserClient();
    if (!db) { setNote('Sign in first.'); return; }
    setBusy(true);
    setNote('');
    const { data, error } = await db.rpc('start_game', {
      p_title: name.trim(), p_short: shortName, p_platform: platform.trim(), p_release: release, p_genre: kind.trim(), p_shade: shade,
    });
    if (error || typeof data !== 'string') {
      setBusy(false);
      setNote(/function|schema cache/i.test(error?.message ?? '') ? 'Starting games is almost ready: the database needs one more update.' : error?.message ?? "Couldn't start it. Try again in a moment.");
      return;
    }
    await gamesChanged(data);
    router.push(`/g/${data}/workshop`);
  };

  return (
    <form onSubmit={start} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="font-display text-3xl">Start a game</h1>
          <p className="mt-1 text-muted">For a game that isn&apos;t in Village yet. Its Workshop opens right away, and you look after it at first. It joins the front page once players vote for it.</p>
        </div>

        {me === null && (
          <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm">
            <Link href={`/signin?next=${encodeURIComponent(`/start${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ''}`)}`} className="font-bold underline">Sign in</Link> to start a game. You can fill this in first.
          </p>
        )}

        <label className="grid gap-1">
          <span className="text-sm font-bold">The game&apos;s full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus placeholder="The Legend of Zelda: Ocarina of Time" className={box} />
        </label>
        {here && (
          <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm">
            <span className="font-bold">{here.title} is already in Village.</span>{' '}
            <Link href={`/g/${here.id}/workshop`} className="font-bold underline">Help build it there</Link>.
          </p>
        )}
        <label className="grid gap-1">
          <span className="text-sm font-bold">What players call it</span>
          <input value={shortName} onChange={(e) => setShort(e.target.value)} maxLength={40} placeholder="Ocarina of Time" className={box} />
          <span className="text-xs text-muted">Shown on its tile and in its app. {slugOf(shortName) && <>Its address: <span className="font-bold">/g/{slugOf(shortName)}</span></>}</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-bold">Played on</span>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={80} list="start-platforms" placeholder="Nintendo Switch 2" className={box} />
            <datalist id="start-platforms">{PLATFORMS.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-bold">Comes out <span className="font-normal text-muted">(a guess is fine)</span></span>
            <input type="date" value={release} onChange={(e) => setRelease(e.target.value)} className={box} />
          </label>
        </div>
        <label className="grid gap-1">
          <span className="text-sm font-bold">What kind of game it is</span>
          <input value={kind} onChange={(e) => setKind(e.target.value)} maxLength={40} list="start-kinds" placeholder="Action RPG" className={box} />
          <datalist id="start-kinds">{KINDS.map((k) => <option key={k} value={k} />)}</datalist>
        </label>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-bold">Closest look <span className="font-normal text-muted">(it shades the app&apos;s colors)</span></legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {LOOKS.map((l) => (
              <button key={l.shade} type="button" onClick={() => setLook(l.shade)} aria-pressed={shade === l.shade}
                className={'rounded-2xl px-3 py-2 text-left ring-1 ' + (shade === l.shade ? 'bg-signal ring-signal' : 'bg-card ring-line hover:ring-ink')}>
                <span className="block font-bold">{l.label}</span>
                <span className="block text-xs text-muted">{l.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {note && <p role="status" className="text-sm font-bold text-berry">{note}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !me || Boolean(here)} className="btn-primary inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 font-bold disabled:opacity-60">
            <Hammer size={16} aria-hidden="true" /> {busy ? 'Starting…' : `Start ${shortName || 'it'}`}
          </button>
          <span className="text-xs text-muted">One new game a day each. The cover, routes and wiki come later, from its Workshop.</span>
        </div>
      </div>

      {/* Its tile as it will look on the front page once it launches. */}
      <aside className="grid content-start gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Its tile, once it launches</p>
        <div className="surface overflow-hidden rounded-2xl">
          <GameCover game={preview} />
          <div className="p-3">
            <p className="font-display text-lg leading-tight">{preview.shortTitle}</p>
            <p className="text-sm text-muted">{preview.genre} · {preview.platform}</p>
          </div>
        </div>
      </aside>
    </form>
  );
}
