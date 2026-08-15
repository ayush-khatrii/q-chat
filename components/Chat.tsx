"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

function getInitials(name: string) {
  return (
    name
      .split(/\s|@/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
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

function formatTime(value: Date) {
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
        console.error("Error loading history:", error);
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
    if (currentUser?.id) {
      void initFcm(currentUser.id);
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
          className="flex w-full min-w-0 flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6"
        >
          <div ref={sentinelRef} className="h-px w-full" />

          {loadingHistory && (
            <div className="flex justify-center py-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                Loading older messages…
              </span>
            </div>
          )}

          {sortedMessages.map((message) => {
            const sender = members.find(
              (member) => member.userId === message.clientId,
            )?.user;

            const metadata = getMessageMetadata(message);
            const isMe = message.clientId === currentUser?.id;

            const senderName = isMe
              ? currentUser?.name ??
              currentUser?.email ??
              metadata.displayName ??
              "You"
              : sender?.name ??
              sender?.email ??
              metadata.displayName ??
              message.clientId ??
              "Unknown user";

            const senderImage = isMe
              ? currentUser?.image ?? metadata.image
              : sender?.image ?? metadata.image;

            return (
              <article
                key={message.serial}
                className={[
                  "flex w-full min-w-0",
                  isMe ? "justify-end" : "justify-start",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex min-w-0 flex-col gap-2",
                    "max-w-[88%] sm:max-w-[78%] md:max-w-[72%] lg:max-w-[68%]",
                    isMe ? "items-end" : "items-start",
                  ].join(" ")}
                >
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

                    <div className="flex min-w-0 max-w-full items-center gap-2 text-[10px] sm:text-xs">
                      {isMe ? (
                        <span className="min-w-0 truncate font-semibold">
                          {senderName}
                        </span>
                      ) : (
                        <Link
                          href={`/users/${message.clientId}`}
                          className="min-w-0 truncate font-semibold hover:text-primary hover:underline"
                        >
                          {senderName}
                        </Link>
                      )}

                      <span className="shrink-0 text-border">|</span>

                      <time
                        dateTime={message.timestamp.toISOString()}
                        className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground"
                      >
                        {formatTime(message.timestamp)}
                      </time>
                    </div>
                  </div>

                  <div
                    className={[
                      "flex w-full min-w-0 flex-col gap-1",
                      isMe ? "items-end" : "items-start",
                    ].join(" ")}
                  >
                    {[message].map((message) => {
                      const isDeleted =
                        message.action === ChatMessageAction.MessageDelete;

                      const bubble = (
                        <div
                          className={[
                            "inline-block min-w-0 max-w-full overflow-hidden",
                            "px-4 py-2.5 shadow-sm",
                            "ring-1 ring-inset ring-black/5 dark:ring-white/5",
                            isDeleted
                              ? "rounded-2xl bg-muted/60 text-muted-foreground"
                              : isMe
                                ? [
                                  "bg-primary text-primary-foreground",
                                  "rounded-2xl",
                                  "rounded-br-md",
                                ]
                                  .filter(Boolean)
                                  .join(" ")
                                : [
                                  "bg-muted text-foreground",
                                  "rounded-2xl",
                                  "rounded-bl-md",
                                ]
                                  .filter(Boolean)
                                  .join(" "),
                          ].join(" ")}
                        >
                          <p
                            className={[
                              "m-0 max-w-full whitespace-pre-wrap text-sm leading-6",
                              "overflow-hidden break-words",
                              "[overflow-wrap:anywhere]",
                              "[word-break:break-word]",
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

                      if (!isDeleted && isMe) {
                        return (
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
                                onClick={() => handleEditMessage()}
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
                        );
                      }

                      return (
                        <div key={message.serial} className="min-w-0 max-w-full">
                          {bubble}
                        </div>
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
          <p className="px-4 pb-2 text-xs text-destructive">{sendError}</p>
        )}

        {typingText && (
          <div className="px-4 pb-2 text-xs text-muted-foreground">
            {typingText}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur sm:px-4"
        >
          <div className="flex w-full min-w-0 items-end gap-2">
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
