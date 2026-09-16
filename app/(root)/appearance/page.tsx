import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ChatAppearanceSettings from "@/components/chat/ChatAppearanceSettings";
import ContentFallback from "@/components/ContentFallback";
import { auth } from "@/lib/auth";

export default function AppearancePage() {
  return (
    <Suspense fallback={<ContentFallback />}>
      <AuthenticatedAppearance />
    </Suspense>
  );
}

async function AuthenticatedAppearance() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/");
  }

  return <ChatAppearanceSettings />;
}
