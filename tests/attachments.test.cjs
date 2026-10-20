const assert = require("node:assert/strict");
const { test } = require("node:test");
const Module = require("node:module");
const {
  ATTACHMENT_CONFIG,
  attachmentIds,
  validateAttachment,
} = require("../constants/attachments.ts");
const {
  validateFileContent,
  zipEntryNames,
} = require("../lib/attachments/validation.ts");

// Server modules use ordinary dependency stubs: these tests never call R2 or QStash.
async function withStubs(stubs, run) {
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
const prismaStub = (db) => ({ __esModule: true, default: db });

test("exact 1 GB boundary, filename checks, MIME checks and disallowed active types", () => {
  assert.equal(
    validateAttachment("video.mp4", 1_000_000_000, "video/mp4").preview,
    "video",
  );
  for (const size of [0, -1, 1_000_000_001, 1.5, Infinity])
    assert.throws(() => validateAttachment("video.mp4", size, "video/mp4"));
  for (const name of [
    "bad.svg",
    "bad.html",
    "app.exe",
    "macro.docm",
    "../file.pdf",
    "bad\n.pdf",
  ])
    assert.throws(() => validateAttachment(name, 100, ""));
  assert.throws(() => validateAttachment("image.png", 100, "application/pdf"));
  assert.equal(validateAttachment("report.DOCX", 100, "").preview, "none");
  assert.equal(
    validateAttachment("sound.wav", 100, "audio/x-wav").mime,
    "audio/wav",
  );
});

test("only bounded opaque attachment IDs are accepted from message metadata", () => {
  assert.deepEqual(
    attachmentIds({
      attachmentIds: ["one", "one", "two", "https://evil.example"],
    }),
    ["one", "two"],
  );
  assert.deepEqual(attachmentIds({ attachmentIds: Array(6).fill("id") }), []);
  assert.deepEqual(attachmentIds(null), []);
});

test("file content sniffing rejects spoofed images and active text, preserves actual file bytes", async () => {
  const original = Buffer.from("%PDF-1.7\n% Original bytes\n");
  const read = async (_key, start, end) => original.subarray(start, end + 1);
  await validateFileContent(
    { objectKey: "key", name: "file.pdf", size: original.length },
    read,
  );
  assert.deepEqual(original, Buffer.from("%PDF-1.7\n% Original bytes\n"));
  await assert.rejects(
    validateFileContent(
      { objectKey: "key", name: "file.png", size: original.length },
      read,
    ),
  );
  const text = Buffer.from("<script>alert(1)</script>");
  await assert.rejects(
    validateFileContent(
      { objectKey: "key", name: "file.txt", size: text.length },
      async () => text,
    ),
  );
  await validateFileContent(
    { objectKey: "key", name: "file.csv", size: 8 },
    async () => Buffer.from("a,b\n1,2\n"),
  );
});

function zipDirectory(names) {
  return Buffer.concat(
    names.map((name) => {
      const bytes = Buffer.from(name);
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50);
      header.writeUInt16LE(bytes.length, 28);
      return Buffer.concat([header, bytes]);
    }),
  );
}

