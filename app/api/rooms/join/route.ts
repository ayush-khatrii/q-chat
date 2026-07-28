import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { joinRoomSchema } from "@/lib/rooms";
import { serializeRoom } from "@/lib/room-service";
import {
  publishRoomEventSafely,
  ownerRequestEventsChannel,
  userRequestStatusChannel,
} from "@/lib/room-events";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsedBody = joinRoomSchema.safeParse(json);

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
      name: true,
      code: true,
      ownerId: true,
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const existingMembership = await prisma.roomMember.findUnique({
    where: {
      userId_roomId: {
        userId: session.user.id,
        roomId: room.id,
      },
    },
    select: { status: true },
  });

  if (existingMembership?.status === "APPROVED") {
    const joinedRoom = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
      select: {
        id: true,
        name: true,
        code: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { roomMembers: { where: { status: "APPROVED" } } } },
        roomMembers: {
          where: { status: "APPROVED" },
          orderBy: { joinedAt: "asc" },
          select: {
            id: true,
            userId: true,
            roomId: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      room: serializeRoom(joinedRoom, session.user.id),
      status: "APPROVED",
    });
  }

  const membership = await prisma.roomMember.upsert({
    where: {
      userId_roomId: {
        userId: session.user.id,
        roomId: room.id,
      },
    },
    update: {
      status: "PENDING",
      joinedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      roomId: room.id,
      status: "PENDING",
    },
    select: { id: true, status: true },
  });

  await Promise.all([
    publishRoomEventSafely(
      ownerRequestEventsChannel(room.ownerId),
      "join-request.created",
      {
        requestId: membership.id,
        roomId: room.id,
      },
    ),
    publishRoomEventSafely(
      userRequestStatusChannel(session.user.id),
      "join-request.updated",
      {
        requestId: membership.id,
        roomId: room.id,
        roomCode: room.code,
        status: membership.status,
      },
    ),
  ]);

  return NextResponse.json(
    {
      request: {
        id: membership.id,
        roomId: room.id,
        roomCode: room.code,
        roomName: room.name,
        status: membership.status,
      },
    },
    { status: 202 },
  );
}
