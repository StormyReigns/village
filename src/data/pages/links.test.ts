// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Block, Entry, Page } from './types.ts';
import { findItem, movedPagePath } from './links.ts';

const entry = (id: string): Entry => ({ id, name: id, sections: [], categories: {} });
const block = (id: string, entries: string[]): Block => ({ id, type: 'collection', title: id, icon: 'Shield', entries: entries.map(entry) } as Block);
const page = (id: string, blocks: Block[]): Page => ({ id, title: id, short: id, icon: 'Users', tint: 'berry', blurb: '', blocks });

// Classes left "Units and classes" for a Page of its own (2026-11-11).
const PAGES = [page('units', [block('units', ['cai', 'maria'])]), page('classes', [block('classes', ['ranger', 'knight'])])];
const MOVED = { 'units-and-classes': 'units' };

test('an old Page address goes to the Page it became, keeping the rest of the link', () => {
  assert.equal(movedPagePath('fw', PAGES, MOVED, 'units-and-classes', {}), '/g/fw/units');
  assert.equal(movedPagePath('fw', PAGES, MOVED, 'units-and-classes', { route: 'cai' }), '/g/fw/units?route=cai');
});

test('an old link that opens an entry goes to the Page holding that entry now', () => {
  assert.equal(movedPagePath('fw', PAGES, MOVED, 'units-and-classes', { e: 'classes.ranger' }), '/g/fw/classes?e=classes.ranger');
  assert.equal(movedPagePath('fw', PAGES, MOVED, 'units-and-classes', { e: 'units.cai' }), '/g/fw/units?e=units.cai');
});

test('an address that never existed leads nowhere', () => {
  assert.equal(movedPagePath('fw', PAGES, MOVED, 'nonsense', {}), null);
  assert.equal(movedPagePath('fw', PAGES, undefined, 'units-and-classes', {}), null);
});

test('a shared entry is found on whichever Page it is on now', () => {
  assert.equal(findItem(PAGES, 'ranger')?.page.id, 'classes');
  assert.equal(findItem(PAGES, 'classes.knight')?.entry?.id, 'knight');
  assert.equal(findItem(PAGES, 'units')?.block.id, 'units');
  assert.equal(findItem(PAGES, 'nobody'), null);
});
