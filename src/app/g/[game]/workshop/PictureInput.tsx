'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { initials } from '@/components/app/entries';
import { pictureUrl } from '@/components/app/Guides';

/**
 * An entry's picture: it fills the entry's piece everywhere in the app, in place of its
 * symbol or initials. Uploads go to the same public bucket as guide pictures (game/you/file),
 * redrawn small, and the entry keeps the picture's web address as its `icon`.
 */
export function PictureInput({ value, name, symbol, color, upload, onChange, className = '' }: {
  value?: string; name: string; color: string; className?: string;
  /** The group symbol the piece shows without a picture, as in the app. */
  symbol?: string;
  /** Missing until you're signed in. */
  upload?: (file: File) => Promise<{ path: string } | string>;
  onChange: (icon: string | undefined) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const pick = async (f?: File) => {
    if (!f || !upload) return;
    setBusy(true); setNote('');
    const res = await upload(f);
    setBusy(false);
    if (typeof res === 'string') setNote(res);
    else onChange(pictureUrl(res.path));
  };

  return (
    <div role="group" aria-labelledby="picture-label" className={'flex items-center gap-3 ' + className}>
      <Piece size={64} color={color} image={value} outline={busy} ink={color}>{value ? null : symbol ? <BlockIcon name={symbol} size={13} strokeWidth={2.4} /> : initials(name) || null}</Piece>
      <div className="grid min-w-0 flex-1 gap-1">
        <span id="picture-label" className="text-sm font-bold">Picture <span className="font-normal text-muted">(optional)</span></span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => file.current?.click()} disabled={!upload || busy}
            className="btn-quiet inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold disabled:opacity-50">
            <ImagePlus size={15} aria-hidden="true" /> {busy ? 'Uploading…' : value ? 'Replace' : 'Upload a picture'}
          </button>
          {value && !busy && (
            <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-bold text-muted hover:text-berry">
              <Trash2 size={14} aria-hidden="true" /> Remove
            </button>
          )}
        </div>
        <span className={'text-xs ' + (note ? 'text-berry' : 'text-muted')} role={note ? 'alert' : undefined}>
          {note || (upload ? 'A portrait or icon, cut to the piece. Game art is fine: say where it came from in Source.' : 'You can add a picture once you’re signed in.')}
        </span>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
