import prisma from "@/lib/prisma";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

function getFirebaseMessaging() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getMessaging();
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomCode, body } = await req.json();

    if (!roomCode || typeof body !== "string") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Find the room and get all member IDs except the sender
    const room = await prisma.room.findFirst({
      where: {
        code: roomCode,
        OR: [
          { ownerId: session.user.id },
          {
            roomMembers: {
              some: {
                userId: session.user.id,
                status: "APPROVED",
              },
            },
          },
        ],
      },
      select: {
        roomMembers: {
          where: {
            status: "APPROVED",
            userId: { not: session.user.id },
          },
          select: { userId: true },
        },
      },
    });

    const title = session.user.name ?? session.user.email;
    console.log("📨 Notification request", { roomCode, senderId: session.user.id, title, body });
    console.log("📨 Room lookup result", room?.roomMembers?.length ?? 0);

    if (!room || room.roomMembers.length === 0) {
      console.log("📨 No room members found for this room/code");
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Get FCM tokens for all other members
    const memberIds = room.roomMembers.map((m) => m.userId);
    console.log("📨 Member IDs", memberIds);

    const tokens = await prisma.fcmToken.findMany({
      where: { userId: { in: memberIds } },
    });

    console.log("📨 Token count", tokens.length);

    if (tokens.length === 0) {
      console.log("📨 No FCM tokens saved for these room members");
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Send notification to all tokens — use data-only so SW handles display
    // (no "notification" field, or Firebase auto-displays + SW = double notification)
    const result = await getFirebaseMessaging().sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      data: {
        title,
        body,
        roomCode,
        type: "room_message",
      },
      android: {
        priority: "high",
      },
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
