import { privateInbox } from "@/lib/whispers";
import * as Ably from "ably";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canModerateRequests, effectiveRoomRole } from "@/lib/permissions";
import { readReceiptChannel } from "@/lib/read-receipts";
import {
  roomActivityChannel,
  roomJoinRequestChannel,
  userActivityChannel,
} from "@/lib/room-activity";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey) {
      return new NextResponse("Ably API key is not configured", {
        status: 500,
      });
    }

    const client = new Ably.Rest(apiKey);
    const memberships = await prisma.roomMember.findMany({
      where: { userId: session.user.id },
      select: {
        roomId: true,
        role: true,
        room: { select: { code: true, ownerId: true } },
      },
    });

    const tokenRequestData = await client.auth.createTokenRequest({
      clientId: session.user.id,
      ttl: 60_000,
      capability: JSON.stringify({
        ...Object.fromEntries(
          memberships.map(({ room }) => [
            `qchat:${room.code}::$chat`,
            [
              "publish",
              "subscribe",
              "presence",
              "history",
              "channel-metadata",
              "annotation-publish",
              "annotation-subscribe",
              "message-update-own",
              "message-delete-own",
            ],
          ]),
        ),
        ...Object.fromEntries(
          memberships.map(({ roomId }) => [
            readReceiptChannel(roomId),
            ["subscribe", "publish"],
          ]),
        ),
        ...Object.fromEntries(
          memberships.map(({ roomId }) => [
            roomActivityChannel(roomId),
            ["subscribe", "history"],
          ]),
        ),
        ...Object.fromEntries(
          memberships
            .filter(({ role, room }) =>
              canModerateRequests(
                effectiveRoomRole(room.ownerId, session.user.id, role),
              ),
            )
            .map(({ roomId }) => [
              roomJoinRequestChannel(roomId),
              ["subscribe", "history"],
            ]),
        ),
        [`${privateInbox(session.user.id)}::$chat`]: [
          "subscribe",
          "history",
          "channel-metadata",
        ],
        [userActivityChannel(session.user.id)]: ["subscribe", "history"],
      }),
    });

    return NextResponse.json(tokenRequestData, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Ably Auth Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
