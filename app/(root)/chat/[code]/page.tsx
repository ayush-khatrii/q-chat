import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Chat from "@/components/Chat";
import AblyRoom from "@/components/chat/AblyRoom";
import RoomHeader from "@/components/chat/RoomHeader";
import { auth } from "@/lib/auth";
import { getRoomForMember } from "@/lib/room-service";
import { normalizeCustomRoomCode } from "@/lib/rooms";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
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
    <AblyRoom roomName={`qchat:${room.code}`}>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <RoomHeader room={room} members={room.members} />
        <Chat members={room.members} />
      </div>
    </AblyRoom>
  );
}
