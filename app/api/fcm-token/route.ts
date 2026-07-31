import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId, token } = await req.json();
  await prisma.fcmToken.upsert({
    where: { token },
    update: { userId },
    create: { userId, token },
  });
  return NextResponse.json({ success: true });
}