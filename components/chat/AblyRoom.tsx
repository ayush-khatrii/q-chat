"use client";

import type { ReactNode } from "react";
import { ChatRoomProvider } from "@ably/chat/react";

type AblyRoomProps = {
  roomName: string;
  children: ReactNode;
};

export default function AblyRoom({ roomName, children }: AblyRoomProps) {
  return <ChatRoomProvider name={roomName}>{children}</ChatRoomProvider>;
}
