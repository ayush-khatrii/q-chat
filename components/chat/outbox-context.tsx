"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";
import type { MessageMetadata } from "@ably/chat";

export type OutboxMessage = {
  id: string;
  roomId: string;
  roomCode: string;
  text: string;
  metadata: MessageMetadata;
  attachmentIds: string[];
  createdAt: number;
  status: "queued" | "sending" | "failed";
  error?: string;
};

type NewOutboxMessage = Omit<
  OutboxMessage,
  "id" | "createdAt" | "status" | "error"
>;

type OutboxContextValue = {
  messages: OutboxMessage[];
  enqueue: (message: NewOutboxMessage) => string;
  markSending: (id: string) => void;
  markFailed: (id: string, error: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
};

const OutboxContext = createContext<OutboxContextValue | null>(null);

export function ChatOutboxProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const previousUserId = useRef<string | null | undefined>(undefined);
  const [messages, setMessages] = useState<OutboxMessage[]>([]);

  useEffect(() => {
    if (isPending) return;
    if (
      previousUserId.current !== undefined &&
      previousUserId.current !== userId
    ) {
      setMessages([]);
    }
    previousUserId.current = userId;
  }, [isPending, userId]);

  const patch = useCallback(
    (id: string, change: Partial<OutboxMessage>) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, ...change } : message,
        ),
      ),
    [],
  );

  const value = useMemo<OutboxContextValue>(
    () => ({
      messages,
      enqueue: (message) => {
        const id = crypto.randomUUID();
        setMessages((current) => [
          ...current,
          {
            ...message,
            metadata: { ...message.metadata, clientMessageId: id },
            id,
            createdAt: Date.now(),
            status: "queued",
          },
        ]);
        return id;
      },
      markSending: (id) => patch(id, { status: "sending", error: undefined }),
      markFailed: (id, error) => patch(id, { status: "failed", error }),
      retry: (id) => patch(id, { status: "queued", error: undefined }),
      remove: (id) =>
        setMessages((current) =>
          current.filter((message) => message.id !== id),
        ),
    }),
    [messages, patch],
  );

  return (
    <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>
  );
}

export function useChatOutbox(roomId?: string) {
  const context = useContext(OutboxContext);
  if (!context) throw new Error("useChatOutbox requires ChatOutboxProvider");
  return {
    ...context,
    messages: roomId
      ? context.messages.filter((message) => message.roomId === roomId)
      : context.messages,
  };
}
