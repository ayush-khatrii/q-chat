const assert = require("node:assert/strict");
const { test } = require("node:test");
const Module = require("node:module");
const {
  pendingJoinRequests,
  pruneInbox,
  requestKey,
} = require("../lib/join-request-inbox.ts");
const {
  roomJoinRequestChannel,
  roomActivityChannel,
  userActivityChannel,
} = require("../lib/room-activity.ts");
const now = Date.now();
const event = (id, room = "a", actor = id, offset = 0) => ({
  id,
  type: "join.requested",
  room: { id: room },
  actor: { id: actor },
  request: { id, ticket: "private-ticket" },
  createdAt: new Date(now + offset).toISOString(),
  expiresAt: new Date(now + 900000).toISOString(),
});

test("inbox filters permissions, resolutions, expiration and duplicates without counting membership events", () => {
  const a = event("a");
  const b = event("b", "b");
  const old = event("old", "a", "repeat", -100);
  const latest = event("latest", "a", "repeat");
  const expired = {
    ...event("expired"),
    expiresAt: new Date(now - 1).toISOString(),
  };
  const activities = [
    a,
    b,
    old,
    latest,
    expired,
    { ...event("member"), type: "member.joined" },
  ];
  const permitted = (room) => room === "a";
  assert.deepEqual(
    pendingJoinRequests(activities, {}, now, permitted).map((x) => x.id),
    ["a", "latest"],
  );
  const state = {
    [requestKey(latest)]: { ignored: true, expiresAt: now + 900000 },
  };
  assert.deepEqual(
    pendingJoinRequests(
      [...activities, { ...a, type: "join.approved" }],
      state,
      now,
      permitted,
    ),
    [],
  );
  assert.equal(pendingJoinRequests(activities, {}, now, () => false).length, 0);
  assert.equal(
    pendingJoinRequests(
      [a],
      { [requestKey(a)]: { seen: true } },
      now,
      permitted,
    ).length,
    1,
    "seen remains actionable",
  );
});

test("persisted inbox prunes expired and malformed entries and isolates requests by room", () => {
  assert.deepEqual(
    pruneInbox(
      {
        expired: { expiresAt: now - 1 },
        invalid: null,
        good: { expiresAt: now + 1, seen: true, ignored: false },
      },
      now,
    ),
    { good: { expiresAt: now + 1, seen: true, ignored: false } },
  );
  assert.deepEqual(pruneInbox([], now), {});
  assert.notEqual(
    requestKey(event("same", "a")),
    requestKey(event("same", "b")),
  );
});

async function stubbed(stubs, run) {
  const original = Module._load;
  Module._load = function (name, ...args) {
    if (name === "server-only") return {};
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return original.call(this, name, ...args);
  };
  try {
    return await run();
  } finally {
    Module._load = original;
  }
}
function fresh(path) {
  delete require.cache[require.resolve(path)];
  return require(path);
}

test("join events and tickets publish only to admin channel and requester; resolution history is private", async () => {
  const calls = [];
  const previous = process.env.ABLY_API_KEY;
  process.env.ABLY_API_KEY = "test";
  try {
    await stubbed(
      {
        ably: {
          Rest: class {
            channels = {
              get: (channel) => ({
                publish: async (name, data) =>
                  calls.push({ channel, name, data }),
                history: async () => {
                  calls.push({ channel });
                  return { items: [] };
                },
              }),
            };
          },
        },
      },
      async () => {
        const { publishRoomActivity, getJoinRequestResolution } = fresh(
          "../lib/join-requests.ts",
        );
        await publishRoomActivity(event("request"));
        await publishRoomActivity(
          { ...event("request"), type: "join.approved" },
          ["requester"],
        );
        await publishRoomActivity({
          ...event("member"),
          type: "member.joined",
          request: undefined,
        });
        await getJoinRequestResolution("a", "request", now);
        assert.deepEqual(
          calls.map((x) => x.channel),
          [
            roomJoinRequestChannel("a"),
            roomJoinRequestChannel("a"),
            userActivityChannel("requester"),
            roomActivityChannel("a"),
            roomJoinRequestChannel("a"),
          ],
        );
        assert.equal(
          calls
            .filter((x) => x.data?.request)
            .some((x) => x.channel === roomActivityChannel("a")),
          false,
        );
      },
    );
  } finally {
    if (previous === undefined) delete process.env.ABLY_API_KEY;
    else process.env.ABLY_API_KEY = previous;
  }
});

test("Ably tokens grant private request channels only for owned and administered rooms", async () => {
  const previous = process.env.ABLY_API_KEY;
  process.env.ABLY_API_KEY = "test";
  let capabilities;
  try {
    await stubbed(
      {
        "next/headers": { headers: async () => new Headers() },
        "@/lib/auth": {
          auth: { api: { getSession: async () => ({ user: { id: "me" } }) } },
        },
        "@/lib/prisma": {
          __esModule: true,
          default: {
            roomMember: {
              findMany: async () => [
                {
                  roomId: "owned",
                  role: "MEMBER",
                  room: { code: "QC-OWNER", ownerId: "me" },
                },
                {
                  roomId: "admin",
                  role: "ADMIN",
                  room: { code: "QC-ADMIN", ownerId: "other" },
                },
                {
                  roomId: "member",
                  role: "MEMBER",
                  room: { code: "QC-MEMBER", ownerId: "other" },
                },
              ],
            },
          },
        },
        ably: {
          Rest: class {
            auth = {
              createTokenRequest: async (input) => {
                capabilities = JSON.parse(input.capability);
                return {};
              },
            };
          },
        },
      },
      async () => {
        const { GET } = fresh("../app/api/ably/auth/route.ts");
        assert.equal((await GET()).status, 200);
        assert.deepEqual(capabilities[roomJoinRequestChannel("owned")], [
          "subscribe",
          "history",
        ]);
        assert.deepEqual(capabilities[roomJoinRequestChannel("admin")], [
          "subscribe",
          "history",
        ]);
        assert.equal(capabilities[roomJoinRequestChannel("member")], undefined);
        assert.ok(capabilities[roomActivityChannel("member")]);
      },
    );
  } finally {
    if (previous === undefined) delete process.env.ABLY_API_KEY;
    else process.env.ABLY_API_KEY = previous;
  }
});
