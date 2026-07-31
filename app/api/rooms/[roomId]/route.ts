import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await context.params;
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
    select: {
      id: true,
      ownerId: true,
      roomMembers: {
        where: {
          userId: user.id,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!room || (room.ownerId !== user.id && room.roomMembers.length === 0)) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.ownerId === user.id) {
    await prisma.$transaction([
      prisma.roomMember.deleteMany({
        where: {
          roomId,
        },
      }),
      prisma.room.delete({
        where: {
          id: roomId,
        },
      }),
    ]);

    return NextResponse.json({ action: "deleted" });
  }

  await prisma.roomMember.deleteMany({
    where: {
      roomId,
      userId: user.id,
    },
  });

  return NextResponse.json({ action: "left" });
}
