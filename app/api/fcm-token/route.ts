import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const tokenSchema = z.object({ token: z.string().min(20).max(4_096) });

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = tokenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification token." },
      { status: 400 },
    );
  }
  await prisma.fcmToken.upsert({
    where: { token: parsed.data.token },
    update: { userId: session.user.id },
    create: { userId: session.user.id, token: parsed.data.token },
  });
  return NextResponse.json({ success: true });
}
