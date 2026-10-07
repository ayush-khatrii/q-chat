const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const {
  mergeReadReceipts,
  readReceiptEventSchema,
  readReceiptChannel,
} = require('../lib/read-receipts.ts');

const readAt = '2026-10-07T06:00:00.000Z';

test('a delayed database snapshot preserves receipts received over Ably', () => {
  const live = { liveMessage: readAt };
  const merged = mergeReadReceipts(live, [{ messageSerial: 'olderMessage', readAt }]);
  assert.deepEqual(merged, { liveMessage: readAt, olderMessage: readAt });
  assert.deepEqual(live, { liveMessage: readAt });
});

test('duplicate and out-of-order receipts preserve the earliest read time', () => {
  const receipts = [
    { messageSerial: 'message', readAt: '2026-10-07T07:00:00.000Z' },
    { messageSerial: 'message', readAt },
    { messageSerial: 'message', readAt: '2026-10-07T08:00:00.000Z' },
  ];
  assert.deepEqual(mergeReadReceipts({}, receipts), { message: readAt });
});

test('malformed live events are rejected before updating ticks', () => {
  assert.equal(readReceiptEventSchema.safeParse({ messageSerial: 'message', readAt }).success, false);
  assert.equal(readReceiptEventSchema.safeParse({ messageSerial: 'message', readAt: 'invalid', readerId: 'reader' }).success, false);
  assert.equal(readReceiptEventSchema.safeParse({ messageSerial: 'message', readAt, readerId: 'reader' }).success, true);
  assert.equal(readReceiptChannel('room'), 'qchat-reads:room');
});

test('receipt endpoint only persists and permissions allow room-scoped realtime publishing', async () => {
  let authenticated = true;
  let member = true;
  const calls = [];
  const originalLoad = Module._load;
  const oldKey = process.env.ABLY_API_KEY;
  process.env.ABLY_API_KEY = 'test-only';
  Module._load = function (id, ...args) {
    if (id === 'next/headers') return { headers: async () => new Headers() };
    if (id === '@/lib/auth') return { auth: { api: { getSession: async () => authenticated ? { user: { id: 'reader' } } : null } } };
    if (id === '@/lib/prisma') return { __esModule: true, default: {
      roomMember: {
        findUnique: async () => member ? { id: 'membership' } : null,
        findMany: async () => [{ roomId: 'room' }],
      },
      messageRead: { upsert: async (args) => {
        assert.equal(args.create.readAt.toISOString(), readAt);
        calls.push('save');
        return { messageSerial: 'message', readAt: new Date(readAt) };
      } },
    } };
    if (id === 'ably') return { Rest: class {
      auth = { createTokenRequest: async (request) => request };
      channels = { get: (channel) => ({ publish: async (name, data) => {
        calls.push('publish');
        assert.equal(channel, 'qchat-reads:room');
        assert.equal(name, 'message-read');
        assert.deepEqual(data, { messageSerial: 'message', readerId: 'reader', readAt });
        throw new Error('Persistence endpoint must not publish');
      } }) };
    } };
    return originalLoad.call(this, id, ...args);
  };
  try {
    const { POST } = require('../app/api/rooms/[roomId]/reads/route.ts');
    const post = () => POST(new Request('http://localhost/api/rooms/room/reads', {
      method: 'POST', body: JSON.stringify({ messageSerial: 'message', readAt }),
    }), { params: Promise.resolve({ roomId: 'room' }) });

    authenticated = false;
    assert.equal((await post()).status, 401);
    authenticated = true;
    member = false;
    assert.equal((await post()).status, 404);
    assert.deepEqual(calls, []);
    member = true;
    assert.equal((await post()).status, 200);
    assert.deepEqual(calls, ['save']);

    const { GET } = require('../app/api/ably/auth/route.ts');
    const token = await (await GET()).json();
    const capabilities = JSON.parse(token.capability);
    assert.equal(token.clientId, 'reader');
    assert.deepEqual(capabilities['qchat-reads:room'], ['subscribe', 'publish']);
    assert.equal(capabilities['qchat-reads:*'], undefined);
    assert.equal(capabilities['qchat-reads:another-room'], undefined);
  } finally {
    Module._load = originalLoad;
    if (oldKey === undefined) delete process.env.ABLY_API_KEY;
    else process.env.ABLY_API_KEY = oldKey;
  }
});

const { createReadReceiptOutbox } = require('../lib/read-receipt-outbox.ts');
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test('publishes before DB save, retries save independently, and deduplicates observations', async () => {
  const calls = [];
  let finishPublish;
  let failSave = true;
  const receipt = { messageSerial: 'message', readAt };
  const outbox = createReadReceiptOutbox({
    publish: async () => {
      calls.push('publish');
      await new Promise((resolve) => { finishPublish = resolve; });
    },
    save: async (value) => {
      assert.deepEqual(value, receipt);
      calls.push('save');
      if (failSave) throw new Error('DB unavailable');
    },
    remember: () => calls.push('remember'),
    forget: () => calls.push('forget'),
  });
  try {
    outbox.enqueue(receipt);
    outbox.enqueue(receipt);
    assert.deepEqual(calls, ['remember', 'publish']);
    finishPublish();
    await nextTurn();
    assert.deepEqual(calls, ['remember', 'publish', 'save']);
    failSave = false;
    outbox.flush();
    await nextTurn();
    outbox.enqueue(receipt);
    assert.deepEqual(calls, ['remember', 'publish', 'save', 'save', 'forget']);
  } finally { outbox.stop(); }
});

test('failed publication retries automatically before persisting', async () => {
  let attempts = 0;
  let saved;
  const done = new Promise((resolve) => { saved = resolve; });
  const outbox = createReadReceiptOutbox({
    publish: async () => { if (++attempts === 1) throw new Error('Disconnected'); },
    save: async () => { assert.equal(attempts, 2); saved(); },
    remember: () => {}, forget: () => {}, retryMs: 5,
  });
  try {
    outbox.enqueue({ messageSerial: 'message', readAt });
    await done;
    assert.equal(attempts, 2);
  } finally { outbox.stop(); }
});

test('pending receipt survives stopping and can be replayed on reopening', async () => {
  const storage = new Map();
  const receipt = { messageSerial: 'message', readAt };
  const options = {
    publish: async () => {},
    save: async () => { throw new Error('DB unavailable'); },
    remember: (value) => storage.set(value.messageSerial, value),
    forget: (value) => storage.delete(value.messageSerial),
  };
  const first = createReadReceiptOutbox(options);
  first.enqueue(receipt);
  await nextTurn();
  first.stop();
  assert.deepEqual(storage.get('message'), receipt);
  const second = createReadReceiptOutbox({ ...options, save: async () => {} });
  try {
    for (const value of storage.values()) second.enqueue(value);
    await nextTurn();
    assert.equal(storage.size, 0);
  } finally { second.stop(); }
});

test('realtime ticks require the Ably-authenticated reader identity', () => {
  const { remoteReadReceipt } = require('../lib/read-receipts.ts');
  const event = { messageSerial: 'message', readAt, readerId: 'reader' };
  assert.deepEqual(remoteReadReceipt(event, 'reader', 'sender'), event);
  assert.equal(remoteReadReceipt(event, 'imposter', 'sender'), null);
  assert.equal(remoteReadReceipt(event, undefined, 'sender'), null);
  assert.equal(remoteReadReceipt(event, 'reader', 'reader'), null);
});
