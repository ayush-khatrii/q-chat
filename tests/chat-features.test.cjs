const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { parseInviteCode, inviteDestination } = require('../lib/invites.ts');
const { mergeMessagePage } = require('../lib/chat-messages.ts');
const { DefaultMessage, emptyMessageReactions } = require('../node_modules/@ably/chat/src/core/message.ts');
const { ChatMessageAction, MessageReactionSummaryEventType } = require('@ably/chat');

function message(version = '001', action = ChatMessageAction.MessageCreate, text = 'original') {
  return new DefaultMessage({ serial: '001', clientId: 'alice', text,
    metadata: { attachmentIds: ['file'] }, headers: { example: 'kept' },
    timestamp: new Date('2026-01-01'), action,
    version: { serial: version, timestamp: new Date('2026-01-02') }, reactions: emptyMessageReactions() });
}

test('invite parsing accepts codes and same-origin invite URLs, rejects foreign and malformed destinations', () => {
  const origin = 'https://qchat.example';
  for (const input of ['team', 'qc-team', ' QC-TEAM ', `${origin}/join/QC-TEAM`, `${origin}/chat/QC-TEAM`, '/join/QC-TEAM'])
    assert.equal(parseInviteCode(input, origin), 'QC-TEAM');
  for (const input of ['https://evil.example/join/QC-TEAM', '//evil.example/join/QC-TEAM', '/join/QC-TEAM?next=https://evil.example', '/join/QC-TEAM#secret', '/join/QC-%2FTEAM', '/profile', '', 'x'.repeat(30)])
    assert.equal(parseInviteCode(input, origin), null);
  assert.equal(inviteDestination('qc-team'), '/join/QC-TEAM');
  assert.equal(inviteDestination('https://evil.example'), '/chat');
});

test('edits preserve attachments, receipts identity and reactions across duplicate/stale history', () => {
  const summary = { type: MessageReactionSummaryEventType.Summary, messageSerial: '001', reactions: {
    ...emptyMessageReactions(), distinct: { '👍': { total: 2, clientIds: ['alice','bob'], clipped: false }, '❤️': { total: 1, clientIds: ['bob'], clipped: false } }
  }};
  const live = new Map([['001', summary]]);
  const edited = mergeMessagePage([message().with(summary)], [message('002', ChatMessageAction.MessageUpdate, 'edited')], live);
  const merged = mergeMessagePage(edited, [message(), message()], live);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, 'edited');
  assert.equal(merged[0].serial, '001');
  assert.deepEqual(merged[0].metadata.attachmentIds, ['file']);
  assert.equal(merged[0].reactions.distinct['👍'].total, 2);
  assert.equal(merged[0].reactions.distinct['❤️'].total, 1);
  const deleted = mergeMessagePage(merged, [message('003', ChatMessageAction.MessageDelete, '')], live);
  assert.equal(mergeMessagePage(deleted, edited, live)[0].action, ChatMessageAction.MessageDelete);
});

test('a reaction received before its history message is applied and removal survives history loading', () => {
  const removed = { type: MessageReactionSummaryEventType.Summary, messageSerial: '001', reactions: emptyMessageReactions() };
  const stale = message().with({ ...removed, reactions: { ...emptyMessageReactions(), distinct: { '👍': { total: 1, clientIds: ['alice'], clipped: false } } } });
  const merged = mergeMessagePage([], [stale], new Map([['001', removed]]));
  assert.deepEqual(merged[0].reactions.distinct, {});
});

test('worker caches only offline fallback and does not intercept API or attachment fetches', async () => {
  const handlers = {};
  const cached = [];
  const scope = {
    self: { location: { origin: 'https://qchat.example' }, addEventListener: (type, fn) => (handlers[type] ??= []).push(fn), skipWaiting() {} },
    caches: { open: async () => ({ add: async path => cached.push(path) }), match: async () => 'offline', keys: async () => [] },
    importScripts: () => { throw new Error('offline firebase'); },
    clients: { claim: async () => {} }, fetch: async () => { throw new Error('offline'); },
    URL, Response, console: { log() {}, error() {} },
  };
  vm.runInNewContext(readFileSync('public/firebase-messaging-sw.js', 'utf8'), scope);
  const tasks = [];
  for (const fn of handlers.install) fn({ waitUntil: task => tasks.push(task) });
  await Promise.all(tasks);
  assert.deepEqual(cached, ['/offline.html']);
  let response;
  const listener = handlers.fetch[0];
  listener({ request: { mode: 'cors', url: 'https://qchat.example/api/rooms' }, respondWith: () => assert.fail('API intercepted') });
  listener({ request: { mode: 'navigate', url: 'https://qchat.example/chat/QC-TEAM' }, respondWith: task => response = task });
  assert.equal(await response, 'offline');
});
