import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import prisma from "@/lib/prisma";
import type { RoomActivity } from "@/lib/room-activity";

function messageFor(event: RoomActivity) {
  const actor = event.actor.name ?? event.actor.email;
  switch (event.type) {
    case "join.requested":
      return {
        title: `Join request for ${event.room.name}`,
        body: `${actor} wants to join.`,
      };
    case "join.approved":
      return {
        title: "Join request approved",
        body: `You can now enter ${event.room.name}.`,
      };
    case "join.rejected":
      return {
        title: "Join request declined",
        body: `Your request for ${event.room.name} was declined.`,
      };
    case "member.removed":
      return {
        title: "Removed from room",
        body: `You were removed from ${event.room.name}.`,
      };
    case "member.promoted":
      return {
        title: "You are now an admin",
        body: `Your role changed in ${event.room.name}.`,
      };
    case "member.demoted":
      return {
        title: "Room role changed",
        body: `Your role changed in ${event.room.name}.`,
      };
    case "room.deleted":
      return { title: "Room deleted", body: `${event.room.name} was deleted.` };
    default:
      return null;
  }
}

export async function sendActivityPush(userIds: string[], event: RoomActivity) {
  try {
    const copy = messageFor(event);
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!copy || !projectId || !clientEmail || !privateKey || !userIds.length)
      return;
    if (!getApps().length) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
    const tokens = await prisma.fcmToken.findMany({
      where: { userId: { in: [...new Set(userIds)] } },
      select: { token: true },
    });
    if (!tokens.length) return;
    await getMessaging().sendEachForMulticast({
      tokens: tokens.map(({ token }) => token),
      data: {
        ...copy,
        type: "room_activity",
        roomCode: event.room.code,
        activityId: event.id,
      },
      android: { priority: "high" },
    });
  } catch (error) {
    console.error("Room activity push failed", {
      type: error instanceof Error ? error.name : "Unknown",
    });
  }
}
