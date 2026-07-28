import * as Ably from "ably";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  ownerRequestEventsChannel,
  userRequestStatusChannel,
} from "@/lib/room-events";

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

    const memberships = await prisma.roomMember.findMany({
      where: {
        userId: session.user.id,
        status: "APPROVED",
      },
      select: {
        room: {
          select: { code: true },
        },
      },
    });

    const capabilities: Record<string, string[]> = {
      [userRequestStatusChannel(session.user.id)]: ["subscribe"],
      [ownerRequestEventsChannel(session.user.id)]: ["subscribe"],
    };

    for (const membership of memberships) {
      capabilities[`qchat:${membership.room.code}::$chat`] = [
        "publish",
        "subscribe",
        "history",
        "presence",
        "message-delete-own",
      ];
    }

    const client = new Ably.Rest(apiKey);

    const tokenRequestData = await client.auth.createTokenRequest({
      clientId: session.user.id,
      capability: JSON.stringify(capabilities),
    });

    return NextResponse.json(tokenRequestData);
  } catch (error) {
    console.error("Ably Auth Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
