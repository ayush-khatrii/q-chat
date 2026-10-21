const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  ROOM_ROLES,
  effectiveRoomRole,
  canModerateRequests,
  canChangeRole,
  canRemoveMember,
  canDeleteRoom,
} = require("../lib/permissions.ts");

test("room creator is always the protected super admin", () => {
  assert.equal(
    effectiveRoomRole("owner", "owner", "MEMBER"),
    ROOM_ROLES.SUPER_ADMIN,
  );
  assert.equal(effectiveRoomRole("owner", "admin", "ADMIN"), ROOM_ROLES.ADMIN);
  assert.equal(
    canRemoveMember(ROOM_ROLES.SUPER_ADMIN, ROOM_ROLES.SUPER_ADMIN),
    false,
  );
  assert.equal(
    canChangeRole(ROOM_ROLES.SUPER_ADMIN, ROOM_ROLES.SUPER_ADMIN, "MEMBER"),
    false,
  );
});

test("admin and super admin permissions follow the room hierarchy", () => {
  assert.equal(canModerateRequests(ROOM_ROLES.MEMBER), false);
  assert.equal(canModerateRequests(ROOM_ROLES.ADMIN), true);
  assert.equal(
    canChangeRole(ROOM_ROLES.ADMIN, ROOM_ROLES.MEMBER, "ADMIN"),
    true,
  );
  assert.equal(
    canChangeRole(ROOM_ROLES.ADMIN, ROOM_ROLES.ADMIN, "MEMBER"),
    false,
  );
  assert.equal(canRemoveMember(ROOM_ROLES.ADMIN, ROOM_ROLES.MEMBER), true);
  assert.equal(canRemoveMember(ROOM_ROLES.ADMIN, ROOM_ROLES.ADMIN), false);
  assert.equal(
    canChangeRole(ROOM_ROLES.SUPER_ADMIN, ROOM_ROLES.ADMIN, "MEMBER"),
    true,
  );
  assert.equal(canRemoveMember(ROOM_ROLES.SUPER_ADMIN, ROOM_ROLES.ADMIN), true);
  assert.equal(canDeleteRoom(ROOM_ROLES.ADMIN), false);
  assert.equal(canDeleteRoom(ROOM_ROLES.SUPER_ADMIN), true);
});
