'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Info, Plus, Signpost, Trash2 } from 'lucide-react';
import type { Game } from '@/data/games';
import type { Villager } from '@/components/useVillager';
import { Tip } from '@/components/Tip';
import { GameCover } from '@/components/GameCover';
import { browserClient } from '@/lib/supabase/browser';
import { gamesChanged } from '@/app/actions';
import { LOOKS, lookOf } from '@/lib/game-looks';
import { changedSettings, routeKey, settingsContent, settingsOfRow, type GameSettings, type PathsRow } from '@/lib/game-settings';
import { EditorShell } from './EditorShell';
import { uploadPicture, type NewDraft } from './useWorkshop';

// A game's settings (docs/games.md, slice 4): its name, short name, platform, release date, kind, look, cover and
// routes. The game's moderators save them; anyone else signed in sends them as a Draft for votes, checked again by
// ship_game (20261204000000). A route's key never changes and routes the game has can't be removed, since entries
// depend on them; they can be renamed, and new ones added. The wiki has its own editor (WikiCheck).

const box = 'w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-signal';
const COLUMNS: Record<keyof GameSettings, string> = {
  title: 'title', shortTitle: 'short_title', platform: 'platform', releaseDate: 'release_date', genre: 'genre', shade: 'shade', cover: 'cover', paths: 'paths',
};

/** A route as it's being edited: a new one gets its key when it's saved. */
type EditRoute = { key: string; label: string; note: string; isNew?: boolean };

