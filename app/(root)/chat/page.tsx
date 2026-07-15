import { headers } from "next/headers";
import { redirect } from "next/navigation";
import RoomStart from "@/components/rooms/RoomStart";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  const membership = await prisma.roomMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "desc" },
    select: {
      room: {
        select: { code: true },
      },
    },
  });

  if (membership) {
    redirect(`/chat/${membership.room.code}`);
  }

  return <RoomStart userId={session.user.id} />;
}
