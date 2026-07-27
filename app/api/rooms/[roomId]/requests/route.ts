import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await context.params;
  const room = await prisma.room.findFirst({
    where: { id: roomId, ownerId: user.id },
    select: { id: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const requests = await prisma.roomMember.findMany({
    where: { roomId, status: "PENDING" },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
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
  });

  return NextResponse.json({
    requests: requests.map(({ id, joinedAt, user }) => ({
      id,
      requestedAt: joinedAt.toISOString(),
      user,
    })),
  });
}
