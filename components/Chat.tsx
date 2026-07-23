"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { Marker, MarkerContent } from "@/components/ui/marker"

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { initFcm } from "@/lib/fcm";
import type { UserRoomMember } from "@/lib/rooms";
import {
  ChatMessageEventType,
  type ChatMessageEvent,
  type Message as AblyMessage,
} from "@ably/chat";
import { useMessages, useTyping } from "@ably/chat/react";

type ChatProps = {
  roomCode: string;
  members: UserRoomMember[];
};


type ReplyLength = "very-short" | "short" | "medium" | "long" | null;

function getReplyLength(value: string): ReplyLength {
  const text = value.trim();

  if (!text) return null;

  const wordCount = text.split(/\s+/).length;

  if (wordCount <= 2) return "very-short";
  if (wordCount <= 6) return "short";
  if (wordCount <= 15) return "medium";

  return "long";
}

function getInitials(name: string): string {
  return name
    .split(/\s|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default function Chat({ roomCode, members }: ChatProps) {
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;
  const { currentTypers, keystroke, stop } = useTyping();

  const [messages, setMessages] = useState<AblyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Stores the Ably PaginatedResult — acts as our built-in cursor/cache
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyPageRef = useRef<any>(null);

  // This is the entire "receive messages" setup — straight from Ably's docs.
  const { sendMessage, historyBeforeSubscribe } = useMessages({
    listener: (event: ChatMessageEvent) => {
      if (event.type === ChatMessageEventType.Created) {
        setMessages((prev) => [...prev, event.message]);
      }
    },
  });

  // 📜 Load message history when the component mounts
  useEffect(() => {
    if (!historyBeforeSubscribe) return;

    setLoadingHistory(true);
    historyBeforeSubscribe({ limit: 20 })
      .then((page) => {
        setMessages(page.items);
        setHasMore(!page.isLast());
        historyPageRef.current = page;
      })
      .catch((err) => console.error("Error loading history:", err))
      .finally(() => setLoadingHistory(false));
  }, [historyBeforeSubscribe]);

  // 📜 Load older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!historyPageRef.current || !hasMore || loadingHistory) return;
    setLoadingHistory(true);
    try {
      const nextPage = await historyPageRef.current.next();
      if (!nextPage) return;
      setMessages((prev) => [...nextPage.items, ...prev]);
      setHasMore(!nextPage.isLast());
      historyPageRef.current = nextPage;
    } catch (err) {
      console.error("Error loading more history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [hasMore, loadingHistory]);

  // �🔔 Register FCM on mount (belt-and-suspenders alongside NotificationInit in layout)
  useEffect(() => {
    const userId = currentUser?.id;
    console.log("🔔 Chat useEffect FCM check:", { userId: !!userId });
    if (userId) {
      console.log("🔔 Chat: triggering FCM registration for", userId);
      initFcm(userId).then((ok) => {
        console.log("🔔 Chat: FCM registration result:", ok);
      });
    }
  }, [currentUser?.id]);

  // 👁️ Infinite scroll: observe sentinel to load older messages
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const text = draft.trim();
    if (!text) return;

    setSendError(null);
    setDraft("");

    try {
      await sendMessage({
        text,
        metadata: {
          displayName: currentUser?.name ?? currentUser?.email ?? "User",
          image: currentUser?.image ?? "",
        },
      });
      console.log("✅ Chat: Ably sendMessage succeeded");
    } catch (error) {
      console.error("❌ Chat: Ably sendMessage FAILED:", error);
      setDraft(text);
      setSendError(
        error instanceof Error ? error.message : "Unable to send message.",
      );
      return;
    }

    void stop().catch((error) => {
      console.error("Error stopping typing", error);
    });

    // Send push notification to other room members (MUST run — don't block on FCM)
    console.log("📤 Chat: about to send notification, currentUser.id:", currentUser?.id);
    if (currentUser?.id) {
      // Fire notification immediately — do NOT await initFcm (it can hang on SW ready)
      console.log("🔔 Sending push notification to room:", roomCode);
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          senderId: currentUser.id,
          title: currentUser.name ?? currentUser.email ?? "Someone",
          body: text,
        }),
      })
        .then((r) => {
          console.log("🔔 Notification fetch response status:", r.status);
          return r.json();
        })
        .then((data) => console.log("🔔 Notification API response:", data))
        .catch((err) => console.error("❌ Notification fetch error:", err));

      // FCM registration as fire-and-forget (don't block notification sending)
      initFcm(currentUser.id).then((ok) => {
        console.log("🔔 Chat: FCM registration result:", ok);
      });
    } else {
      console.warn("⚠️ Chat: skipping notification — no currentUser.id");
    }
  };

  // Group consecutive messages from the same sender
  const groups = messages
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .reduce<AblyMessage[][]>((acc, msg) => {
      const last = acc[acc.length - 1];
      if (last && last[0].clientId === msg.clientId) {
        last.push(msg);
      } else {
        acc.push([msg]);
      }
      return acc;
    }, []);

  // current typing...
  const typingUsers = Array.from(currentTypers)
    .filter((typer) => typer.clientId !== currentUser?.id)
    .map((typer) => {
      const member = members.find(
        (item) => item.userId === typer.clientId,
      )?.user;

      return member?.name ?? member?.email ?? typer.clientId;
    });

  function getTypingText(name: string, length: ReplyLength) {
    if (!length) return null;
    const labels = {
      "very-short": "a quick reply",
      short: "a short reply",
      medium: "a medium reply",
      long: "a long reply",
    };
    return `${name} is writing ${labels[length]}…`;
  }

  const typingText =
    typingUsers.length === 1
      ? getTypingText(typingUsers[0], getReplyLength(draft))
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
        : typingUsers.length > 2
          ? `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`
          : null;

  const handleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const newValue = e.target.value;

    setDraft(newValue);

    if (newValue.trim().length > 0) {
      void keystroke().catch((error) => {
        console.error("Error starting typing", error);
      });
    } else {
      void stop().catch((error) => {
        console.error("Error stopping typing", error);
      });
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {/* Sentinel: when this scrolls into view, load older messages */}
        <div ref={sentinelRef} className="h-1" />
        {loadingHistory && (
          <p className="text-center text-xs text-muted-foreground py-2">
            Loading older messages…
          </p>
        )}
        {groups.map((group) => {
          const senderId = group[0].clientId;
          const sender = members.find((m) => m.userId === senderId)?.user;
          const isMe = senderId === currentUser?.id;
          const senderName = sender?.name ?? sender?.email ?? senderId;
          const senderImage = isMe ? currentUser?.image : sender?.image;

          return (
            <MessageGroup key={group[0].serial}>
              {group.map((msg, idx) => (
                <Message key={msg.serial} align={isMe ? "end" : "start"}>
                  <MessageContent>
                    {idx === 0 && (
                      <MessageHeader>
                        <Avatar className="size-6 mr-2">
                          <AvatarImage src={senderImage ?? undefined} alt={senderName} />
                          <AvatarFallback>
                            {getInitials(senderName)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{senderName}</span>
                      </MessageHeader>
                    )}
                    <Bubble
                      variant={isMe ? "tinted" : "muted"}
                      align={isMe ? "end" : "start"}
                    >
                      <BubbleContent className="whitespace-pre-wrap">
                        {msg.text}
                      </BubbleContent>
                    </Bubble>
                    <MessageFooter>
                      <time dateTime={msg.timestamp.toISOString()}>
                        {formatTime(msg.timestamp)}
                      </time>
                    </MessageFooter>
                  </MessageContent>
                </Message>
              ))}
            </MessageGroup>
          );
        })}
      </div>

      {sendError && (
        <p className="px-4 pb-2 text-xs text-destructive">{sendError}</p>
      )}

      {/* <div className="min-h-6 px-4 pb-1">
        {typingText && (
          <p className="text-sm text-muted-foreground">
            {typingText}
          </p>
        )}
      </div> */}
      <Marker role="status" className="p-4">
        <MarkerContent className="shimmer">
          {typingText && (
            <p className="text-xs text-muted-foreground">
              {typingText}
            </p>
          )}
        </MarkerContent>
      </Marker>
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 border-t px-4 py-3"
      >
        <div className="mx-auto flex w-full max-w-5xl items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={handleChange}
            onBlur={() => {
              void stop().catch((error) => {
                console.error("Error stopping typing", error);
              });
            }}
            rows={1}
            placeholder="Type something..."
            className="min-h-11 resize-none rounded-xl"
          />
          <Button type="submit" size="icon-lg" disabled={!draft.trim()}>
            <Send />
          </Button>
        </div>
      </form>
    </div>
  );
}
