'use client';

import { MapPin } from 'lucide-react';
import type { BlockMap } from '@/data/pages';
import { cleanSpot } from '@/lib/world-map';
import { MapCanvas } from './MapCanvas';
import { mapPictureUrl } from './PictureMap';

/** "Where on the map", in a place's form (docs/blocks/world.md): tap the map to put its pin
 *  there. The pin goes in with the rest of the Draft. */
export function MapSpotInput({ map, value, name, mark, tint, onChange }: {
  map: BlockMap; value?: { x: number; y: number }; name: string; mark?: React.ReactNode; tint: string;
  onChange: (spot: { x: number; y: number } | undefined) => void;
}) {
  const spot = cleanSpot(value);
  return (
    <div role="group" aria-labelledby="map-spot-label" className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span id="map-spot-label" className="flex items-center gap-1 text-sm font-bold"><MapPin size={14} aria-hidden="true" /> Where on the map <span className="font-normal text-muted">(tap where it is)</span></span>
        {spot && <button type="button" onClick={() => onChange(undefined)} className="text-xs font-bold text-muted underline underline-offset-2 hover:text-ink">Take it off the map</button>}
      </div>
      <MapCanvas src={mapPictureUrl(map.picture)} pic={map} alt="Map: tap to place the pin" tint={tint} frameClass="h-64"
        pins={spot ? [{ id: 'here', ...spot, name: name || 'This place', mark, done: true, ring: true }] : []}
        onSpot={(s) => onChange(s)} focus={spot ? { ...spot, key: 'here' } : null} credit={map.credit} />
    </div>
  );
}
