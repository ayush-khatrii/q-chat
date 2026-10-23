"use client";

import type { ReactNode } from "react";
import { AblyProvider as RealtimeProvider } from "ably/react";
import { MessageReactionType } from "@ably/chat";
import { ChatClientProvider, ChatRoomProvider } from "@ably/chat/react";
import { useAblyConnection } from "@/providers/AblyProvider";

type AblyRoomProps = {
  roomName: string;
  children: ReactNode;
};

export default function AblyRoom({ roomName, children }: AblyRoomProps) {
  const connection = useAblyConnection();
  if (!connection) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Connecting chat">
        <div className="flex flex-1 flex-col justify-end gap-3 px-4 py-5">
          <div className="h-11 w-40 animate-pulse rounded-2xl bg-muted/70" />
          <div className="ml-auto h-11 w-48 animate-pulse rounded-2xl bg-muted/70" />
        </div>
        <div className="border-t p-3">
          <div className="mx-auto flex max-w-5xl gap-2">
            <div className="h-11 flex-1 animate-pulse rounded-2xl bg-muted/70" />
            <div className="size-11 animate-pulse rounded-full bg-muted/70" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <RealtimeProvider client={connection.realtimeClient}>
      <ChatClientProvider client={connection.chatClient}>
        <ChatRoomProvider
          name={roomName}
          options={{
            messages: { defaultMessageReactionType: MessageReactionType.Distinct },
          }}
        >
          {children}
        </ChatRoomProvider>
      </ChatClientProvider>
    </RealtimeProvider>
  );
}
