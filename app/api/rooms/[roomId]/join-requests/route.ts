import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MAX_ROOM_MEMBERS } from "@/lib/rooms";
import { canModerateRequests, effectiveRoomRole } from "@/lib/permissions";
import {
  createRoomActivity,
  getJoinRequestResolution,
  publishRoomActivity,
  verifyJoinRequestTicket,
} from "@/lib/join-requests";
import { sendActivityPush } from "@/lib/activity-push";

const decisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  ticket: z.string().min(20).max(2_000),
});

class RoomFullError extends Error {}

function isTransactionConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2034",
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid request decision." },
      { status: 400 },
    );
  }
  const claims = verifyJoinRequestTicket(body.data.ticket);
  const { roomId } = await context.params;
  if (!claims || claims.roomId !== roomId) {
    return NextResponse.json(
      { error: "This join request is invalid or has expired." },
      { status: 410 },
    );
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      code: true,
      name: true,
      ownerId: true,
      roomMembers: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  const actorMembership = room.roomMembers[0];
  const actorRole = actorMembership
    ? effectiveRoomRole(room.ownerId, session.user.id, actorMembership.role)
    : null;
  if (!actorRole || !canModerateRequests(actorRole)) {
    return NextResponse.json(
      { error: "Only room admins can decide join requests." },
      { status: 403 },
    );
  }

  const priorDecision = await getJoinRequestResolution(
    roomId,
    claims.requestId,
    claims.createdAt,
  );
  if (priorDecision) {
    const priorAction =
      priorDecision.type === "join.approved" ? "approve" : "reject";
    if (priorAction !== body.data.action) {
      return NextResponse.json(
        { error: "This join request has already been decided." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      action: priorAction === "approve" ? "approved" : "rejected",
      room: priorDecision.room,
      userId: claims.userId,
    });
  }

  const subject = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!subject) {
    return NextResponse.json(
      { error: "Requester not found." },
      { status: 404 },
    );
  }

  if (body.data.action === "approve") {
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await prisma.$transaction(
            async (transaction) => {
              const existing = await transaction.roomMember.findUnique({
                where: { userId_roomId: { userId: claims.userId, roomId } },
                select: { id: true },
              });
              if (existing) return;
              const count = await transaction.roomMember.count({
                where: { roomId },
              });
              if (count >= MAX_ROOM_MEMBERS) throw new RoomFullError();
              await transaction.roomMember.create({
                data: { roomId, userId: claims.userId, role: "MEMBER" },
              });
            },
            { isolationLevel: "Serializable" },
          );
          break;
        } catch (error) {
          if (isTransactionConflict(error) && attempt < 2) continue;
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof RoomFullError) {
        return NextResponse.json(
          { error: "This room is full." },
          { status: 409 },
        );
      }
      throw error;
    }
  }

  const activity = createRoomActivity({
    id: claims.requestId,
    type: body.data.action === "approve" ? "join.approved" : "join.rejected",
    room: { id: room.id, code: room.code, name: room.name },
    actor: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    subject,
    subjectRole: body.data.action === "approve" ? "MEMBER" : undefined,
    request: { id: claims.requestId, ticket: body.data.ticket },
  });
  await publishRoomActivity(activity, [claims.userId]);
  await sendActivityPush([claims.userId], activity);
  if (body.data.action === "approve") {
    await publishRoomActivity(
      createRoomActivity({
        type: "member.joined",
        room: activity.room,
        actor: subject,
        subjectRole: "MEMBER",
      }),
    );
  }

  return NextResponse.json({
    action: body.data.action === "approve" ? "approved" : "rejected",
    room: activity.room,
    userId: claims.userId,
  });
}
