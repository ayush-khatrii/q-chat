"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

import {
  ChatMessageEventType,
  type ChatMessageEvent,
  type Message as AblyMessage,
} from "@ably/chat";
import { useMessages, useTyping } from "@ably/chat/react";

import { authClient } from "@/lib/auth-client";
import { initFcm } from "@/lib/fcm";
import {
  getRoomThemeStyle,
  useRoomTheme,
} from "@/components/chat/chat-appearance";
import { ChatBubbleMessage } from "@/components/chat/ChatBubbleMessage";
import type { RoomTheme, UserRoomMember } from "@/lib/rooms";

type ChatProps = {
  roomId: string;
  roomCode: string;
  members: UserRoomMember[];
  initialTheme: RoomTheme;
};

type MessageMetadata = {
  displayName?: string;
  image?: string;
};

function getMessageMetadata(message: AblyMessage): MessageMetadata {
  if (!message.metadata || typeof message.metadata !== "object") {
    return {};
  }

  const metadata = message.metadata as Record<string, unknown>;

  return {
    displayName:
      typeof metadata.displayName === "string"
        ? metadata.displayName
        : undefined,
    image: typeof metadata.image === "string" ? metadata.image : undefined,
  };
}

type ReadReceipt = {
  messageSerial: string;
  readAt: string;
};

