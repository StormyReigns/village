'use client';

import { useState } from 'react';
import type { Block, Entry, Page } from '@/data/pages';
import type { BlockContext } from '@/components/app/blockParts';
import { PictureMap } from '@/components/world/PictureMap';

const place = (id: string, name: string, region: string, lv: number, spot?: { x: number; y: number }, spoiler?: boolean): Entry => {
  const group = /Hollow|Camp/.test(name) ? 'Town' : /Cave/.test(name) ? 'Cave' : /Fort/.test(name) ? 'Fort' : /Mine/.test(name) ? 'Mine'
    : /Shrine|Tomb/.test(name) ? 'Shrine' : /Lighthouse/.test(name) ? 'Island' : '';
  return { id, name, sections: [], categories: { Region: region, ...(group ? { Group: group } : {}) }, stat: `Lv ${lv}`, spot, spoiler };
};

const PLACES: Entry[] = [
  place('reed-hollow', 'Reed Hollow', 'Greenmere', 3, { x: 22, y: 33 }),
  place('mossy-cave', 'Mossy Cave', 'Greenmere', 5, { x: 30, y: 41 }),
  place('mill-fort', 'Mill Fort', 'Greenmere', 6, { x: 31, y: 42.5 }),
  place('cinder-pass', 'Cinder Pass', 'Ashpeaks', 14, { x: 64, y: 25 }),
  place('ember-mine', 'Ember Mine', 'Ashpeaks', 18, { x: 72, y: 33 }),
  place('old-wood-shrine', 'Old Wood Shrine', 'Old Wood', 10, { x: 46, y: 58 }),
  place('sand-tomb', 'Sand Tomb', 'Dunelands', 22, { x: 80, y: 63 }),
  place('gull-lighthouse', 'Gull Lighthouse', 'Gull Isle', 25, { x: 92.5, y: 80 }),
  place('flat-camp', 'Flat Camp', 'The Flats', 8, { x: 30, y: 72 }),
  place('hidden-vault', 'Hidden Vault', 'Ashpeaks', 30, { x: 70, y: 20 }, true),
  place('far-ruins', 'Far Ruins', 'Dunelands', 28),
];

const PAGE: Page = { id: 'world', title: 'World', short: 'World', icon: 'MapPin', tint: 'teal', blurb: '', blocks: [] };
const BLOCK: Block = { id: 'places', type: 'collection', look: 'map', title: 'Places', icon: 'MapPin', filters: ['Region', 'Group'], statName: 'Level', entries: PLACES,
  map: { picture: 'lab/sample.svg', w: 1600, h: 1100, credit: 'Map: a made-up world, drawn for this sample' } };

export function MapSample() {
  const [spoilers, setSpoilers] = useState(false);
  const [opened, setOpened] = useState('');
  const ctx: BlockContext = { gameId: 'lab', page: PAGE, pageTitle: 'World', tint: 'teal', route: 'all', routes: [], spoilers, onShowSpoilers: () => setSpoilers(true) };
  const shown = spoilers ? PLACES : PLACES.filter((e) => !e.spoiler);
  return (
    <div className="mt-4 rounded-3xl p-3" style={{ background: 'var(--teal-soft)' }}>
      <section className="rounded-2xl bg-card p-3 ring-1 ring-line">
        <h2 className="font-bold">Places</h2>
        <PictureMap block={BLOCK} ctx={ctx} map={BLOCK.map!} places={shown} onOpenPlace={(e) => setOpened(e.name)} src="/lab/sample-map.svg" />
        <p className="mt-2 text-sm">
          {opened ? <>Opened: <b>{opened}</b>. </> : null}
          <button type="button" onClick={() => setSpoilers(!spoilers)} className="font-bold underline">{spoilers ? 'Hide spoilers' : 'Show spoilers'}</button>
        </p>
      </section>
      <div className="h-[60vh]" aria-hidden="true" />
    </div>
  );
}
