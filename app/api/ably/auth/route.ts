import * as Ably from "ably";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const apiKey =
      process.env.ABLY_API_KEY ?? process.env.NEXT_PUBLIC_ABLY_API_KEY;

    if (!apiKey) {
      return new NextResponse("Ably API key is not configured", {
        status: 500,
      });
    }

    const client = new Ably.Rest(apiKey);

    const tokenRequestData = await client.auth.createTokenRequest({
      clientId: session.user.id,
      capability: JSON.stringify({
        "qchat:*": ["*"],
      }),
    });

    return NextResponse.json(tokenRequestData);
  } catch (error) {
    console.error("Ably Auth Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