test("bounded ZIP directory validation rejects traversal, macro payloads and malformed entries", async () => {
  assert.deepEqual(
    zipEntryNames(zipDirectory(["[Content_Types].xml", "word/document.xml"])),
    ["[Content_Types].xml", "word/document.xml"],
  );
  for (const names of [["../payload"], ["/absolute"], ["word/vbaProject.bin"]])
    assert.throws(() => zipEntryNames(zipDirectory(names)));
  assert.throws(() => zipEntryNames(Buffer.alloc(3)));
  const encrypted = zipDirectory(["secret"]);
  encrypted.writeUInt16LE(1, 8);
  assert.throws(() => zipEntryNames(encrypted));
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  const directory = zipDirectory(["[Content_Types].xml", "word/document.xml"]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(2, 8);
  end.writeUInt16LE(2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(header.length, 16);
  const bytes = Buffer.concat([header, directory, end]);
  const read = async (_key, start, end) => bytes.subarray(start, end + 1);
  await validateFileContent(
    { objectKey: "key", name: "file.docx", size: bytes.length },
    read,
  );
  await assert.rejects(
    validateFileContent(
      { objectKey: "key", name: "file.xlsx", size: bytes.length },
      read,
    ),
  );
});

test("session, origin, current room membership and database rate limits are required", async () => {
  let signedIn = false;
  let member = false;
  let count = 1;
  const previousUrl = process.env.APP_URL;
  process.env.APP_URL = "https://chat.example";
  try {
    await withStubs(
      {
        "@/lib/auth": {
          auth: {
            api: {
              getSession: async () =>
                signedIn ? { user: { id: "user" } } : null,
            },
          },
        },
        "@/lib/prisma": prismaStub({
          attachmentRateLimit: { upsert: async () => ({ count }) },
          roomMember: {
            findUnique: async () =>
              member ? { room: { code: "CODE" } } : null,
          },
        }),
      },
      async () => {
        const { attachmentUser, requireRoom, jsonBody } = fresh(
          "../lib/attachments/http.ts",
        );
        const request = (origin) =>
          new Request("https://chat.example/api/attachments", {
            method: "POST",
            headers: { origin },
            body: "{}",
          });
        await assert.rejects(attachmentUser(request("https://chat.example")), {
          status: 401,
        });
        signedIn = true;
        await assert.rejects(attachmentUser(request("https://evil.example")), {
          status: 403,
        });
        assert.equal(
          (await attachmentUser(request("https://chat.example"))).id,
          "user",
        );
        await assert.rejects(requireRoom("room", "user"), { status: 404 });
        member = true;
        assert.equal((await requireRoom("room", "user")).code, "CODE");
        count = ATTACHMENT_CONFIG.maxRequestsPerMinute + 1;
        await assert.rejects(attachmentUser(request("https://chat.example")), {
          status: 429,
        });
        await assert.rejects(
          jsonBody(
            new Request("https://chat.example", {
              method: "POST",
              body: "x".repeat(20_000),
            }),
          ),
          { status: 413 },
        );
      },
    );
  } finally {
    if (previousUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousUrl;
  }
});

test("multipart completion verifies actual part sizes and deletes rejected uploads", async () => {
  let file = {
    id: "file",
    objectKey: "key",
    uploadId: "multipart",
    name: "report.pdf",
    size: 100,
    state: "uploading",
    expiresAt: new Date(Date.now() + 60_000),
    messageSerial: null,
  };
  let size = 99;
  let removed = 0;
  let validated = 0;
  const sent = [];
  const db = {
    attachmentUpload: {
      findUniqueOrThrow: async () => ({ ...file }),
      updateMany: async ({ where, data }) => {
        if (where.state && file.state !== where.state) return { count: 0 };
        Object.assign(file, data);
        return { count: 1 };
      },
      update: async ({ data }) => Object.assign(file, data),
    },
  };
  await withStubs(
    {
      "@/lib/prisma": prismaStub(db),
      "./r2": {
        r2: () => ({
          bucket: "private",
          client: {
            send: async (command) => {
              sent.push(command.constructor.name);
              return command.constructor.name === "ListPartsCommand"
                ? { Parts: [{ PartNumber: 1, Size: size, ETag: "etag" }] }
                : {};
            },
          },
        }),
        readBytes: async () => Buffer.alloc(0),
        removeStoredFile: async () => {
          removed++;
        },
      },
      "./validation": {
        validateFileContent: async () => {
          validated++;
        },
      },
    },
    async () => {
      const { completeUpload, signPart } = fresh(
        "../lib/attachments/uploads.ts",
      );
      await assert.rejects(signPart(file, 2), /Invalid part/);
      await assert.rejects(completeUpload("file"), /size/);
      assert.equal(removed, 1);
      assert.equal(validated, 0);
      assert.ok(!sent.includes("CompleteMultipartUploadCommand"));
      file = {
        ...file,
        deletedAt: null,
        state: "uploading",
        expiresAt: new Date(Date.now() + 60_000),
      };
      size = 100;
      await completeUpload("file");
      assert.equal(file.state, "ready");
      assert.equal(file.uploadId, null);
      assert.equal(validated, 1);
      const previous = sent.length;
      await completeUpload("file");
      assert.equal(sent.length, previous); // A lost success response can be retried safely.
    },
  );
});

test("binding uses verified sender/time, is idempotent, blocks reuse and respects exact expiry", async () => {
  const sentAt = new Date(Date.now() - 1000);
  const file = {
    id: "file",
    ownerId: "sender",
    roomId: "room",
    state: "ready",
    name: "report.pdf",
    mimeType: "application/pdf",
    size: 100,
    createdAt: new Date(sentAt.getTime() - 1000),
    updatedAt: new Date(sentAt.getTime() - 500),
    expiresAt: new Date(Date.now() + 3_600_000),
    messageSerial: null,
    deletedAt: null,
  };
  let message = {
    clientId: "sender",
    timestamp: sentAt,
    metadata: { attachmentIds: ["file"] },
    action: "message.create",
  };
  let writes = 0;
  const tx = {
    roomMember: { findUnique: async () => ({ id: "member" }) },
    attachmentUpload: {
      findMany: async ({ where }) =>
        where.ownerId && where.ownerId !== file.ownerId ? [] : [{ ...file }],
      updateMany: async ({ data }) => {
        writes++;
        Object.assign(file, data);
        return { count: 1 };
      },
      update: async ({ data }) => Object.assign(file, data),
    },
  };
  await withStubs(
    {
      "@/lib/prisma": prismaStub({
        $transaction: async (callback) => callback(tx),
      }),
      "./ably": { getAttachmentMessage: async () => message },
    },
    async () => {
      const { resolveAttachments } = fresh("../lib/attachments/messages.ts");
      const resolve = (serial = "serial", ids = ["file"]) =>
        resolveAttachments("room", "CODE", "reader", serial, ids);
      await assert.rejects(resolve("serial", ["other"]), /match/);
      message.clientId = "imposter";
      await assert.rejects(resolve(), /not found/);
      message.clientId = "sender";
      const result = await resolve();
      assert.equal(
        result[0].expiresAt,
        new Date(sentAt.getTime() + 86_400_000).toISOString(),
      );
      await resolve();
      assert.equal(writes, 1);
      await assert.rejects(resolve("different-serial"), /another message/);
      file.expiresAt = new Date(Date.now());
      assert.equal((await resolve())[0].state, "expired");
      message.metadata = {};
      message.action = require("@ably/chat").ChatMessageAction.MessageDelete;
      await resolve();
      assert.equal(file.state, "deleted");
    },
  );
});

test("cleanup retries failed deletions, is repeatable, and enqueues bounded continuation", async () => {
  const files = Array.from(
    { length: ATTACHMENT_CONFIG.cleanupBatchSize },
    (_, i) => ({
      id: `${i}`,
      objectKey: `key-${i}`,
      uploadId: null,
      expiresAt: new Date(0),
    }),
  );
  let fail = true;
  let continuations = 0;
  let deleted = 0;
  const oldToken = process.env.QSTASH_TOKEN;
  const oldUrl = process.env.APP_URL;
  process.env.QSTASH_TOKEN = "test";
  process.env.APP_URL = "https://chat.example";
  try {
    await withStubs(
      {
        "@/lib/prisma": prismaStub({
          attachmentUpload: {
            findMany: async () => files,
            updateMany: async () => {
              deleted++;
            },
          },
          attachmentRateLimit: { deleteMany: async () => {} },
        }),
        "./r2": {
          removeStoredFile: async (file) => {
            if (fail && file.id === "0") throw new Error("R2 unavailable");
          },
        },
        "@upstash/qstash": {
          Client: class {
            publishJSON = async ({ url }) => {
              assert.equal(url, "https://chat.example/api/attachments/cleanup");
              continuations++;
            };
          },
        },
      },
      async () => {
        const { cleanupAttachments } = fresh("../lib/attachments/cleanup.ts");
        await assert.rejects(cleanupAttachments(), /retry/);
        assert.equal(deleted, files.length - 1);
        assert.equal(continuations, 0);
        fail = false;
        await cleanupAttachments();
        assert.equal(continuations, 1);
        files.length = 0;
        assert.deepEqual(await cleanupAttachments(), { deleted: 0 });
      },
    );
  } finally {
    if (oldToken === undefined) delete process.env.QSTASH_TOKEN;
    else process.env.QSTASH_TOKEN = oldToken;
    if (oldUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = oldUrl;
  }
});

test("cleanup endpoint fails closed for missing keys and invalid QStash signatures", async () => {
  const previous = [
    process.env.QSTASH_CURRENT_SIGNING_KEY,
    process.env.QSTASH_NEXT_SIGNING_KEY,
  ];
  delete process.env.QSTASH_CURRENT_SIGNING_KEY;
  delete process.env.QSTASH_NEXT_SIGNING_KEY;
  let called = false;
  try {
    await withStubs(
      {
        "@/lib/attachments/cleanup": {
          cleanupAttachments: async () => {
            called = true;
          },
        },
      },
      async () => {
        const { POST } = fresh("../app/api/attachments/cleanup/route.ts");
        const request = () =>
          new Request("https://chat.example/api/attachments/cleanup", {
            method: "POST",
            body: "{}",
          });
        assert.equal((await POST(request())).status, 503);
        process.env.QSTASH_CURRENT_SIGNING_KEY = "test-current";
        process.env.QSTASH_NEXT_SIGNING_KEY = "test-next";
        assert.equal((await POST(request())).status, 403);
        assert.equal(called, false);
      },
    );
  } finally {
    for (const [i, key] of [
      "QSTASH_CURRENT_SIGNING_KEY",
      "QSTASH_NEXT_SIGNING_KEY",
    ].entries()) {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    }
  }
});

test("read signatures last at most 60 seconds and never extend the file expiry", async () => {
  const keys = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
  ];
  const previous = keys.map((key) => process.env[key]);
  for (const key of keys) process.env[key] = "test-only";
  const signatures = [];
  try {
    await withStubs(
      {
        "@aws-sdk/s3-request-presigner": {
          getSignedUrl: async (_client, command, options) => {
            signatures.push({ input: command.input, ...options });
            return "https://r2.example/signed";
          },
        },
      },
      async () => {
        const { fileUrl } = fresh("../lib/attachments/r2.ts");
        const file = {
          objectKey: "key",
          name: "photo.png",
          mimeType: "image/png",
          expiresAt: new Date(Date.now() + 3_600_000),
        };
        await fileUrl(file, true);
        assert.equal(signatures[0].expiresIn, 60);
        assert.equal(
          signatures[0].input.ResponseCacheControl,
          "private, no-store, max-age=0",
        );
        assert.match(
          signatures[0].input.ResponseContentDisposition,
          /^inline;/,
        );
        file.expiresAt = new Date(Date.now() + 10_000);
        await fileUrl(file, false);
        assert.ok(signatures[1].expiresIn <= 10);
        assert.match(
          signatures[1].input.ResponseContentDisposition,
          /^attachment;/,
        );
        file.expiresAt = new Date(Date.now());
        await assert.rejects(fileUrl(file, false), /expired/);
        assert.equal(signatures.length, 2);
      },
    );
  } finally {
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
  }
});

test("attachment endpoints reject other users, other rooms, and expired reads before signing", async () => {
  let owner = "someone-else";
  let member = true;
  let expired = false;
  let signatures = 0;
  const file = () => ({
    id: "file",
    ownerId: owner,
    roomId: "room",
    messageSerial: expired ? "serial" : null,
    state: "ready",
    expiresAt: new Date(expired ? 0 : Date.now() + 60_000),
    name: "photo.png",
    deletedAt: null,
  });
  const http = require("../lib/attachments/http.ts");
  await withStubs(
    {
      "@/lib/prisma": prismaStub({
        attachmentUpload: { findUnique: async () => file() },
      }),
      "@/lib/attachments/http": {
        ...http,
        attachmentUser: async () => ({ id: "self" }),
        requireRoom: async () => {
          if (!member) throw new http.AttachmentError("Room not found.", 404);
          return { code: "CODE" };
        },
      },
      "@/lib/attachments/r2": {
        fileUrl: async () => {
          signatures++;
          return "https://r2.example";
        },
      },
    },
    async () => {
      const { POST, GET } = fresh("../app/api/attachments/[id]/route.ts");
      const context = { params: Promise.resolve({ id: "file" }) };
      const request = () =>
        new Request("https://chat.example/api/attachments/file", {
          method: "POST",
          body: JSON.stringify({ action: "complete" }),
        });
      assert.equal((await POST(request(), context)).status, 404);
      owner = "self";
      member = false;
      assert.equal((await POST(request(), context)).status, 404);
      member = true;
      expired = true;
      assert.equal(
        (
          await GET(
            new Request("https://chat.example/api/attachments/file"),
            context,
          )
        ).status,
        410,
      );
      assert.equal(signatures, 0);
    },
  );
});

test("QStash accepts a valid signed body and rejects tampered bodies and destinations", async () => {
  const { createHash, createHmac } = require("node:crypto");
  const keys = [
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "APP_URL",
  ];
  const old = keys.map((key) => process.env[key]);
  process.env.QSTASH_CURRENT_SIGNING_KEY =
    "local-test-signing-key-32-characters";
  process.env.QSTASH_NEXT_SIGNING_KEY = "local-next-signing-key-32-characters";
  process.env.APP_URL = "https://chat.example";
  const url = "https://chat.example/api/attachments/cleanup";
  const body = "{}";
  let cleaned = 0;
  const sign = (destination) => {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const seconds = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iss: "Upstash",
        sub: destination,
        exp: seconds + 60,
        nbf: seconds - 1,
        body: createHash("sha256").update(body).digest("base64url"),
      }),
    ).toString("base64url");
    return `${header}.${payload}.${createHmac("sha256", process.env.QSTASH_CURRENT_SIGNING_KEY).update(`${header}.${payload}`).digest("base64url")}`;
  };
  try {
    await withStubs(
      {
        "@/lib/attachments/cleanup": {
          cleanupAttachments: async () => {
            cleaned++;
            return { deleted: 1 };
          },
        },
      },
      async () => {
        const { POST } = fresh("../app/api/attachments/cleanup/route.ts");
        const request = (signature, data = body) =>
          new Request(url, {
            method: "POST",
            headers: { "upstash-signature": signature },
            body: data,
          });
        assert.equal((await POST(request(sign(url)))).status, 200);
        assert.equal(cleaned, 1);
        assert.equal((await POST(request(sign(url), "changed"))).status, 403);
        assert.equal(
          (await POST(request(sign("https://other.example/cleanup")))).status,
          403,
        );
        assert.equal(cleaned, 1);
      },
    );
  } finally {
    keys.forEach((key, i) => {
      if (old[i] === undefined) delete process.env[key];
      else process.env[key] = old[i];
    });
  }
});
