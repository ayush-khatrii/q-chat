export const ROOM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type RoomRole = (typeof ROOM_ROLES)[keyof typeof ROOM_ROLES];
export type PersistedRoomRole = Exclude<RoomRole, "SUPER_ADMIN">;

export function effectiveRoomRole(
  ownerId: string,
  userId: string,
  storedRole: PersistedRoomRole = ROOM_ROLES.MEMBER,
): RoomRole {
  return ownerId === userId ? ROOM_ROLES.SUPER_ADMIN : storedRole;
}

export function canModerateRequests(role: RoomRole) {
  return role === ROOM_ROLES.SUPER_ADMIN || role === ROOM_ROLES.ADMIN;
}

export function canPromoteMember(role: RoomRole) {
  return role === ROOM_ROLES.SUPER_ADMIN || role === ROOM_ROLES.ADMIN;
}

export function canDemoteAdmin(role: RoomRole) {
  return role === ROOM_ROLES.SUPER_ADMIN;
}

export function canRemoveMember(actor: RoomRole, target: RoomRole) {
  if (target === ROOM_ROLES.SUPER_ADMIN) return false;
  if (actor === ROOM_ROLES.SUPER_ADMIN) return true;
  return actor === ROOM_ROLES.ADMIN && target === ROOM_ROLES.MEMBER;
}

export function canChangeRole(
  actor: RoomRole,
  target: RoomRole,
  next: PersistedRoomRole,
) {
  if (target === ROOM_ROLES.SUPER_ADMIN) return false;
  if (next === ROOM_ROLES.ADMIN) {
    return target === ROOM_ROLES.MEMBER && canPromoteMember(actor);
  }
  return target === ROOM_ROLES.ADMIN && canDemoteAdmin(actor);
}

export function canDeleteRoom(role: RoomRole) {
  return role === ROOM_ROLES.SUPER_ADMIN;
}

export function canEditRoom(role: RoomRole) {
  return role === ROOM_ROLES.SUPER_ADMIN || role === ROOM_ROLES.ADMIN;
}
