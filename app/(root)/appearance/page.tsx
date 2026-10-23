import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ChatAppearanceSettings from "@/components/chat/ChatAppearanceSettings";
import { auth } from "@/lib/auth";

export default async function AppearancePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/");
  }

  return <ChatAppearanceSettings />;
}
