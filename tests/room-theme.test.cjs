const assert = require("node:assert/strict");
const { test } = require("node:test");
const Module = require("node:module");
const {
  DEFAULT_ROOM_THEME,
  normalizeRoomTheme,
  roomThemeSchema,
} = require("../lib/rooms.ts");
const { getRoomThemeStyle } = require("../components/chat/chat-appearance.tsx");

const previous = {
  surface: "#000000",
  outgoingBubble: "#ffffff",
  outgoingText: "#09090b",
  incomingBubble: "#262626",
  incomingText: "#fafafa",
  pattern: "none",
  patternColor: "#ffffff",
  patternOpacity: "subtle",
};

test("new and previous default palettes use requested colors and primary token", () => {
  assert.deepEqual(normalizeRoomTheme(previous), DEFAULT_ROOM_THEME);
  assert.deepEqual(
    normalizeRoomTheme({ ...previous, incomingBubble: "#000000" }),
    DEFAULT_ROOM_THEME,
  );
  assert.deepEqual(normalizeRoomTheme(null), DEFAULT_ROOM_THEME);
  assert.deepEqual(
    normalizeRoomTheme({
      ...DEFAULT_ROOM_THEME,
      outgoingBubble: "#262626",
      incomingBubble: "primary",
      outgoingBorder: "#a3a3a3",
      incomingBorder: "#a3a3a3",
    }),
    DEFAULT_ROOM_THEME,
  );
  assert.equal(DEFAULT_ROOM_THEME.outgoingBubble, "primary");
  assert.equal(DEFAULT_ROOM_THEME.incomingBubble, "#262626");
  assert.equal(DEFAULT_ROOM_THEME.incomingText, "#efefef");
  assert.equal(DEFAULT_ROOM_THEME.outgoingText, "#efefef");
  const style = getRoomThemeStyle(DEFAULT_ROOM_THEME);
  assert.equal(style["--chat-outgoing"], "var(--primary)");
  assert.equal(style["--chat-incoming"], "#262626");
  assert.equal(style["--chat-incoming-border"], "transparent");
  assert.equal(style["--chat-incoming-border-width"], "0px");
  assert.equal(style["--chat-outgoing-border"], "transparent");
  assert.equal(style["--chat-outgoing-border-width"], "0px");
});

test("old custom palettes retain their colors while border colors can be saved independently", () => {
  const custom = normalizeRoomTheme({ ...previous, outgoingBubble: "#112233" });
  assert.equal(custom.outgoingBubble, "#112233");
  assert.equal(custom.incomingBubble, "#262626");
  assert.equal(custom.outgoingBorder, "none");
  assert.equal(custom.incomingBorder, "none");
  const edited = {
    ...custom,
    outgoingBorder: "#123456",
    incomingBorder: "#abcdef",
  };
  assert.deepEqual(roomThemeSchema.parse(edited), edited);
  assert.equal(
    getRoomThemeStyle(edited)["--chat-outgoing-border-width"],
    "1px",
  );
  assert.equal(
    getRoomThemeStyle(edited)["--chat-incoming-border-width"],
    "1px",
  );
  assert.deepEqual(normalizeRoomTheme(edited), edited);
  assert.equal(
    normalizeRoomTheme({
      ...previous,
      outgoingBorder: "#123456",
      incomingBorder: "#abcdef",
    }).outgoingBorder,
    "#123456",
  );
  const borderlessCustom = {
    ...DEFAULT_ROOM_THEME,
    outgoingBubble: "#262626",
    incomingBubble: "primary",
  };
  assert.deepEqual(normalizeRoomTheme(borderlessCustom), borderlessCustom);
  assert.equal(getRoomThemeStyle(edited)["--chat-incoming-border"], "#abcdef");
  for (const invalid of ["red", "var(--bad)", "url(evil)", "#abc"])
    assert.equal(
      roomThemeSchema.safeParse({ ...edited, incomingBorder: invalid }).success,
      false,
    );
});

test("theme endpoint saves validated borders and primary color only for members", async () => {
  let authenticated = true;
  let member = true;
  let stored = previous;
  let writes = 0;
  const load = Module._load;
  Module._load = function (name, ...args) {
    if (name === "next/headers") return { headers: async () => new Headers() };
    if (name === "@/lib/auth")
      return {
        auth: {
          api: {
            getSession: async () =>
              authenticated ? { user: { id: "self" } } : null,
          },
        },
      };
    if (name === "@/lib/prisma")
      return {
        __esModule: true,
        default: {
          room: {
            findFirst: async () =>
              member
                ? { id: "room", theme: stored, updatedAt: new Date() }
                : null,
            update: async ({ data }) => {
              writes++;
              stored = data.theme;
              return { theme: stored, updatedAt: new Date() };
            },
          },
        },
      };
    return load.call(this, name, ...args);
  };
  try {
    const { GET, PATCH } = require("../app/api/rooms/[roomId]/theme/route.ts");
    const context = { params: Promise.resolve({ roomId: "room" }) };
    const patch = (theme) =>
      PATCH(
        new Request("https://chat.example/api/rooms/room/theme", {
          method: "PATCH",
          body: JSON.stringify(theme),
        }),
        context,
      );
    assert.deepEqual(
      (await (await GET(new Request("https://chat.example"), context)).json())
        .theme,
      DEFAULT_ROOM_THEME,
    );
    authenticated = false;
    assert.equal((await patch(DEFAULT_ROOM_THEME)).status, 401);
    authenticated = true;
    member = false;
    assert.equal((await patch(DEFAULT_ROOM_THEME)).status, 404);
    member = true;
    assert.equal(
      (await patch({ ...DEFAULT_ROOM_THEME, incomingBorder: "bad" })).status,
      400,
    );
    const custom = {
      ...DEFAULT_ROOM_THEME,
      outgoingBorder: "#123456",
      incomingBorder: "#654321",
    };
    assert.deepEqual((await (await patch(custom)).json()).theme, custom);
    assert.deepEqual(
      (await (await patch(DEFAULT_ROOM_THEME)).json()).theme,
      DEFAULT_ROOM_THEME,
    );
    assert.equal(writes, 2);
  } finally {
    Module._load = load;
  }
});
