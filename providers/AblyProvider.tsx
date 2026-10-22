"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import * as Ably from "ably";
import { AblyProvider as RealtimeProvider } from "ably/react";
import { ChatClient, LogLevel } from "@ably/chat";
import { ChatClientProvider } from "@ably/chat/react";
import { authClient } from "@/lib/auth-client";
import { RoomActivityProvider } from "@/components/room-activity-context";

type AppAblyProviderProps = {
  children: ReactNode;
};

const AblyReadyContext = createContext(false);

export function useAblyReady() {
  return useContext(AblyReadyContext);
}

// 1. The Main Gatekeeper Provider
export default function AppAblyProvider({ children }: AppAblyProviderProps) {
  return <SessionAwareAblyProvider>{children}</SessionAwareAblyProvider>;
}

function SessionAwareAblyProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  if (!session?.user.id) {
    return <AblyReadyContext.Provider value={false}>{children}</AblyReadyContext.Provider>;
  }
  return <AblyConnectedProvider userId={session.user.id}>{children}</AblyConnectedProvider>;
}

// 2. The Clean Realtime Client Initializer
function AblyConnectedProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId?: string;
}) {
  const [clients, setClients] = useState<{
    realtimeClient: Ably.Realtime;
    chatClient: ChatClient;
  } | null>(null);

  useEffect(() => {
    const realtime = new Ably.Realtime({
      authUrl: "/api/ably/auth",
    });

    const chat = new ChatClient(realtime, {
      logLevel: LogLevel.Info,
      idempotentRestPublishing: true,
    });

    setClients({ realtimeClient: realtime, chatClient: chat });
    return () => {
      void chat.dispose().finally(() => realtime.close());
    };
  }, []);

  if (!clients) {
    return <AblyReadyContext.Provider value={false}>{children}</AblyReadyContext.Provider>;
  }

  return <ConnectedClients clients={clients} userId={userId}>{children}</ConnectedClients>;
}

function ConnectedClients({
  clients: { realtimeClient, chatClient },
  children,
  userId,
}: {
  clients: { realtimeClient: Ably.Realtime; chatClient: ChatClient };
  children: ReactNode;
  userId?: string;
}) {
  useEffect(() => {
    const refresh = () => {
      void realtimeClient.auth.authorize().catch(() => {});
    };
    // Server checks membership on every refresh. A removed member's old token
    // expires within one minute; attachment URLs require membership immediately.
    const interval = window.setInterval(refresh, 45_000);
    window.addEventListener("qchat:membership-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("qchat:membership-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [realtimeClient]);

  return (
    <RealtimeProvider client={realtimeClient}>
      <ChatClientProvider client={chatClient}>
        <AblyReadyContext.Provider value={true}>
          {userId ? (
            <RoomActivityProvider client={realtimeClient} userId={userId}>
              {children}
            </RoomActivityProvider>
          ) : (
            children
          )}
        </AblyReadyContext.Provider>
      </ChatClientProvider>
    </RealtimeProvider>
  );
}
