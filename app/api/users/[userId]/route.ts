import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserProfileData } from "@/lib/profile-data";

// GET /api/users/:userId
// Returns a public profile for a user, plus the rooms they share with
// the currently signed-in viewer (so we can show "rooms joined with me").
export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

  const data = await getUserProfileData(userId, session.user.id);
  if (!data) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  return NextResponse.json(data);
}
