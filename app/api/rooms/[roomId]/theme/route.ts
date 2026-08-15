import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeRoomTheme, roomThemeSchema } from "@/lib/rooms";

async function getMemberRoom(roomId: string, userId: string) {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      roomMembers: { some: { userId } },
    },
    select: { id: true, theme: true, updatedAt: true },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await context.params;
  const room = await getMemberRoom(roomId, session.user.id);

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  return NextResponse.json({
    theme: normalizeRoomTheme(room.theme),
    updatedAt: room.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await context.params;
  const room = await getMemberRoom(roomId, session.user.id);

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsedTheme = roomThemeSchema.safeParse(json);

  if (!parsedTheme.success) {
    return NextResponse.json(
      { error: "Invalid room theme configuration." },
      { status: 400 },
    );
  }

  const updatedRoom = await prisma.room.update({
    where: { id: room.id },
    data: { theme: parsedTheme.data },
    select: { theme: true, updatedAt: true },
  });

  return NextResponse.json({
    theme: normalizeRoomTheme(updatedRoom.theme),
    updatedAt: updatedRoom.updatedAt.toISOString(),
  });
}
