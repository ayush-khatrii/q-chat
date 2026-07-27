import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await req.json();

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  await prisma.fcmToken.upsert({
    where: { token },
    update: { userId: session.user.id },
    create: { userId: session.user.id, token },
  });
  return NextResponse.json({ success: true });
}
