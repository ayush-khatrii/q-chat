import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { joinRoomSchema, MAX_ROOM_MEMBERS } from "@/lib/rooms";
import { serializeRoom } from "@/lib/room-service";

class RoomFullError extends Error {}

function isTransactionConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  );
}

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
    select: { id: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await prisma.$transaction(
          async (transaction) => {
            const existingMembership = await transaction.roomMember.findUnique({
              where: {
                userId_roomId: {
                  userId: session.user.id,
                  roomId: room.id,
                },
              },
              select: { id: true },
            });

            if (existingMembership) {
              return;
            }

            const memberCount = await transaction.roomMember.count({
              where: { roomId: room.id },
            });

            if (memberCount >= MAX_ROOM_MEMBERS) {
              throw new RoomFullError();
            }

            await transaction.roomMember.create({
              data: {
                userId: session.user.id,
                roomId: room.id,
              },
            });
          },
          { isolationLevel: "Serializable" },
        );

        break;
      } catch (error) {
        if (isTransactionConflict(error) && attempt < 2) {
          continue;
        }

        throw error;
      }
    }
  } catch (error) {
    if (error instanceof RoomFullError) {
      return NextResponse.json(
        { error: "This room is full. Rooms currently support only 2 members." },
        { status: 409 },
      );
    }

    throw error;
  }

  const joinedRoom = await prisma.room.findUniqueOrThrow({
    where: { id: room.id },
    select: {
      id: true,
      name: true,
      code: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { roomMembers: true } },
      roomMembers: {
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
  });
}
