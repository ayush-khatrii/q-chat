"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

import {
  ChatMessageAction,
  ChatMessageEventType,
  type ChatMessageEvent,
  type Message as AblyMessage,
} from "@ably/chat";
import { useMessages, useTyping } from "@ably/chat/react";

import { authClient } from "@/lib/auth-client";
import { initFcm } from "@/lib/fcm";
import type { UserRoomMember } from "@/lib/rooms";

type ChatProps = {
  roomCode: string;
  members: UserRoomMember[];
};

type MessageMetadata = {
  displayName?: string;
  image?: string;
};

type MessageGroup = {
  senderId: string;
  messages: AblyMessage[];
};

function getInitials(name: string): string {
  const initials = name
    .split(/\s|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return initials || "?";
}

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

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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
            message.serial === event.message.serial
              ? event.message
              : message,
          ),
        );
      }
    },
  });

  useEffect(() => {
    if (!historyBeforeSubscribe) return;

    setLoadingHistory(true);

    historyBeforeSubscribe({ limit: 20 })
      .then((page) => {
        setMessages(page.items);
        setHasMore(!page.isLast());
        historyPageRef.current = page;
      })
      .catch((error) => {
        console.error("Error loading message history:", error);
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [historyBeforeSubscribe]);

  const loadMore = useCallback(async () => {
    if (!historyPageRef.current || !hasMore || loadingHistory) return;

    setLoadingHistory(true);

    try {
      const nextPage = await historyPageRef.current.next();

      if (!nextPage) return;

      setMessages((previous) => [...nextPage.items, ...previous]);
      setHasMore(!nextPage.isLast());
      historyPageRef.current = nextPage;
    } catch (error) {
      console.error("Error loading older messages:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [hasMore, loadingHistory]);

  useEffect(() => {
    const userId = currentUser?.id;

    if (userId) {
      void initFcm(userId);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void loadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore]);

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

  /*
   * Consecutive messages from the same client are combined into one group.
   * A new group is created only when the sender changes.
   */
  const messageGroups = useMemo<MessageGroup[]>(() => {
    return sortedMessages.reduce<MessageGroup[]>((groups, message) => {
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.senderId === message.clientId) {
        lastGroup.messages.push(message);
      } else {
        groups.push({
          senderId: message.clientId,
          messages: [message],
        });
      }

      return groups;
    }, []);
  }, [sortedMessages]);

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

  const handleEditMessage = useCallback((_message: AblyMessage) => {
    toast.info("Edit feature coming soon!");
  }, []);

  const handleCopyMessage = useCallback(async (message: AblyMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy message");
    }
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;

    setDraft(value);

    if (value.trim()) {
      void keystroke().catch((error) => {
        console.error("Error starting typing:", error);
      });
    } else {
      void stop().catch((error) => {
        console.error("Error stopping typing:", error);
      });
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

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
    } catch (error) {
      console.error("Unable to send message:", error);

      setDraft(text);
      setSendError(
        error instanceof Error ? error.message : "Unable to send message.",
      );

      return;
    }

    void stop().catch((error) => {
      console.error("Error stopping typing:", error);
    });

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
      }).catch((error) => {
        console.error("Notification request failed:", error);
      });

      void initFcm(currentUser.id);
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full min-w-0 max-w-5xl flex-1 flex-col overflow-hidden bg-background">
      <ScrollArea
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
          aria-label="Chat messages"
          className="mx-auto flex w-full min-w-0 flex-col gap-6 px-3 py-4 sm:px-5 sm:py-6"
        >
          <div ref={sentinelRef} className="h-px w-full" />

          {loadingHistory && (
            <div className="flex w-full justify-center py-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                Loading older messages…
              </span>
            </div>
          )}

          {messageGroups.map((group) => {
            const firstMessage = group.messages[0];
            const lastMessage = group.messages[group.messages.length - 1];

            const sender = members.find(
              (member) => member.userId === group.senderId,
            )?.user;

            const metadata = getMessageMetadata(firstMessage);
            const isMe = group.senderId === currentUser?.id;

            const senderName = isMe
              ? currentUser?.name ??
              currentUser?.email ??
              metadata.displayName ??
              "You"
              : sender?.name ??
              sender?.email ??
              metadata.displayName ??
              group.senderId ??
              "Unknown user";

            const senderImage = isMe
              ? currentUser?.image ?? metadata.image
              : sender?.image ?? metadata.image;

            return (
              <article
                key={`${group.senderId}-${firstMessage.serial}`}
                className={[
                  "flex w-full min-w-0",
                  isMe ? "justify-end" : "justify-start",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex min-w-0 max-w-[88%] flex-col gap-2",
                    "sm:max-w-[78%] md:max-w-[72%] lg:max-w-[68%]",
                    isMe ? "items-end" : "items-start",
                  ].join(" ")}
                >
                  {/* Sender identity is rendered once per group */}
                  <div
                    className={[
                      "flex max-w-full min-w-0 items-center gap-2 px-1",
                      isMe ? "flex-row-reverse" : "flex-row",
                    ].join(" ")}
                  >
                    <Avatar className="size-7 shrink-0 border border-border/70">
                      <AvatarImage
                        src={senderImage ?? undefined}
                        alt={senderName}
                      />
                      <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                        {getInitials(senderName)}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className="flex min-w-0 items-center gap-2 text-xs"
                    >
                      <span className="min-w-0 truncate font-semibold text-foreground">
                        {senderName}
                      </span>

                      <span
                        aria-hidden="true"
                        className="shrink-0 text-border"
                      >
                        |
                      </span>

                      <time
                        dateTime={lastMessage.timestamp.toISOString()}
                        title={`From ${formatTime(firstMessage.timestamp)} to ${formatTime(lastMessage.timestamp)}`}
                        className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground"
                      >
                        {formatTime(lastMessage.timestamp)}
                      </time>
                    </div>
                  </div>

                  {/* Consecutive messages are rendered together */}
                  <div
                    className={[
                      "flex max-w-full flex-col gap-1",
                      isMe ? "items-end" : "items-start",
                    ].join(" ")}
                  >
                    {group.messages.map((message, index) => {
                      const isDeleted =
                        message.action === ChatMessageAction.MessageDelete;

                      const isFirst = index === 0;
                      const isLast = index === group.messages.length - 1;

                      const bubble = (
                        <div
                          className={[
                            "w-fit max-w-full overflow-hidden px-4 py-2.5 shadow-sm",
                            "ring-1 ring-inset ring-black/5 dark:ring-white/5",
                            isDeleted
                              ? "rounded-2xl bg-muted/60 text-muted-foreground"
                              : isMe
                                ? [
                                  "bg-primary text-primary-foreground",
                                  "rounded-2xl",
                                  !isFirst && "rounded-tr-md",
                                  !isLast && "rounded-br-md",
                                ]
                                  .filter(Boolean)
                                  .join(" ")
                                : [
                                  "bg-muted text-foreground",
                                  "rounded-2xl",
                                  !isFirst && "rounded-tl-md",
                                  !isLast && "rounded-bl-md",
                                ]
                                  .filter(Boolean)
                                  .join(" "),
                            !isDeleted && isMe ? "cursor-context-menu" : "",
                          ].join(" ")}
                        >
                          <p
                            className={[
                              "max-w-full whitespace-pre-wrap text-sm leading-6",
                              "break-words [overflow-wrap:anywhere]",
                              isDeleted
                                ? "select-none italic opacity-70"
                                : "",
                            ].join(" ")}
                          >
                            {isDeleted
                              ? `Message deleted by ${senderName}`
                              : message.text}
                          </p>
                        </div>
                      );

                      return !isDeleted && isMe ? (
                        <ContextMenu key={message.serial}>
                          <ContextMenuTrigger asChild>
                            {bubble}
                          </ContextMenuTrigger>

                          <ContextMenuContent className="w-40">
                            <ContextMenuItem
                              onClick={() => handleCopyMessage(message)}
                            >
                              <Copy className="mr-2 size-4" />
                              Copy
                            </ContextMenuItem>

                            <ContextMenuItem
                              onClick={() => handleEditMessage(message)}
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </ContextMenuItem>

                            <ContextMenuSeparator />

                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => handleDeleteMessage(message)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ) : (
                        <div key={message.serial}>{bubble}</div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </ScrollArea>

      <div className="shrink-0">
        {sendError && (
          <p
            role="alert"
            className="px-4 pb-2 text-xs font-medium text-destructive"
          >
            {sendError}
          </p>
        )}

        {typingText && (
          <div
            role="status"
            aria-live="polite"
            className="px-4 pb-2 text-xs text-muted-foreground"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1.5">
              <span className="flex items-center gap-1">
                <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1 animate-bounce rounded-full bg-muted-foreground" />
              </span>
              {typingText}
            </span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4"
        >
          <div className="mx-auto flex w-full min-w-0 items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={draft}
              rows={1}
              placeholder="Type something…"
              aria-label="Message"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                void stop().catch((error) => {
                  console.error("Error stopping typing:", error);
                });
              }}
              className="
                max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto
                rounded-2xl border-border bg-muted/40 px-4 py-3 text-sm
                leading-5 shadow-none focus-visible:ring-1
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

          <p className="mt-1.5 hidden px-2 text-[10px] text-muted-foreground sm:block">
            Press Enter to send · Shift + Enter for a new line
          </p>
        </form>
      </div>
    </div>
  );
}