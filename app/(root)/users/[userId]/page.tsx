import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UserProfile from "@/components/profile/UserProfile";
import { auth } from "@/lib/auth";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  const { userId } = await params;

  return <UserProfile userId={userId} />;
}
