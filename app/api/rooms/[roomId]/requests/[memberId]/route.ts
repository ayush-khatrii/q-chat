import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  publishRoomEventSafely,
  ownerRequestEventsChannel,
  userRequestStatusChannel,
} from "@/lib/room-events";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string; memberId: string }> },
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, memberId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  const status =
    body?.status === "APPROVED" || body?.status === "REJECTED"
      ? body.status
      : null;

  if (!status) {
    return NextResponse.json(
      { error: "Status must be APPROVED or REJECTED." },
      { status: 400 },
    );
  }

  const room = await prisma.room.findFirst({
    where: { id: roomId, ownerId: user.id },
    select: { id: true, ownerId: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const pending = await tx.roomMember.findFirst({
      where: { id: memberId, roomId, status: "PENDING" },
      select: { id: true, userId: true },
    });

    if (!pending) {
      return null;
    }

    const result = await tx.roomMember.updateMany({
      where: { id: pending.id, status: "PENDING" },
      data: {
        status,
        ...(status === "APPROVED" ? { joinedAt: new Date() } : {}),
      },
    });

    return result.count === 1
      ? { id: pending.id, userId: pending.userId, status }
      : null;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "This request has already been decided." },
      { status: 409 },
    );
  }

  await Promise.all([
    publishRoomEventSafely(
      userRequestStatusChannel(updated.userId),
      "join-request.updated",
      {
        requestId: updated.id,
        roomId,
        status: updated.status,
      },
    ),
    publishRoomEventSafely(
      ownerRequestEventsChannel(room.ownerId),
      "join-request.updated",
      {
        requestId: updated.id,
        roomId,
        status: updated.status,
      },
    ),
  ]);

  return NextResponse.json({ request: updated });
}
