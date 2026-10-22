import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import RoomStart from "@/components/rooms/RoomStart";
import { auth } from "@/lib/auth";
import ChatLoading from "./loading";

export default function Page() {
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatHome />
    </Suspense>
  );
}

async function ChatHome() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  return <RoomStart userId={session.user.id} />;
}
