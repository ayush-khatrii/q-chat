import { auth } from "@/lib/auth";
import { notificationPreview } from "@/lib/message-replies";
import prisma from "@/lib/prisma";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { NextResponse } from "next/server";
import { z } from "zod";

const notificationSchema = z.object({
  roomCode: z.string().trim().min(1).max(32),
  body: z.string().max(4_000).default(""),
  kind: z.enum(["message", "reply"]).default("message"),
});

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL;
    if (!appUrl)
      return NextResponse.json(
        { error: "APP_URL is not configured" },
        { status: 503 },
      );
    if (req.headers.get("origin") !== new URL(appUrl).origin)
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 },
      );

    const parsed = notificationSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid notification request" },
        { status: 400 },
      );

    const { roomCode, body, kind } = parsed.data;
    const room = await prisma.room.findFirst({
      where: {
        code: roomCode,
        roomMembers: { some: { userId: session.user.id } },
      },
      select: {
        roomMembers: {
          where: { userId: { not: session.user.id } },
          select: { userId: true },
        },
      },
    });

    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (room.roomMembers.length === 0)
      return NextResponse.json({ success: true, sent: 0 });

    const tokens = await prisma.fcmToken.findMany({
      where: {
        userId: { in: room.roomMembers.map((member) => member.userId) },
      },
    });
    if (tokens.length === 0)
      return NextResponse.json({ success: true, sent: 0 });

    const senderName = session.user.name ?? session.user.email ?? "Someone";
    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.map((token) => token.token),
      data: {
        title: kind === "reply" ? `${senderName} replied` : senderName,
        body: notificationPreview(body),
        roomCode,
        type: kind === "reply" ? "room_reply" : "room_message",
      },
      android: { priority: "high" },
    });

    if (result.failureCount)
      console.error("Some chat notifications failed", {
        failed: result.failureCount,
        sent: result.successCount,
      });

    return NextResponse.json({
      success: true,
      sent: result.successCount,
      failed: result.failureCount,
    });
  } catch (error) {
    console.error("Send notification error", {
      type: error instanceof Error ? error.name : "Unknown",
    });
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
}
