'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Putting a list in order by dragging a handle, with a mouse or a finger, or with the arrow keys on
 * the handle. The list reorders as you drag, so you see where it will land. On letting go, onDrop gets
 * the new order; the list keeps showing it until `items` changes (the saved order arriving), so it
 * doesn't jump back while saving.
 *
 *   const sort = useDragSort(blocks.map((b) => b.id), (ids) => save(ids));
 *   sort.ids.map((id) => <section ref={sort.itemRef(id)}> <button {...sort.handle(id)} /> … )
 */
export function useDragSort(items: string[], onDrop: (ids: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const start = useRef<string[] | null>(null);
  const itemsKey = items.join('|');
  // The saved order arriving (or another change) replaces the one shown while dragging and saving.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- following the list once it changes
    setOrder(null);
  }, [itemsKey]);
  const ids = order && order.length === items.length && order.every((id) => items.includes(id)) ? order : items;

  const finish = (next: string[]) => {
    const before = start.current ?? items;
    start.current = null;
    setDragging(null);
    if (next.join('|') !== before.join('|')) onDrop(next);
    else setOrder(null);
  };

  const handle = (id: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = ids;
      setOrder(ids);
      setDragging(id);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (dragging !== id || !order) return;
      // Where the pointer is among the other items' middles is where this one goes.
      const others = order.filter((x) => x !== id);
      const at = others.filter((x) => {
        const r = els.current.get(x)?.getBoundingClientRect();
        return r ? e.clientY > r.top + r.height / 2 : false;
      }).length;
      const next = [...others.slice(0, at), id, ...others.slice(at)];
      if (next.join('|') !== order.join('|')) setOrder(next);
    },
    onPointerUp: () => { if (dragging === id) finish(order ?? ids); },
    onPointerCancel: () => { if (dragging === id) { start.current = null; setDragging(null); setOrder(null); } },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const i = ids.indexOf(id), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (j < 0 || j >= ids.length) return;
      const next = [...ids];
      [next[i], next[j]] = [next[j], next[i]];
      start.current = ids;
      setOrder(next);
      finish(next);
    },
    style: { touchAction: 'none' as const, cursor: dragging === id ? 'grabbing' : 'grab' },
  });

  const itemRef = (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };

  return { ids, dragging, handle, itemRef };
}
