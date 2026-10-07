"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Ban, CheckIcon, CheckCheckIcon, Copy, Pencil, Trash2 } from "lucide-react";
import { useInView } from "react-intersection-observer";

import { ChatMessageAction, type Message as AblyMessage } from "@ably/chat";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
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

type ChatBubbleMessageProps = {
  message: AblyMessage;
  senderName: string;
  senderImage?: string | null;
  isMe: boolean;
  isPageVisible: boolean;
  readAt?: string;
  onRead: (messageSerial: string) => Promise<boolean>;
  onCopy: (message: AblyMessage) => void;
  onDelete: (message: AblyMessage) => void;
  onEdit: () => void;
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
}: ChatBubbleMessageProps) {
  const { ref, inView } = useInView({
    threshold: 0.1,
  });
  const isDeleted = message.action === ChatMessageAction.MessageDelete;

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
      style={
        isDeleted
          ? undefined
          : {
              backgroundColor: isMe
                ? "var(--chat-outgoing, var(--primary))"
                : "var(--chat-incoming, var(--secondary))",
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
        message.text
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
        >
          {!isDeleted && isMe ? (
            <ContextMenu>
              <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
              <ContextMenuContent className="w-40">
                <ContextMenuItem onClick={() => onCopy(message)}>
                  <Copy />
                  Copy
                </ContextMenuItem>
                <ContextMenuItem onClick={onEdit}>
                  <Pencil />
                  Edit
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => onDelete(message)}
                >
                  <Trash2 />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ) : (
            content
          )}
        </Bubble>

        <MessageFooter className="gap-1">
          <time dateTime={message.timestamp.toISOString()}>
            {formatMessageTime(message.timestamp)}
          </time>
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
                  className={readAt ? "inline-flex text-sky-500" : "inline-flex"}
                >
                  {readAt ? (
                    <CheckCheckIcon className="size-3.5" />
                  ) : (
                    <CheckIcon className="size-3.5" />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {readAt ? `Read on ${formatReadTime(readAt)}` : "Sent — no read receipt yet"}
              </TooltipContent>
            </Tooltip>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
