import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/me/profile
// Returns the signed-in user's rooms, split into rooms they created
// and rooms they only joined.
export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Rooms I created (I am the owner).
  const createdRooms = await prisma.room.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      createdAt: true,
      _count: { select: { roomMembers: true } },
    },
  });

  // Rooms I joined but did not create.
  const joinedRooms = await prisma.room.findMany({
    where: {
      ownerId: { not: userId },
      roomMembers: { some: { userId } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      createdAt: true,
      _count: { select: { roomMembers: true } },
    },
  });

  const serializeRooms = (
    rooms: typeof createdRooms,
  ) =>
    rooms.map((room) => ({
      id: room.id,
      code: room.code,
      name: room.name,
      memberCount: room._count.roomMembers,
      createdAt: room.createdAt.toISOString(),
    }));

  return NextResponse.json({
    createdRooms: serializeRooms(createdRooms),
    joinedRooms: serializeRooms(joinedRooms),
  });
}
