// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countsText, iconUrl, initials, rankCommunities, readPaste, shortAddress, toInviteInfo, voteText } from './communities.ts';

test('every shape of Discord invite reads as its code', () => {
  for (const s of ['https://discord.gg/AbC-123', 'discord.gg/AbC-123', 'https://discord.com/invite/AbC-123', 'https://discordapp.com/invite/AbC-123/', ' http://discord.gg/AbC-123?x=1 ']) {
    assert.deepEqual(readPaste(s), { kind: 'discord', invite: 'AbC-123' }, s);
  }
  assert.equal(readPaste('https://discord.com/channels/1/2').kind, 'bad');
  assert.equal(readPaste('https://discord.com/api/webhooks/1/abc').kind, 'bad');
});

test('plain links: https, a real address, no shorteners', () => {
  assert.deepEqual(readPaste('https://www.reddit.com/r/FortunesWeave/'), { kind: 'link', url: 'https://www.reddit.com/r/FortunesWeave', host: 'www.reddit.com' });
  for (const s of ['', 'hello there', 'http://reddit.com/r/x', 'reddit.com/r/x', 'https://bit.ly/abc', 'https://localhost/x', 'https://user:pw@reddit.com/']) {
    assert.equal(readPaste(s).kind, 'bad', s);
  }
  assert.equal(shortAddress('https://www.reddit.com/r/FortunesWeave/'), 'reddit.com/r/FortunesWeave');
});

test("Discord's answer: only servers with invites that never run out, nothing age-restricted", () => {
  const guild = { id: '123', name: 'Weave Fans', icon: 'a_0123456789abcdef0123456789abcdef', features: ['VERIFIED', 'COMMUNITY'], nsfw_level: 0 };
  assert.deepEqual(toInviteInfo(200, { guild, expires_at: null, approximate_member_count: 1204, approximate_presence_count: 230 }),
    { ok: true, guildId: '123', name: 'Weave Fans', icon: 'a_0123456789abcdef0123456789abcdef', members: 1204, online: 230, verified: true });
  assert.deepEqual(toInviteInfo(404, { message: 'Unknown Invite' }), { ok: false, reason: 'gone' });
  assert.deepEqual(toInviteInfo(200, { guild, expires_at: '2026-11-10T00:00:00Z' }), { ok: false, reason: 'expires' });
  assert.deepEqual(toInviteInfo(200, { guild: { ...guild, nsfw_level: 3 } }), { ok: false, reason: 'adult' });
  assert.deepEqual(toInviteInfo(200, { channel: { id: '1' } }), { ok: false, reason: 'not_server' });
  const odd = toInviteInfo(200, { guild: { id: '9', name: 'X', icon: '../../evil' } });
  assert.ok(odd.ok && odd.icon === null && odd.members === null && !odd.verified);
});

test('icons, counts and initials', () => {
  assert.equal(iconUrl({ guildId: '1', icon: null }), null);
  assert.equal(iconUrl({ guildId: '1', icon: 'abc' }, 64), 'https://cdn.discordapp.com/icons/1/abc.webp?size=64');
  assert.equal(countsText(1204, 230), '1,204 members · 230 online');
  assert.equal(countsText(1, null), '1 member');
  assert.equal(initials("Fortune's Weave Fans"), 'FW');
  assert.equal(initials('weave'), 'WE');
});

test('best first, totals hidden under 5 votes', () => {
  const list = [
    { id: 'old-empty', ups: 0, downs: 0, createdAt: '2026-11-01' },
    { id: 'loved', ups: 20, downs: 1, createdAt: '2026-10-01' },
    { id: 'new-empty', ups: 0, downs: 0, createdAt: '2026-11-08' },
    { id: 'disliked', ups: 1, downs: 9, createdAt: '2026-11-09' },
  ];
  assert.deepEqual(rankCommunities(list).map((c) => c.id), ['loved', 'disliked', 'new-empty', 'old-empty']);
  assert.equal(voteText(3, 1), null);
  assert.equal(voteText(12, 2), 'Recommended by 12');
  assert.equal(voteText(2, 4), 'Mixed reviews');
});
