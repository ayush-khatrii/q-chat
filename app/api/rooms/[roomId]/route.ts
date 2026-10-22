import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createRoomActivity,
  publishRoomActivity,
  revokeUserTokens,
} from "@/lib/join-requests";
import { sendActivityPush } from "@/lib/activity-push";
import { updateRoomSchema } from "@/lib/rooms";
import { canEditRoom, effectiveRoomRole } from "@/lib/permissions";

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await context.params;
  const parsed = updateRoomSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid room settings." },
      { status: 400 },
    );
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      ownerId: true,
      roomMembers: {
        where: { userId: user.id },
        select: { role: true },
      },
    },
  });
  const membership = room?.roomMembers[0];
  if (!room || !membership) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  const role = effectiveRoomRole(room.ownerId, user.id, membership.role);
  if (!canEditRoom(role)) {
    return NextResponse.json(
      { error: "Only room admins can edit room settings." },
      { status: 403 },
    );
  }

  try {
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: { name: parsed.data.name, code: parsed.data.code },
      select: { id: true, name: true, code: true, updatedAt: true },
    });
    return NextResponse.json({
      room: { ...updatedRoom, updatedAt: updatedRoom.updatedAt.toISOString() },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "That room code is already taken. Try another one." },
        { status: 409 },
      );
    }
    throw error;
  }
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
      code: true,
      name: true,
      ownerId: true,
      roomMembers: {
        select: { id: true, userId: true },
      },
    },
  });

  if (
    !room ||
    (room.ownerId !== user.id &&
      !room.roomMembers.some((member) => member.userId === user.id))
  ) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.ownerId === user.id) {
    await prisma.$transaction([
      prisma.attachmentUpload.updateMany({
        where: { roomId, deletedAt: null },
        data: { state: "deleted", expiresAt: new Date() },
      }),
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

    const activity = createRoomActivity({
      type: "room.deleted",
      room: { id: room.id, code: room.code, name: room.name },
      actor: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
      },
    });
    const memberIds = room.roomMembers.map((member) => member.userId);
    await publishRoomActivity(activity, memberIds);
    await Promise.all(memberIds.map(revokeUserTokens));
    await sendActivityPush(memberIds, activity);

    return NextResponse.json({ action: "deleted" });
  }

  await prisma.roomMember.deleteMany({
    where: {
      roomId,
      userId: user.id,
    },
  });

  const activity = createRoomActivity({
    type: "member.left",
    room: { id: room.id, code: room.code, name: room.name },
    actor: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    },
  });
  await publishRoomActivity(activity, [user.id]);
  await revokeUserTokens(user.id);

  return NextResponse.json({ action: "left" });
}
