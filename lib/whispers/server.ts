import "server-only";
import { createHash } from "node:crypto";
import { ChatClient, OrderBy } from "@ably/chat";
import { Realtime } from "ably";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { privateInbox, parseWhisper } from "@/lib/whispers";
export class WhisperError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function whisperUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new WhisperError("Sign in to send a whisper.", 401);
  const base = process.env.APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!base || request.headers.get("origin") !== new URL(base).origin)
    throw new WhisperError("Invalid request origin.", 403);
  return session.user;
}
export async function whisperChat<T>(
  userId: string,
  run: (chat: ChatClient) => Promise<T>,
) {
  if (!process.env.ABLY_API_KEY)
    throw new WhisperError("Private Space is unavailable.", 503);
  const realtime = new Realtime({
    key: process.env.ABLY_API_KEY,
    clientId: userId,
    autoConnect: false,
  });
  const chat = new ChatClient(realtime, { idempotentRestPublishing: true });
  try {
    return await run(chat);
  } finally {
    await chat.dispose();
    realtime.close();
  }
}
export async function deliverWhispers(
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  },
  roomId: string,
  recipients: string[],
  text: string,
  clientMessageId: string,
  context = "",
) {
  return whisperChat(user.id, async (chat) =>
    Promise.all(
      recipients.map(async (recipientId) => {
        try {
          const id = createHash("sha256")
            .update(
              JSON.stringify([
                user.id,
                roomId,
                recipientId,
                clientMessageId,
                context,
              ]),
            )
            .digest("hex");
          await prisma.$transaction(
            async (tx) => {
              // Serialize retries across server instances without adding persistent tables.
              await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
              const memberships = await tx.roomMember.findMany({
                where: { roomId, userId: { in: [user.id, recipientId] } },
                include: { room: true },
              });
              if (recipientId === user.id || memberships.length !== 2)
                throw new WhisperError(
                  "You and the recipient must still belong to this room.",
                  403,
                );
              const inbox = await chat.rooms.get(privateInbox(recipientId));
              let page = await inbox.messages.history({
                limit: 1000,
                orderBy: OrderBy.NewestFirst,
              });
              for (;;) {
                const existing = page.items
                  .map(parseWhisper)
                  .find((message) => message?.id === id);
                if (existing) {
                  if (existing.text !== text)
                    throw new WhisperError(
                      "This draft was already sent with different text.",
                      409,
                    );
                  return;
                }
                if (!page.hasNext()) break;
                const next = await page.next();
                if (!next) break;
                page = next;
              }
              const room = memberships[0].room;
              await inbox.messages.send({
                text,
                metadata: {
                  kind: "whisper",
                  id,
                  sender: {
                    id: user.id,
                    name: user.name ?? user.email,
                    image: user.image ?? null,
                  },
                  room: { id: room.id, name: room.name, code: room.code },
                },
              });
            },
            { timeout: 60000, maxWait: 10000 },
          );
          return { recipientId, delivered: true };
        } catch (error) {
          return {
            recipientId,
            delivered: false,
            error:
              error instanceof WhisperError
                ? error.message
                : "Delivery failed. Retry this recipient.",
          };
        }
      }),
    ),
  );
}
export function whisperError(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof WhisperError
          ? error.message
          : "Unable to process this whisper. Please retry.",
    },
    {
      status: error instanceof WhisperError ? error.status : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function whisperBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new WhisperError("A message is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 48000) {
      await reader.cancel();
      throw new WhisperError("Message is too large.", 413);
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
