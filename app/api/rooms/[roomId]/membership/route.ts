import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await context.params;
  const membership = await prisma.roomMember.findUnique({
    where: {
      userId_roomId: {
        userId: session.user.id,
        roomId,
      },
    },
    select: {
      id: true,
      status: true,
      room: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  return NextResponse.json({
    membership: {
      id: membership.id,
      status: membership.status,
      roomId,
      roomCode: membership.room.code,
      roomName: membership.room.name,
    },
  });
}
