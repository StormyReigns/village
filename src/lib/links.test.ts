// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLinks, linksIn, villagePath, youTube } from './links.ts';

test('addresses in a message become links, without the full stop after them', () => {
  assert.deepEqual(findLinks('see https://game8.co/games/fw/123. Thanks'), [
    { text: 'see ' }, { url: 'https://game8.co/games/fw/123' }, { text: '. Thanks' },
  ]);
  assert.deepEqual(linksIn('(https://a.com/x) and http://b.org'), ['https://a.com/x', 'http://b.org']);
  assert.deepEqual(findLinks('no links here'), [{ text: 'no links here' }]);
});

test('YouTube videos are recognised, with their start time', () => {
  assert.deepEqual(youTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m35s'), { id: 'dQw4w9WgXcQ', start: 95 });
  assert.deepEqual(youTube('https://youtu.be/dQw4w9WgXcQ?t=42'), { id: 'dQw4w9WgXcQ', start: 42 });
  assert.deepEqual(youTube('https://youtube.com/shorts/abcDEF12345'), { id: 'abcDEF12345' });
  assert.equal(youTube('https://vimeo.com/123'), null);
});

test('only links to Village itself count as entry links', () => {
  const hosts = ['village-tawny-beta.vercel.app'];
  assert.deepEqual(villagePath('https://village-tawny-beta.vercel.app/g/fortunes-weave/units-and-classes/eshmel', hosts),
    { game: 'fortunes-weave', page: 'units-and-classes', item: 'eshmel' });
  assert.equal(villagePath('https://elsewhere.com/g/fortunes-weave/units-and-classes/eshmel', hosts), null);
  assert.equal(villagePath('https://village-tawny-beta.vercel.app/g/fortunes-weave/workshop', hosts), null);
});
