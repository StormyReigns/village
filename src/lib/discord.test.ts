// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWebhook, friendlyError, toHookStatus } from './discord.ts';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-wxyz';

test('a Discord webhook link is tidied to discord.com', () => {
  for (const host of ['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com']) {
    const r = checkWebhook(`  https://${host}/api/v10/webhooks/123456789012345678/${TOKEN}/  `);
    assert.deepEqual(r, { ok: true, url: `https://discord.com/api/webhooks/123456789012345678/${TOKEN}` });
  }
});

test('anything else is turned away with a reason', () => {
  const bad = [
    '',
    'not a link',
    `http://discord.com/api/webhooks/123456789012345678/${TOKEN}`,
    `https://evil.com/api/webhooks/123456789012345678/${TOKEN}`,
    `https://discord.com.evil.com/api/webhooks/123456789012345678/${TOKEN}`,
    'https://discord.gg/abc123',
    'https://discord.com/invite/abc123',
    'https://discord.com/api/webhooks/123/short',
    `https://discord.com/api/webhooks/123456789012345678/${TOKEN}/extra`,
  ];
  for (const b of bad) {
    const r = checkWebhook(b);
    assert.equal(r.ok, false, b);
    if (!r.ok) assert.ok(r.reason.length > 10);
  }
  const invite = checkWebhook('https://discord.com/invite/abc123');
  assert.ok(!invite.ok && /invite/.test(invite.reason));
});

test('status rows and errors read plainly', () => {
  assert.equal(toHookStatus(null), null);
  assert.equal(toHookStatus({}), null);
  assert.deepEqual(toHookStatus({ last4: 'wxyz', kinds: ['published'], status: 'broken', last_error: 'gone', last_sent_at: null, updated_at: 'x' }),
    { last4: 'wxyz', kinds: ['published'], status: 'broken', lastError: 'gone', lastSentAt: null, updatedAt: 'x' });
  assert.equal(friendlyError({ code: 'P0001', message: 'Connect a Discord channel first.' }), 'Connect a Discord channel first.');
  assert.match(friendlyError({ code: 'XX000', message: 'boom' }), /went wrong/);
});
