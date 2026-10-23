"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as Ably from "ably";
import { ChatClient, LogLevel } from "@ably/chat";
import { authClient } from "@/lib/auth-client";
import { WhisperProvider } from "@/components/whisper-context";
import { RoomActivityProvider } from "@/components/room-activity-context";

type AblyClients = {
  userId: string;
  realtimeClient: Ably.Realtime;
  chatClient: ChatClient;
};

type AblyConnection = AblyClients & {
  ready: true;
};

const AblyConnectionContext = createContext<AblyConnection | null>(null);

export function useAblyConnection() {
  return useContext(AblyConnectionContext);
}

export function useAblyReady() {
  return useAblyConnection() !== null;
}

export default function AppAblyProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [clients, setClients] = useState<AblyClients | null>(null);

  useEffect(() => {
    setClients(null);
    if (!userId) return;

    const realtimeClient = new Ably.Realtime({ authUrl: "/api/ably/auth" });
    const chatClient = new ChatClient(realtimeClient, {
      logLevel: LogLevel.Info,
      idempotentRestPublishing: true,
    });
    setClients({ userId, realtimeClient, chatClient });

    return () => {
      void chatClient.dispose().finally(() => realtimeClient.close());
    };
  }, [userId]);

  useEffect(() => {
    if (!clients) return;
    const refresh = () => {
      void clients.realtimeClient.auth.authorize().catch(() => {});
    };
    const interval = window.setInterval(refresh, 45_000);
    window.addEventListener("qchat:membership-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("qchat:membership-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [clients]);

  const connection = useMemo<AblyConnection | null>(
    () => (clients?.userId === userId ? { ...clients, ready: true } : null),
    [clients, userId],
  );

  return (
    <AblyConnectionContext.Provider value={connection}>
      <RoomActivityProvider
        realtimeClient={connection?.realtimeClient ?? null}
        userId={userId}
      >
        <WhisperProvider
          userId={userId}
          chatClient={connection?.chatClient ?? null}
          realtimeClient={connection?.realtimeClient ?? null}
        >
          {children}
        </WhisperProvider>
      </RoomActivityProvider>
    </AblyConnectionContext.Provider>
  );
}
