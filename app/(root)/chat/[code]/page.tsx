import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Chat from "@/components/Chat";
import AblyRoom from "@/components/chat/AblyRoom";
import RoomHeader from "@/components/chat/RoomHeader";
import RoomSkeleton from "@/components/chat/RoomSkeleton";
import AppAblyProvider from "@/providers/AblyProvider";
import { auth } from "@/lib/auth";
import { getRoomForMember } from "@/lib/room-service";
import { normalizeCustomRoomCode } from "@/lib/rooms";

type RoomPageProps = {
  params: Promise<{ code: string }>;
};

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <RoomContent params={params} />
    </Suspense>
  );
}

async function RoomContent({ params }: RoomPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  const { code } = await params;
  const normalizedCode = normalizeCustomRoomCode(decodeURIComponent(code));

  if (!normalizedCode) {
    notFound();
  }

  const room = await getRoomForMember(normalizedCode, session.user.id);

  if (!room) {
    notFound();
  }

  return (
    <AppAblyProvider authenticated>
      <AblyRoom roomName={`qchat:${room.code}`}>
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <RoomHeader room={room} members={room.members} />
          <Chat
            roomId={room.id}
            roomCode={room.code}
            members={room.members}
            initialTheme={room.theme}
          />
        </div>
      </AblyRoom>
    </AppAblyProvider>
  );
}
