import type { RoomRole } from "@/lib/permissions";

export const JOIN_REQUEST_TTL_MS = 15 * 60 * 1000;

export type ActivityUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type RoomActivityType =
  | "join.requested"
  | "join.approved"
  | "join.rejected"
  | "member.joined"
  | "member.left"
  | "member.removed"
  | "member.promoted"
  | "member.demoted"
  | "room.deleted";

export type RoomActivity = {
  id: string;
  type: RoomActivityType;
  room: { id: string; code: string; name: string };
  actor: ActivityUser;
  subject?: ActivityUser;
  subjectRole?: RoomRole;
  createdAt: string;
  expiresAt?: string;
  request?: { id: string; ticket: string };
};

export function roomActivityChannel(roomId: string) {
  return `qchat:room:${roomId}:activity`;
}

export function userActivityChannel(userId: string) {
  return `qchat:user:${userId}:room-events`;
}

export function isRoomActivity(value: unknown): value is RoomActivity {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<RoomActivity>;
  return Boolean(
    event.id &&
    event.type &&
    event.room?.id &&
    event.actor?.id &&
    event.createdAt,
  );
}
