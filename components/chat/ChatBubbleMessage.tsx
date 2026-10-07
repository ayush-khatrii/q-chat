"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckIcon, Copy, Pencil, Trash2 } from "lucide-react";
import { useInView } from "react-intersection-observer";

import { ChatMessageAction, type Message as AblyMessage } from "@ably/chat";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleReactions } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
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
  onRead: (messageSerial: string) => void;
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
    triggerOnce: true,
  });
  const isDeleted = message.action === ChatMessageAction.MessageDelete;

  useEffect(() => {
    if (!isMe && !isDeleted && inView && isPageVisible) {
      onRead(message.serial);
    }
  }, [inView, isDeleted, isMe, isPageVisible, message.serial, onRead]);

  const content = (
    <BubbleContent
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
      {isDeleted ? `Message deleted by ${senderName}` : message.text}
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

          {isMe && !isDeleted && readAt && (
            <BubbleReactions>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Read on ${formatReadTime(readAt)}`}
                  >
                    <CheckIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Read on {formatReadTime(readAt)}
                </TooltipContent>
              </Tooltip>
            </BubbleReactions>
          )}
        </Bubble>

        <MessageFooter>
          <time dateTime={message.timestamp.toISOString()}>
            {formatMessageTime(message.timestamp)}
          </time>
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
