import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  canChangeRole,
  canRemoveMember,
  effectiveRoomRole,
  type PersistedRoomRole,
} from "@/lib/permissions";
import {
  createRoomActivity,
  publishRoomActivity,
  revokeUserTokens,
} from "@/lib/join-requests";
import { sendActivityPush } from "@/lib/activity-push";

const roleSchema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });

async function contextFor(roomId: string, actorId: string, targetId: string) {
  return prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      code: true,
      name: true,
      ownerId: true,
      roomMembers: {
        where: { userId: { in: [actorId, targetId] } },
        select: {
          id: true,
          userId: true,
          role: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ roomId: string; userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roomId, userId } = await context.params;
  const room = await contextFor(roomId, session.user.id, userId);
  if (!room)
    return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const actor = room.roomMembers.find(
    (member) => member.userId === session.user.id,
  );
  const target = room.roomMembers.find((member) => member.userId === userId);
  if (!actor || !target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  const actorRole = effectiveRoomRole(room.ownerId, actor.userId, actor.role);
  const targetRole = effectiveRoomRole(
    room.ownerId,
    target.userId,
    target.role,
  );
  if (!canRemoveMember(actorRole, targetRole)) {
    return NextResponse.json(
      { error: "You do not have permission to remove this member." },
      { status: 403 },
    );
  }

  await prisma.roomMember.delete({ where: { id: target.id } });
  const activity = createRoomActivity({
    type: "member.removed",
    room: { id: room.id, code: room.code, name: room.name },
    actor: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    subject: target.user,
    subjectRole: targetRole,
  });
  await publishRoomActivity(activity, [target.userId]);
  await revokeUserTokens(target.userId);
  await sendActivityPush([target.userId], activity);
  return NextResponse.json({ action: "removed", userId });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string; userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid room role." }, { status: 400 });
  }
  const { roomId, userId } = await context.params;
  const room = await contextFor(roomId, session.user.id, userId);
  if (!room)
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const actor = room.roomMembers.find(
    (member) => member.userId === session.user.id,
  );
  const target = room.roomMembers.find((member) => member.userId === userId);
  if (!actor || !target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  const actorRole = effectiveRoomRole(room.ownerId, actor.userId, actor.role);
  const targetRole = effectiveRoomRole(
    room.ownerId,
    target.userId,
    target.role,
  );
  const nextRole = parsed.data.role as PersistedRoomRole;
  const idempotentAdminRetry =
    targetRole === nextRole && actorRole !== "MEMBER";
  if (
    !canChangeRole(actorRole, targetRole, nextRole) &&
    !idempotentAdminRetry
  ) {
    return NextResponse.json(
      { error: "You do not have permission to change this role." },
      { status: 403 },
    );
  }

  if (targetRole !== nextRole) {
    await prisma.roomMember.update({
      where: { id: target.id },
      data: { role: nextRole },
    });
  }
  const activity = createRoomActivity({
    type: nextRole === "ADMIN" ? "member.promoted" : "member.demoted",
    room: { id: room.id, code: room.code, name: room.name },
    actor: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    subject: target.user,
    subjectRole: nextRole,
  });
  await publishRoomActivity(activity, [target.userId]);
  await sendActivityPush([target.userId], activity);
  return NextResponse.json({ action: "role-updated", userId, role: nextRole });
}
