import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMyProfileData } from "@/lib/profile-data";

// GET /api/me/profile
// Returns the signed-in user's rooms, split into rooms they created
// and rooms they only joined.
export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getMyProfileData(session.user.id));
}
