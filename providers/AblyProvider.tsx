"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import * as Ably from "ably";
import { AblyProvider as RealtimeProvider } from "ably/react";
import { ChatClient, LogLevel } from "@ably/chat";
import { ChatClientProvider } from "@ably/chat/react";
import { authClient } from "@/lib/auth-client";

type AppAblyProviderProps = {
  children: ReactNode;
};

// 1. The Main Gatekeeper Provider
export default function AppAblyProvider({ children }: AppAblyProviderProps) {
  const { data: session, isPending } = authClient.useSession();

  // If better-auth is still checking the session, show nothing (or a spinner)
  if (isPending) {
    return null;
  }

  // If the user isn't logged in, don't initialize Ably at all.
  // Just render the app normally.
  if (!session) {
    return <>{children}</>;
  }

  // If we have a session, mount the real Ably clients safely
  return <AblyConnectedProvider>{children}</AblyConnectedProvider>;
}

// 2. The Clean Realtime Client Initializer
function AblyConnectedProvider({ children }: { children: ReactNode }) {
  const disposeTimer = useRef<number | null>(null);
  const { realtimeClient, chatClient } = useMemo(() => {
    const realtime = new Ably.Realtime({
      authUrl: "/api/ably/auth",
    });

    const chat = new ChatClient(realtime, {
      logLevel: LogLevel.Info,
    });

    return { realtimeClient: realtime, chatClient: chat };
  }, []);

  useEffect(() => {
    if (disposeTimer.current !== null) {
      window.clearTimeout(disposeTimer.current);
      disposeTimer.current = null;
    }

    return () => {
      disposeTimer.current = window.setTimeout(() => {
        void chatClient.dispose().finally(() => realtimeClient.close());
      }, 0);
    };
  }, [chatClient, realtimeClient]);

  return (
    <RealtimeProvider client={realtimeClient}>
      <ChatClientProvider client={chatClient}>{children}</ChatClientProvider>
    </RealtimeProvider>
  );
}
