import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ContentFallback from "@/components/ContentFallback";
import MyProfile from "@/components/profile/MyProfile";
import { auth } from "@/lib/auth";

export default function MyProfilePage() {
  return (
    <Suspense fallback={<ContentFallback />}>
      <AuthenticatedProfile />
    </Suspense>
  );
}

async function AuthenticatedProfile() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  return <MyProfile />;
}
