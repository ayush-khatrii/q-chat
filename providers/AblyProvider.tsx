"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import * as Ably from "ably";
import { AblyProvider as RealtimeProvider } from "ably/react";
import { ChatClient, LogLevel } from "@ably/chat";
import { ChatClientProvider } from "@ably/chat/react";
import { authClient } from "@/lib/auth-client"; // import the auth client

type AppAblyProviderProps = {
  children: ReactNode;
};

const apiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;

export default function AppAblyProvider({ children }: AppAblyProviderProps) {
  const {
    data: session,
    isPending, //loading state
    error, //error object
    refetch, //refetch the session
  } = authClient.useSession();

  const userId = session?.user.id;
  const ABLY_CLIENT_ID = userId ?? "anonymous";

  const MISSING_ABLY_KEY_PLACEHOLDER = "missing:missing";

  const { realtimeClient, chatClient } = useMemo(() => {
    const realtimeClient = new Ably.Realtime({
      key: apiKey ?? MISSING_ABLY_KEY_PLACEHOLDER,
      clientId: ABLY_CLIENT_ID,
      autoConnect: Boolean(apiKey),
    });

    const chatClient = new ChatClient(realtimeClient, {
      logLevel: LogLevel.Info,
    });

    return { realtimeClient, chatClient };
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) {
      console.error("Missing NEXT_PUBLIC_ABLY_API_KEY environment variable.");
    }

    return () => {
      void chatClient.dispose();
      realtimeClient.close();
    };
  }, [apiKey, chatClient, realtimeClient]);

  return (
    <RealtimeProvider client={realtimeClient}>
      <ChatClientProvider client={chatClient}>{children}</ChatClientProvider>
    </RealtimeProvider>
  );
}