export default function Chat({
  roomId,
  roomCode,
  members,
  initialTheme,
}: ChatProps) {
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;
  const { theme } = useRoomTheme(roomId, initialTheme);

  const { currentTypers, keystroke, stop } = useTyping();

  const [messages, setMessages] = useState<AblyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({});
  const [isPageVisible, setIsPageVisible] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const loadingHistoryRef = useRef(false);
  const initialHistoryRequestRef = useRef<unknown>(undefined);
  const readRequestsRef = useRef(new Set<string>());
  const scrollAdjustmentRef = useRef<
    { type: "bottom" } | { type: "preserve"; previousHeight: number } | null
  >(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyPageRef = useRef<any>(null);

  const { sendMessage, historyBeforeSubscribe, deleteMessage } = useMessages({
    listener: (event: ChatMessageEvent) => {
      if (event.type === ChatMessageEventType.Created) {
        setMessages((previous) => {
          if (
            previous.some((message) => message.serial === event.message.serial)
          ) {
            return previous;
          }

          return [...previous, event.message];
        });
      }

      if (event.type === ChatMessageEventType.Deleted) {
        setMessages((previous) =>
          previous.map((message) =>
            message.serial === event.message.serial ? event.message : message,
          ),
        );
      }
    },
  });

  const getScrollViewport = useCallback(
    () =>
      scrollAreaRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      ) ?? null,
    [],
  );

  const refreshReadReceipts = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      const response = await fetch(`/api/rooms/${roomId}/reads`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) return;

      const payload = (await response.json()) as { receipts: ReadReceipt[] };
      setReadReceipts(
        Object.fromEntries(
          payload.receipts.map((receipt) => [
            receipt.messageSerial,
            receipt.readAt,
          ]),
        ),
      );
    } catch (error) {
      console.error("Error loading read receipts:", error);
    }
  }, [currentUser?.id, roomId]);

  const handleMessageRead = useCallback(
    async (messageSerial: string) => {
      if (!currentUser?.id || readRequestsRef.current.has(messageSerial)) {
        return;
      }

      readRequestsRef.current.add(messageSerial);

      try {
        const response = await fetch(`/api/rooms/${roomId}/reads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ messageSerial }),
        });

        if (!response.ok) {
          throw new Error("Unable to save read receipt.");
        }
      } catch (error) {
        readRequestsRef.current.delete(messageSerial);
        console.error("Error saving read receipt:", error);
      }
    },
    [currentUser?.id, roomId],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    readRequestsRef.current.clear();
    setReadReceipts({});
    void refreshReadReceipts();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshReadReceipts();
      }
    }, 4_000);

    const handleFocus = () => void refreshReadReceipts();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentUser?.id, refreshReadReceipts]);

  useEffect(() => {
    if (
      !historyBeforeSubscribe ||
      initialHistoryRequestRef.current === historyBeforeSubscribe
    ) {
      return;
    }

    initialHistoryRequestRef.current = historyBeforeSubscribe;
    loadingHistoryRef.current = true;
    setLoadingHistory(true);
    setHistoryError(null);

    historyBeforeSubscribe({ limit: 20 })
      .then((page) => {
        // Realtime events can arrive while history is in flight. Merge instead of
        // replacing state so a newly received message is never briefly discarded.
        setMessages((current) => {
          const bySerial = new Map(
            current.map((message) => [message.serial, message]),
          );

          for (const message of page.items) {
            bySerial.set(message.serial, message);
          }

          return Array.from(bySerial.values());
        });
        setHasMore(!page.isLast());
        historyPageRef.current = page;
        scrollAdjustmentRef.current = { type: "bottom" };
        setHistoryLoaded(true);
      })
      .catch((error) => {
        console.error("Error loading history:", error);
        setHistoryError("Messages could not be loaded. Please try again.");
        initialHistoryRequestRef.current = undefined;
      })
      .finally(() => {
        loadingHistoryRef.current = false;
        setLoadingHistory(false);
      });
  }, [historyBeforeSubscribe, historyRetry]);

  const loadMore = useCallback(async () => {
    if (!historyPageRef.current || !hasMore || loadingHistoryRef.current) {
      return;
    }

    loadingHistoryRef.current = true;
    setLoadingHistory(true);
    setHistoryError(null);

    const viewport = getScrollViewport();
    const previousHeight = viewport?.scrollHeight;

    try {
      const nextPage = await historyPageRef.current.next();

      if (!nextPage) return;

      setMessages((previous) => [...nextPage.items, ...previous]);
      setHasMore(!nextPage.isLast());
      historyPageRef.current = nextPage;

      if (previousHeight !== undefined) {
        scrollAdjustmentRef.current = {
          type: "preserve",
          previousHeight,
        };
      }
    } catch (error) {
      console.error("Error loading older messages:", error);
      setHistoryError("Older messages could not be loaded. Please try again.");
    } finally {
      loadingHistoryRef.current = false;
      setLoadingHistory(false);
    }
  }, [getScrollViewport, hasMore]);

  useEffect(() => {
    if (currentUser?.id) {
      void initFcm(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const viewport = getScrollViewport();

    if (!viewport) return;

    const handleScroll = () => {
      // Only paginate a genuinely scrollable conversation. A permanently visible
      // top sentinel used to request every history page immediately on room load.
      if (
        viewport.scrollHeight > viewport.clientHeight &&
        viewport.scrollTop <= 80
      ) {
        void loadMore();
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [getScrollViewport, loadMore]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (first, second) =>
          first.timestamp.getTime() - second.timestamp.getTime(),
      ),
    [messages],
  );

  useLayoutEffect(() => {
    const adjustment = scrollAdjustmentRef.current;
    const viewport = getScrollViewport();

    if (!adjustment || !viewport) return;

    if (adjustment.type === "bottom") {
      viewport.scrollTop = viewport.scrollHeight;
    } else {
      viewport.scrollTop += viewport.scrollHeight - adjustment.previousHeight;
    }

    scrollAdjustmentRef.current = null;
  }, [getScrollViewport, messages]);

  const typingUsers = useMemo(
    () =>
      Array.from(currentTypers)
        .filter((typer) => typer.clientId !== currentUser?.id)
        .map((typer) => {
          const member = members.find(
            (item) => item.userId === typer.clientId,
          )?.user;

          return member?.name ?? member?.email ?? typer.clientId;
        }),
    [currentTypers, currentUser?.id, members],
  );

  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing…`
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
        : typingUsers.length > 2
          ? `${typingUsers[0]} and ${typingUsers.length - 1} others are typing…`
          : null;

  const handleCopyMessage = useCallback(async (message: AblyMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy message");
    }
  }, []);

  const handleDeleteMessage = useCallback(
    async (message: AblyMessage) => {
      try {
        await deleteMessage(message.serial, {
          description: "Deleted by user",
        });

        toast.success("Message deleted");
      } catch (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete message");
      }
    },
    [deleteMessage],
  );

  const handleEditMessage = useCallback(() => {
    toast.info("Edit feature coming soon!");
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;

    setDraft(value);

    if (value.trim()) {
      void keystroke().catch(console.error);
    } else {
      void stop().catch(console.error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = draft.trim();

    if (!text) return;

    setDraft("");
    setSendError(null);

    try {
      await sendMessage({
        text,
        metadata: {
          displayName: currentUser?.name ?? currentUser?.email ?? "User",
          image: currentUser?.image ?? "",
        },
      });
    } catch (error) {
      setDraft(text);
      setSendError(
        error instanceof Error ? error.message : "Unable to send message.",
      );
      return;
    }

    void stop().catch(console.error);

    if (currentUser?.id) {
      void fetch("/api/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomCode,
          senderId: currentUser.id,
          title: currentUser.name ?? currentUser.email ?? "Someone",
          body: text,
        }),
      }).catch(console.error);

      void initFcm(currentUser.id);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      style={getRoomThemeStyle(theme)}
    >
      <ScrollArea
        ref={scrollAreaRef}
        className="
          min-h-0 min-w-0 flex-1 overflow-hidden
          [&_[data-radix-scroll-area-viewport]]:overflow-x-hidden
          [&_[data-radix-scroll-area-viewport]>div]:!block
          [&_[data-radix-scroll-area-viewport]>div]:!w-full
          [&_[data-radix-scroll-area-viewport]>div]:!min-w-0
        "
      >
        <div
          role="log"
          aria-live="polite"
          className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6"
        >
          {hasMore && !loadingHistory && (
            <div className="flex justify-center py-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void loadMore()}
                className="rounded-full text-xs"
              >
                Load older messages
              </Button>
            </div>
          )}

          {loadingHistory && (
            <div className="flex justify-center py-2">
              <span
                role="status"
                className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
              >
                {historyLoaded
                  ? "Loading older messages…"
                  : "Loading messages…"}
              </span>
            </div>
          )}

          {historyError && !loadingHistory && (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-xs text-destructive">{historyError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (historyLoaded) {
                    void loadMore();
                  } else {
                    initialHistoryRequestRef.current = undefined;
                    setHistoryRetry((value) => value + 1);
                  }
                }}
              >
                Try again
              </Button>
            </div>
          )}

          {sortedMessages.map((message) => {
            const sender = members.find(
              (member) => member.userId === message.clientId,
            )?.user;

            const metadata = getMessageMetadata(message);
            const isMe = message.clientId === currentUser?.id;

            const senderName = isMe
              ? (currentUser?.name ??
                currentUser?.email ??
                metadata.displayName ??
                "You")
              : (sender?.name ??
                sender?.email ??
                metadata.displayName ??
                message.clientId ??
                "Unknown user");

            const senderImage = isMe
              ? (currentUser?.image ?? metadata.image)
              : (sender?.image ?? metadata.image);

            return (
              <ChatBubbleMessage
                key={message.serial}
                message={message}
                senderName={senderName}
                senderImage={senderImage}
                isMe={isMe}
                isPageVisible={isPageVisible && Boolean(currentUser?.id)}
                readAt={isMe ? readReceipts[message.serial] : undefined}
                onRead={handleMessageRead}
                onCopy={(item) => void handleCopyMessage(item)}
                onDelete={(item) => void handleDeleteMessage(item)}
                onEdit={handleEditMessage}
              />
            );
          })}
        </div>
      </ScrollArea>

      <div className="shrink-0">
        {sendError && (
          <p className="px-4 pb-2 text-xs text-destructive">{sendError}</p>
        )}

        {typingText && (
          <div className="px-4 pb-2 text-xs text-muted-foreground">
            {typingText}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border-t border-white/10 bg-black/15 px-3 py-3 backdrop-blur-md sm:px-4"
        >
          <div className="mx-auto flex w-full max-w-5xl min-w-0 items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={draft}
              rows={1}
              placeholder="Type something…"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => void stop().catch(console.error)}
              className="
                min-h-11 min-w-0 flex-1 resize-none
                rounded-2xl border-border bg-muted/40 px-4 py-3
                text-sm leading-5 shadow-none focus-visible:ring-1
                [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
              "
            />

            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="size-11 shrink-0 rounded-full"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
