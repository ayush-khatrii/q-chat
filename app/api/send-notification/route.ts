import prisma from "@/lib/prisma";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { NextResponse } from "next/server";

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
    const { roomCode, senderId, title, body } = await req.json();

    if (!roomCode || !senderId || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Find the room and get all member IDs except the sender
    const room = await prisma.room.findUnique({
      where: { code: roomCode },
      select: {
        roomMembers: {
          where: { userId: { not: senderId } },
          select: { userId: true },
        },
      },
    });

    if (!room || room.roomMembers.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Get FCM tokens for all other members
    const memberIds = room.roomMembers.map((m) => m.userId);
    const tokens = await prisma.fcmToken.findMany({
      where: { userId: { in: memberIds } },
    });

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Send notification to all tokens
    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title, body },
    });

    console.log("📨 FCM batch result:", {
      successCount: result.successCount,
      failureCount: result.failureCount,
    });

    // Log individual failures for debugging
    result.responses.forEach((resp, i) => {
      if (!resp.success) {
        console.error(`❌ FCM token ${tokens[i].userId} failed:`, resp.error?.code, resp.error?.message);
      }
    });

    return NextResponse.json({
      success: true,
      sent: result.successCount,
      failed: result.failureCount,
    });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
}