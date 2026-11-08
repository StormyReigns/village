// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelLink, embedUrl, formatTime, parseTime, parseVideoLink, rankVideos, tallyText, toVideoInfo, watchUrl } from './videos.ts';

const ID = 'dQw4w9WgXcQ';

test('reads every kind of YouTube link', () => {
  assert.deepEqual(parseVideoLink(`https://www.youtube.com/watch?v=${ID}`), { id: ID, start: 0 });
  assert.deepEqual(parseVideoLink(`youtube.com/watch?v=${ID}&t=272s`), { id: ID, start: 272 });
  assert.deepEqual(parseVideoLink(`https://youtu.be/${ID}?t=90`), { id: ID, start: 90 });
  assert.deepEqual(parseVideoLink(`https://youtube.com/shorts/${ID}`), { id: ID, start: 0 });
  assert.deepEqual(parseVideoLink(`https://m.youtube.com/watch?v=${ID}&t=1m5s`), { id: ID, start: 65 });
  assert.deepEqual(parseVideoLink(`https://www.youtube-nocookie.com/embed/${ID}?start=30`), { id: ID, start: 30 });
  assert.deepEqual(parseVideoLink(`https://www.youtube.com/live/${ID}`), { id: ID, start: 0 });
  assert.deepEqual(parseVideoLink(`  https://www.youtube.com/watch?v=${ID}#t=4:32 `), { id: ID, start: 272 });
});

test('turns away links that are not one YouTube video', () => {
  assert.equal(parseVideoLink(''), null);
  assert.equal(parseVideoLink('https://vimeo.com/123'), null);
  assert.equal(parseVideoLink('https://www.youtube.com/@somechannel'), null);
  assert.equal(parseVideoLink('https://www.youtube.com/watch?v=short'), null);
  assert.equal(parseVideoLink(`https://evil.example/watch?v=${ID}`), null);
  assert.equal(parseVideoLink(`https://youtube.com.evil.example/watch?v=${ID}`), null);
  assert.equal(parseVideoLink('not a link at all'), null);
});

test('reads start times in the ways people write them', () => {
  assert.equal(parseTime('272'), 272);
  assert.equal(parseTime('4:32'), 272);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime('1h2m3s'), 3723);
  assert.equal(parseTime('4:75'), null);
  assert.equal(parseTime('soon'), null);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime('999999'), null);
});

test('writes times the way YouTube does', () => {
  assert.equal(formatTime(272), '4:32');
  assert.equal(formatTime(5), '0:05');
  assert.equal(formatTime(3723), '1:02:03');
});

test('plays in the privacy-enhanced player, at the moment', () => {
  assert.equal(embedUrl(ID, 272), `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&playsinline=1&start=272`);
  assert.equal(embedUrl(ID), `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&playsinline=1`);
  assert.equal(watchUrl(ID, 90), `https://www.youtube.com/watch?v=${ID}&t=90s`);
});

test('credit comes from YouTube, and only YouTube links are used for the channel', () => {
  assert.deepEqual(toVideoInfo(200, { title: ' Chapter 9 ', author_name: 'Some Creator', author_url: 'https://www.youtube.com/@somecreator' }),
    { ok: true, title: 'Chapter 9', channel: 'Some Creator', channelUrl: 'https://www.youtube.com/@somecreator' });
  assert.deepEqual(toVideoInfo(401, null), { ok: false, reason: 'blocked' });
  assert.deepEqual(toVideoInfo(404, null), { ok: false, reason: 'gone' });
  assert.deepEqual(toVideoInfo(200, { title: 'x' }), { ok: false, reason: 'gone' });
  assert.equal(channelLink('https://evil.example/@x'), null);
  assert.equal(channelLink('javascript:alert(1)'), null);
});

test('the video most voters found helpful comes first; a new one still gets seen', () => {
  const v = (id: string, helped: number, notHelped: number, day: number) => ({ id, helped, notHelped, createdAt: `2026-11-0${day}T00:00:00Z` });
  const ranked = rankVideos([v('mixed', 30, 25, 1), v('loved', 20, 1, 2), v('new', 0, 0, 8)]);
  assert.deepEqual(ranked.map((x) => x.id), ['loved', 'mixed', 'new']);
});

test('totals stay hidden until 5 votes', () => {
  assert.equal(tallyText({ helped: 3, notHelped: 1 }), 'New');
  assert.equal(tallyText({ helped: 23, notHelped: 2 }), 'Helped 23 players');
  assert.equal(tallyText({ helped: 0, notHelped: 6 }), 'Hasn’t helped yet');
});

test('whoever added a video can delete it for its first hour', async () => {
  const { deleteMinutesLeft } = await import('./videos.ts');
  const added = '2026-11-08T12:00:00Z', t = Date.parse(added);
  assert.equal(deleteMinutesLeft(added, t), 60);
  assert.equal(deleteMinutesLeft(added, t + 59.5 * 60000), 1);
  assert.equal(deleteMinutesLeft(added, t + 60 * 60000), 0);
  assert.equal(deleteMinutesLeft(added, t + 3 * 3600000), 0);
});
