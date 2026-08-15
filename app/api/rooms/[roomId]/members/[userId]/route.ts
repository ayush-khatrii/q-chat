import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ roomId: string; userId: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, userId } = await context.params;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      ownerId: true,
      roomMembers: {
        where: { userId },
        select: { id: true },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (room.ownerId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the room admin can remove members." },
      { status: 403 },
    );
  }

  if (userId === room.ownerId) {
    return NextResponse.json(
      { error: "The room admin cannot be removed." },
      { status: 400 },
    );
  }

  if (room.roomMembers.length === 0) {
    return NextResponse.json(
      { error: "That user is not a member of this room." },
      { status: 404 },
    );
  }

  await prisma.roomMember.delete({
    where: { id: room.roomMembers[0].id },
  });

  return NextResponse.json({ action: "removed", userId });
}
