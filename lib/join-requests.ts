import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import * as Ably from "ably";
import {
  JOIN_REQUEST_TTL_MS,
  roomActivityChannel,
  userActivityChannel,
  type ActivityUser,
  type RoomActivity,
  type RoomActivityType,
} from "@/lib/room-activity";

type JoinRequestClaims = {
  requestId: string;
  roomId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
};

function signingSecret() {
  const value =
    process.env.JOIN_REQUEST_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("JOIN_REQUEST_SECRET is not configured.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", signingSecret())
    .update(payload)
    .digest("base64url");
}

export function createJoinRequestTicket(roomId: string, userId: string) {
  const createdAt = Date.now();
  const claims: JoinRequestClaims = {
    requestId: randomUUID(),
    roomId,
    userId,
    createdAt,
    expiresAt: createdAt + JOIN_REQUEST_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { claims, ticket: `${payload}.${signature(payload)}` };
}

export function verifyJoinRequestTicket(
  ticket: string,
): JoinRequestClaims | null {
  const [payload, supplied, extra] = ticket.split(".");
  if (!payload || !supplied || extra) return null;
  const expected = signature(payload);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as JoinRequestClaims;
    if (
      !parsed.requestId ||
      !parsed.roomId ||
      !parsed.userId ||
      !Number.isFinite(parsed.createdAt) ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= Date.now() ||
      parsed.expiresAt - parsed.createdAt !== JOIN_REQUEST_TTL_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function ablyRest() {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) throw new Error("ABLY_API_KEY is not configured.");
  return new Ably.Rest(apiKey);
}

export async function publishRoomActivity(
  activity: RoomActivity,
  recipientIds: string[] = [],
) {
  const client = ablyRest();
  const channels = [
    roomActivityChannel(activity.room.id),
    ...recipientIds.map(userActivityChannel),
  ];
  await Promise.all(
    [...new Set(channels)].map((channelName) =>
      client.channels.get(channelName).publish(activity.type, activity),
    ),
  );
}

export async function getJoinRequestResolution(
  roomId: string,
  requestId: string,
  createdAt: number,
) {
  const page = await ablyRest()
    .channels.get(roomActivityChannel(roomId))
    .history({ start: createdAt, direction: "backwards", limit: 200 });
  const match = page.items.find((message) => {
    const data = message.data as Partial<RoomActivity> | undefined;
    return (
      data?.id === requestId &&
      (data.type === "join.approved" || data.type === "join.rejected")
    );
  });
  return match?.data as RoomActivity | undefined;
}

export function createRoomActivity(input: {
  type: RoomActivityType;
  room: { id: string; code: string; name: string };
  actor: ActivityUser;
  subject?: ActivityUser;
  subjectRole?: RoomActivity["subjectRole"];
  request?: RoomActivity["request"];
  expiresAt?: number;
  id?: string;
}): RoomActivity {
  return {
    id: input.id ?? randomUUID(),
    type: input.type,
    room: input.room,
    actor: input.actor,
    subject: input.subject,
    subjectRole: input.subjectRole,
    request: input.request,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt
      ? new Date(input.expiresAt).toISOString()
      : undefined,
  };
}

export async function revokeUserTokens(userId: string) {
  try {
    await ablyRest().auth.revokeTokens([{ type: "clientId", value: userId }], {
      allowReauthMargin: false,
    });
  } catch (error) {
    console.error("Unable to revoke Ably tokens", {
      userId,
      type: error instanceof Error ? error.name : "Unknown",
    });
  }
}
