"use client";

import { useEffect } from "react";
import { MessageAttachments } from "@/components/chat/MessageAttachments";
import Link from "next/link";
import {
  Ban,
  CheckIcon,
  CheckCheckIcon,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react";
import { useInView } from "react-intersection-observer";

import { ChatMessageAction, type Message as AblyMessage } from "@ably/chat";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleReactions } from "@/components/ui/bubble";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type ChatBubbleMessageProps = {
  roomId: string;
  message: AblyMessage;
  senderName: string;
  senderImage?: string | null;
  isMe: boolean;
  isPageVisible: boolean;
  readAt?: string;
  onRead: (messageSerial: string) => Promise<boolean>;
  onCopy: (message: AblyMessage) => void;
  onDelete: (message: AblyMessage) => void;
  onEdit: (message: AblyMessage) => void;
  currentUserId?: string;
  onReact: (message: AblyMessage, emoji: string) => void;
  reactionPending: Set<string>;
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

function formatMessageTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function formatReadTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ChatBubbleMessage({
  roomId,
  message,
  senderName,
  senderImage,
  isMe,
  isPageVisible,
  readAt,
  onRead,
  onCopy,
  onDelete,
  onEdit,
  currentUserId,
  onReact,
  reactionPending,
}: ChatBubbleMessageProps) {
  const { ref, inView } = useInView({
    threshold: 0.1,
  });
  const isDeleted = message.action === ChatMessageAction.MessageDelete;
  const reactions = Object.entries(message.reactions?.distinct ?? {}).filter(
    ([, summary]) => summary.total > 0,
  );
  const hasReactions = !isDeleted && reactions.length > 0;

  useEffect(() => {
    if (isMe || isDeleted || !inView || !isPageVisible) return;

    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const saveRead = async () => {
      const saved = await onRead(message.serial);
      if (!saved && !cancelled) {
        retry = setTimeout(() => void saveRead(), 4_000);
      }
    };
    void saveRead();

    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [inView, isDeleted, isMe, isPageVisible, message.serial, onRead]);

  const content = (
    <BubbleContent
      className={
        isDeleted
          ? "flex cursor-not-allowed select-none items-center gap-1.5 italic opacity-40"
          : undefined
      }
      aria-disabled={isDeleted || undefined}
      tabIndex={isDeleted ? undefined : 0}
      aria-haspopup={isDeleted ? undefined : "menu"}
      aria-label={isDeleted ? undefined : `Message from ${senderName}`}
      onKeyDown={(event) => {
        if (isDeleted || event.target !== event.currentTarget) return;
        if (
          event.key === "ContextMenu" ||
          (event.shiftKey && event.key === "F10")
        ) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          event.currentTarget.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            }),
          );
        }
      }}
      style={
        isDeleted
          ? undefined
          : {
              backgroundColor: isMe
                ? "var(--chat-outgoing, var(--primary))"
                : "var(--chat-incoming, #262626)",
              borderColor: isMe
                ? "var(--chat-outgoing-border, transparent)"
                : "var(--chat-incoming-border, transparent)",
              borderWidth: isMe
                ? "var(--chat-outgoing-border-width, 0px)"
                : "var(--chat-incoming-border-width, 0px)",
              color: isMe
                ? "var(--chat-outgoing-foreground, var(--primary-foreground))"
                : "var(--chat-incoming-foreground, var(--secondary-foreground))",
            }
      }
    >
      {isDeleted ? (
        <>
          <Ban className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Message deleted by {senderName}</span>
        </>
      ) : (
        <>
          {message.text && <span>{message.text}</span>}
          <MessageAttachments
            roomId={roomId}
            serial={message.serial}
            metadata={message.metadata}
          />
        </>
      )}
    </BubbleContent>
  );

  return (
    <Message ref={ref} align={isMe ? "end" : "start"}>
      <MessageContent>
        <MessageHeader className="gap-2">
          <Avatar size="sm">
            <AvatarImage src={senderImage ?? undefined} alt={senderName} />
            <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
          </Avatar>

          {isMe ? (
            <span className="truncate">{senderName}</span>
          ) : (
            <Link
              href={`/users/${message.clientId}`}
              className="truncate hover:text-foreground hover:underline"
            >
              {senderName}
            </Link>
          )}
        </MessageHeader>

        <Bubble
          variant={isDeleted ? "muted" : isMe ? "default" : "secondary"}
          align={isMe ? "end" : "start"}
          className={hasReactions ? "mb-3" : undefined}
        >
          {!isDeleted ? (
            <ContextMenu>
              <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
              <ContextMenuContent className="w-64 max-w-[calc(100vw-2rem)] rounded-2xl p-2">
                <div
                  role="group"
                  aria-label="Choose a reaction"
                  className="flex justify-between gap-1 pb-1"
                >
                  {REACTIONS.map((emoji) => {
                    const selected = Boolean(
                      currentUserId &&
                      message.reactions?.distinct[emoji]?.clientIds.includes(
                        currentUserId,
                      ),
                    );
                    return (
                      <ContextMenuItem
                        key={emoji}
                        role="menuitemcheckbox"
                        aria-checked={selected}
                        aria-label={`React ${emoji}`}
                        textValue={`React ${emoji}`}
                        disabled={
                          !currentUserId ||
                          reactionPending.has(`${message.serial}:${emoji}`)
                        }
                        className={`size-9 justify-center rounded-full p-0 text-xl ${selected ? "bg-accent" : ""}`}
                        onSelect={() => onReact(message, emoji)}
                      >
                        {emoji}
                      </ContextMenuItem>
                    );
                  })}
                </div>
                <ContextMenuSeparator />
                {message.text && (
                  <ContextMenuItem onSelect={() => onCopy(message)}>
                    <Copy /> Copy
                  </ContextMenuItem>
                )}
                {isMe && message.text && (
                  <ContextMenuItem onSelect={() => onEdit(message)}>
                    <Pencil />
                    Edit
                  </ContextMenuItem>
                )}
                {isMe && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => onDelete(message)}
                    >
                      <Trash2 />
                      Delete
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          ) : (
            content
          )}
          {hasReactions && (
            <BubbleReactions
              align={isMe ? "end" : "start"}
              className="w-max max-w-[min(16rem,70vw)] translate-y-1/2 gap-0.5 bg-secondary shadow-sm ring-background"
              aria-label="Message reactions"
            >
              {reactions.map(([emoji, summary]) => {
                const selected = Boolean(
                  currentUserId && summary.clientIds.includes(currentUserId),
                );
                return (
                  <Button
                    key={emoji}
                    type="button"
                    variant="ghost"
                    aria-label={`${emoji}: ${summary.total} reaction${summary.total === 1 ? "" : "s"}${selected ? ", including you" : ""}`}
                    aria-pressed={selected}
                    disabled={
                      !currentUserId ||
                      reactionPending.has(`${message.serial}:${emoji}`)
                    }
                    className="h-6 min-w-6 gap-1 rounded-full px-1.5 py-0 text-sm"
                    onClick={() => onReact(message, emoji)}
                  >
                    <span>{emoji}</span>
                    {summary.total > 1 && (
                      <span className="text-[0.625rem] text-muted-foreground">
                        {summary.total}
                      </span>
                    )}
                  </Button>
                );
              })}
            </BubbleReactions>
          )}
        </Bubble>

        <MessageFooter className="gap-1">
          <time dateTime={message.timestamp.toISOString()}>
            {formatMessageTime(message.timestamp)}
          </time>
          {!isDeleted &&
            message.version &&
            message.version.serial !== message.serial && (
              <span title={message.version.timestamp.toLocaleString()}>
                · edited
              </span>
            )}
          {isMe && !isDeleted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={
                    readAt
                      ? `Read on ${formatReadTime(readAt)}`
                      : "Sent — no read receipt yet"
                  }
                  className={
                    readAt ? "inline-flex text-sky-500" : "inline-flex"
                  }
                >
                  {readAt ? (
                    <CheckCheckIcon className="size-3.5" />
                  ) : (
                    <CheckIcon className="size-3.5" />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {readAt
                  ? `Read on ${formatReadTime(readAt)}`
                  : "Sent — no read receipt yet"}
              </TooltipContent>
            </Tooltip>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
