import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ContentFallback from "@/components/ContentFallback";
import UserProfile from "@/components/profile/UserProfile";
import { auth } from "@/lib/auth";

type UserProfilePageProps = {
  params: Promise<{ userId: string }>;
};

export default function UserProfilePage({ params }: UserProfilePageProps) {
  return (
    <Suspense fallback={<ContentFallback />}>
      <AuthenticatedUserProfile params={params} />
    </Suspense>
  );
}

async function AuthenticatedUserProfile({ params }: UserProfilePageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  const { userId } = await params;

  return <UserProfile userId={userId} />;
}
