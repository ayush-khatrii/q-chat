import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/users/:userId
// Returns a public profile for a user, plus the rooms they share with
// the currently signed-in viewer (so we can show "rooms joined with me").
export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const viewerId = session.user.id;

  // Rooms where BOTH this user and the viewer are members.
  const sharedMemberships = await prisma.roomMember.findMany({
    where: {
      userId,
      room: {
        roomMembers: {
          some: { userId: viewerId },
        },
      },
    },
    select: {
      joinedAt: true,
      room: {
        select: {
          id: true,
          code: true,
          name: true,
          ownerId: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const [createdRoomsCount, joinedRoomsCount] = await Promise.all([
    prisma.room.count({ where: { ownerId: userId } }),
    prisma.roomMember.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
    },
    isMe: viewerId === userId,
    sharedRooms: sharedMemberships.map((membership) => ({
      id: membership.room.id,
      code: membership.room.code,
      name: membership.room.name,
      ownerId: membership.room.ownerId,
      joinedAt: membership.joinedAt.toISOString(),
    })),
    createdRoomsCount,
    joinedRoomsCount,
  });
}
