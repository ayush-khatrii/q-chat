import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const readReceiptSchema = z.object({
  messageSerial: z.string().trim().min(1).max(512),
  readAt: z.string().datetime().optional(),
});

async function getRoomMembership(roomId: string, userId: string) {
  return prisma.roomMember.findUnique({
    where: { userId_roomId: { userId, roomId } },
    select: { id: true },
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
  const membership = await getRoomMembership(roomId, session.user.id);

  if (!membership) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const receipts = await prisma.messageRead.findMany({
    where: {
      roomId,
      readerId: { not: session.user.id },
    },
    select: { messageSerial: true, readAt: true },
  });

  return NextResponse.json(
    {
      receipts: receipts.map((receipt) => ({
        messageSerial: receipt.messageSerial,
        readAt: receipt.readAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
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

  const { roomId } = await context.params;
  const membership = await getRoomMembership(roomId, session.user.id);

  if (!membership) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = readReceiptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid message serial is required." },
      { status: 400 },
    );
  }

  const receipt = await prisma.messageRead.upsert({
    where: {
      roomId_messageSerial_readerId: {
        roomId,
        messageSerial: parsed.data.messageSerial,
        readerId: session.user.id,
      },
    },
    create: {
      roomId,
      messageSerial: parsed.data.messageSerial,
      readerId: session.user.id,
      readAt: parsed.data.readAt ? new Date(Math.min(Date.parse(parsed.data.readAt), Date.now())) : undefined,
    },
    update: {},
    select: { messageSerial: true, readAt: true },
  });

  const event = {
    messageSerial: receipt.messageSerial,
    readAt: receipt.readAt.toISOString(),
    readerId: session.user.id,
  };

  return NextResponse.json(event);
}
