import Chat from "@/components/Chat";
import RoomHeader from "@/components/chat/RoomHeader";
import { mockChatRoomResponse } from "@/constants";

const page = () => {
  const { room, members, messages } = mockChatRoomResponse;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <RoomHeader room={room} members={members} />
      <Chat messages={messages} currentUserId={room.ownerId} />
    </div>
  );
};

export default page;
