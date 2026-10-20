import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ATTACHMENT_CONFIG } from "@/constants/attachments";
import { z } from "zod";

export class AttachmentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function attachmentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new AttachmentError("Unauthorized.", 401);
  if (request.method !== "GET") {
    const appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL;
    if (!appUrl) throw new AttachmentError("APP_URL is not configured.", 503);
    if (request.headers.get("origin") !== new URL(appUrl).origin)
      throw new AttachmentError("Invalid request origin.", 403);
  }
  // Atomic upsert works across multiple serverless instances.
  const minute = Math.floor(Date.now() / 60_000);
  const limit = await prisma.attachmentRateLimit.upsert({
    where: { key: `${session.user.id}:${minute}` },
    create: {
      key: `${session.user.id}:${minute}`,
      expiresAt: new Date((minute + 2) * 60_000),
    },
    update: { count: { increment: 1 } },
  });
  if (limit.count > ATTACHMENT_CONFIG.maxRequestsPerMinute)
    throw new AttachmentError(
      "Too many attachment requests. Try again shortly.",
      429,
    );
  return session.user;
}

export async function requireRoom(roomId: string, userId: string) {
  const member = await prisma.roomMember.findUnique({
    where: { userId_roomId: { roomId, userId } },
    include: { room: { select: { code: true } } },
  });
  if (!member) throw new AttachmentError("Room not found.", 404);
  return member.room;
}

export async function jsonBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AttachmentError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > ATTACHMENT_CONFIG.maxRequestBytes) {
      await reader.cancel();
      throw new AttachmentError("Request is too large.", 413);
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(body);
  } catch {
    throw new AttachmentError("Invalid JSON.");
  }
}

export function attachmentResponseError(error: unknown) {
  if (error instanceof AttachmentError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: "Invalid attachment request." },
      { status: 400 },
    );
  if (error instanceof Error && /not configured/.test(error.message))
    return NextResponse.json({ error: error.message }, { status: 503 });
  // SDK error objects can contain signed URLs. Do not log them.
  console.error("Attachment operation failed", {
    type: error instanceof Error ? error.name : "Unknown",
  });
  return NextResponse.json(
    { error: "Attachment operation failed. Please retry." },
    { status: 500 },
  );
}

export const privateJson = (body: unknown) =>
  NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
  });
