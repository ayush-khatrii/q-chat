import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { joinRoomSchema, MAX_ROOM_MEMBERS } from "@/lib/rooms";
import { getRoomForMember } from "@/lib/room-service";
import {
  createJoinRequestTicket,
  createRoomActivity,
  publishRoomActivity,
} from "@/lib/join-requests";
import { canModerateRequests, effectiveRoomRole } from "@/lib/permissions";
import { sendActivityPush } from "@/lib/activity-push";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = joinRoomSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid room code." },
      { status: 400 },
    );
  }

  const room = await prisma.room.findUnique({
    where: { code: parsedBody.data.code },
    select: {
      id: true,
      code: true,
      name: true,
      ownerId: true,
      roomMembers: { select: { userId: true, role: true } },
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (room.roomMembers.some((member) => member.userId === session.user.id)) {
    const joinedRoom = await getRoomForMember(room.code, session.user.id);
    return NextResponse.json({ status: "joined", room: joinedRoom });
  }

  if (room.roomMembers.length >= MAX_ROOM_MEMBERS) {
    return NextResponse.json(
      {
        error: `This room is full. Rooms support up to ${MAX_ROOM_MEMBERS} members.`,
      },
      { status: 409 },
    );
  }

  const { claims, ticket } = createJoinRequestTicket(room.id, session.user.id);
  const activity = createRoomActivity({
    id: claims.requestId,
    type: "join.requested",
    room: { id: room.id, code: room.code, name: room.name },
    actor: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    request: { id: claims.requestId, ticket },
    expiresAt: claims.expiresAt,
  });
  await publishRoomActivity(activity);
  await sendActivityPush(
    room.roomMembers
      .filter((member) =>
        canModerateRequests(
          effectiveRoomRole(room.ownerId, member.userId, member.role),
        ),
      )
      .map((member) => member.userId),
    activity,
  );

  return NextResponse.json(
    {
      status: "pending",
      request: {
        id: claims.requestId,
        ticket,
        expiresAt: new Date(claims.expiresAt).toISOString(),
        room: activity.room,
      },
    },
    { status: 202 },
  );
}