export function GameSettingsEditor({ gameId, mod, me, postDraft, onSubmitted, onClose }: {
  gameId: string; mod: boolean; me: Villager | null | undefined;
  postDraft: (d: NewDraft) => Promise<{ error?: string; id?: string }>;
  onSubmitted: (draftId: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [was, setWas] = useState<GameSettings | null>(null);
  const [s, setS] = useState<GameSettings | null>(null);
  const [routes, setRoutes] = useState<EditRoute[]>([]);
  const [question, setQuestion] = useState('');
  const [hasRoutes, setHasRoutes] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'save' | 'upload' | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // The settings exactly as the database has them: what a Draft says it started from.
  useEffect(() => {
    const db = browserClient();
    if (!db) return;
    db.from('games').select('title, short_title, platform, release_date, genre, shade, cover, paths').eq('id', gameId).maybeSingle().then(({ data }) => {
      if (!data) { setNote("Couldn't load this game's settings."); return; }
      const row = settingsOfRow(data);
      setWas(row);
      setS(row);
      setHasRoutes(Boolean(row.paths));
      setQuestion(row.paths?.question ?? '');
      setRoutes((row.paths?.options ?? []).map((o) => ({ ...o, note: o.note ?? '' })));
    });
  }, [gameId]);

  const paths = (): PathsRow | null => {
    if (!hasRoutes) return null;
    const taken = routes.filter((r) => !r.isNew).map((r) => r.key);
    return {
      question: question.trim(),
      options: routes.map((r) => {
        const key = r.isNew ? routeKey(r.label, taken) : r.key;
        if (r.isNew) taken.push(key);
        return { key, label: r.label.trim(), note: r.note.trim() };
      }),
    };
  };
  const now: GameSettings | null = s && { ...s, title: s.title.trim(), shortTitle: s.shortTitle?.trim() || null, platform: s.platform?.trim() || null,
    genre: s.genre?.trim() || null, paths: paths() };
  const changes = was && now ? changedSettings(was, now) : {};
  const dirty = Object.keys(changes).length > 0;
  const set = (p: Partial<GameSettings>) => { if (s) setS({ ...s, ...p }); setNote(''); };

  const problem = () => {
    if (!now) return 'Still loading.';
    if (now.title.length < 2) return 'The game needs its name.';
    if ('shortTitle' in changes && !now.shortTitle) return 'Say what players call it.';
    if (now.paths) {
      if (!now.paths.question) return 'Routes need their question, like "Which house are you playing?".';
      if (now.paths.options.length < 2 || now.paths.options.some((o) => !o.label)) return 'Routes need two or more, each with a name.';
    }
    return dirty ? null : 'Change something first: these are the settings the game has now.';
  };

  const upload = async (f: File) => {
    if (!me) { setNote('Sign in first.'); return; }
    setBusy('upload');
    const res = await uploadPicture('guide-pictures', gameId, me.id, f, 1600);
    setBusy(null);
    if (typeof res === 'string') { setNote(res); return; }
    set({ cover: res.path });
  };

  const save = async () => {
    const p = problem();
    if (p) { setNote(p); return; }
    const db = browserClient();
    if (!db) return;
    setBusy('save');
    const patch = Object.fromEntries(Object.entries(changes).map(([k, v]) => [COLUMNS[k as keyof GameSettings], v]));
    const { error } = await db.from('games').update(patch).eq('id', gameId);
    if (error) { setBusy(null); setNote(`Couldn't save: ${error.message}`); return; }
    await gamesChanged(gameId);
    router.refresh();
    setBusy(null);
    onClose();
  };

  const submit = async () => {
    const p = problem();
    if (p) { setNote(p); return; }
    setBusy('save');
    const content = settingsContent(was!, now!);
    const res = await postDraft({ blockKey: '@game', kind: 'opinion', title: content.name, content: content as never, source: '', theory: false, action: 'game' });
    setBusy(null);
    if (res.error || !res.id) { setNote(/action_check/.test(res.error ?? '') ? 'Suggesting game settings is almost ready: the database needs one more update.' : res.error ?? "Couldn't send it. Try again in a moment."); return; }
    onSubmitted(res.id);
  };

  const look = lookOf(now?.shade ?? null);
  const preview: Game | null = now && {
    id: gameId, title: now.title || 'Your game', shortTitle: now.shortTitle || now.title || 'Your game', platform: now.platform ?? '', releaseDate: now.releaseDate ?? '',
    status: 'live', hue: look.hue, genre: now.genre ?? '', shade: now.shade ?? undefined, cover: now.cover ?? undefined, popularity: 0,
  };

  return (
    <EditorShell
      label="Game settings"
      title="Game settings"
      titleExtra={
        <Tip text="The game's name, date, kind, look, cover and routes. Moderators save them; anyone else sends them for votes.">
          <button type="button" aria-label="About game settings" className="grid size-7 place-items-center rounded-full text-muted hover:bg-card hover:text-ink"><Info size={17} aria-hidden="true" /></button>
        </Tip>
      }
      actions={!s ? undefined : mod ? (
        <button type="button" onClick={save} disabled={busy !== null} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">{busy === 'save' ? 'Saving…' : 'Save settings'}</button>
      ) : me ? (
        <button type="button" onClick={submit} disabled={busy !== null} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
          {busy === 'save' ? 'Sending…' : <><span className="sm:hidden">Submit</span><span className="hidden sm:inline">Submit for votes</span></>}
        </button>
      ) : undefined}
      note={note ? <p role="status" className="text-berry">{note}</p> : me === null ? <p className="text-muted">Sign in to suggest new settings for votes.</p> : undefined}
      onClose={onClose}
      dirty={dirty}
      onSaveDraft={onClose}
      onDiscard={onClose}
      draftHint="Game settings aren't kept as a draft. Close again to leave without saving."
      tint="slate"
      editor={!s ? <div className="h-64 animate-pulse rounded-2xl bg-card ring-1 ring-line" /> : (
        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-bold">The game&apos;s full name</span>
            <input value={s.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={box} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-bold">What players call it</span>
              <input value={s.shortTitle ?? ''} onChange={(e) => set({ shortTitle: e.target.value })} maxLength={40} className={box} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Played on</span>
              <input value={s.platform ?? ''} onChange={(e) => set({ platform: e.target.value })} maxLength={80} className={box} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Comes out</span>
              <input type="date" value={s.releaseDate ?? ''} onChange={(e) => set({ releaseDate: e.target.value || null })} className={box} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">What kind of game it is</span>
              <input value={s.genre ?? ''} onChange={(e) => set({ genre: e.target.value })} maxLength={40} className={box} />
            </label>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-bold">Closest look <span className="font-normal text-muted">(it shades the app&apos;s colors)</span></legend>
            <div className="flex flex-wrap gap-1.5">
              {LOOKS.map((l) => (
                <button key={l.shade} type="button" onClick={() => set({ shade: l.shade })} aria-pressed={look.shade === l.shade} title={l.hint}
                  className={'rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (look.shade === l.shade ? 'bg-signal ring-signal' : 'bg-card ring-line hover:ring-ink')}>{l.label}</button>
              ))}
            </div>
          </fieldset>

          <section className="grid gap-2 rounded-2xl bg-card p-3 ring-1 ring-line">
            <h3 className="font-bold">Cover picture</h3>
            <p className="text-sm text-muted">Wide, like a banner (16:9). The game&apos;s own key art is fine; say where it&apos;s from in the chat.</p>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => file.current?.click()} disabled={busy !== null || !me}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink disabled:opacity-60">
                <ImagePlus size={15} aria-hidden="true" /> {busy === 'upload' ? 'Uploading…' : s.cover ? 'Replace the cover' : 'Upload a cover'}
              </button>
              {s.cover && <button type="button" onClick={() => set({ cover: null })} className="rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:text-berry">No cover</button>}
            </div>
          </section>

          <section className="grid gap-2 rounded-2xl bg-card p-3 ring-1 ring-line">
            <h3 className="flex items-center gap-1.5 font-bold"><Signpost size={15} aria-hidden="true" /> Routes</h3>
            {!hasRoutes ? (
              <>
                <p className="text-sm text-muted">For a game where players pick a path that changes what happens (a house, a lord, a faction). Players choose theirs, and the app shows what fits it.</p>
                <button type="button" onClick={() => { setHasRoutes(true); setRoutes([{ key: '', label: '', note: '', isNew: true }, { key: '', label: '', note: '', isNew: true }]); }}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink">
                  <Plus size={15} aria-hidden="true" /> This game has routes
                </button>
              </>
            ) : (
              <>
                <label className="grid gap-1">
                  <span className="text-sm font-bold">The question players answer</span>
                  <input value={question} onChange={(e) => { setQuestion(e.target.value); setNote(''); }} maxLength={120} placeholder="Which house are you playing?" className={box} />
                </label>
                <ul className="grid gap-2">
                  {routes.map((r, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2">
                      <input value={r.label} onChange={(e) => setRoutes(routes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={40}
                        placeholder="Name" aria-label="Route name" className={box + ' w-auto min-w-0 flex-1'} />
                      <input value={r.note} onChange={(e) => setRoutes(routes.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} maxLength={80}
                        placeholder="A short note (optional)" aria-label="Route note" className={box + ' w-auto min-w-0 flex-[2]'} />
                      {r.isNew ? (
                        <button type="button" onClick={() => setRoutes(routes.filter((_, j) => j !== i))} aria-label={`Remove ${r.label || 'this route'}`}
                          className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-berry"><Trash2 size={15} aria-hidden="true" /></button>
                      ) : <span className="size-8" title="Entries depend on this route, so it stays. Rename it instead." />}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  {routes.length < 8 && (
                    <button type="button" onClick={() => setRoutes([...routes, { key: '', label: '', note: '', isNew: true }])}
                      className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink">
                      <Plus size={15} aria-hidden="true" /> Add a route
                    </button>
                  )}
                  {!was?.paths && (
                    <button type="button" onClick={() => { setHasRoutes(false); setRoutes([]); setQuestion(''); }} className="rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:text-ink">No routes after all</button>
                  )}
                </div>
                {was?.paths && <p className="text-xs text-muted">Routes the game has stay: entries depend on them. Rename one instead, or add more.</p>}
              </>
            )}
          </section>
        </div>
      )}
      preview={preview && (
        <div className="grid gap-3">
          <div className="surface overflow-hidden rounded-2xl">
            <GameCover game={preview} />
            <div className="p-3">
              <p className="font-display text-lg leading-tight">{preview.shortTitle}</p>
              <p className="text-sm text-muted">{[preview.genre, preview.platform].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          {now?.paths && (
            <div className="rounded-2xl bg-ink p-4 text-white">
              <p className="text-sm font-bold text-white/85">{now.paths.question || 'The route question'}</p>
              <div className="mt-2 flex flex-wrap gap-1 rounded-full bg-card p-1 text-sm font-bold text-ink">
                {['All', ...now.paths.options.map((o) => o.label || 'Route')].map((l, i) => (
                  <span key={i} className={'rounded-full px-3 py-1.5 ' + (i === 0 ? 'bg-signal' : '')}>{l}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    />
  );
}
