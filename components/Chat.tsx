"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArchiveX,
  Clock,
  DoorClosed,
  MoreHorizontal,
  Send,
  Shield,
  TimerReset,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import type { ChatMessage, ChatUser } from "@/constants";

type ChatProps = {
  messages: ChatMessage[];
  currentUserId?: string;
};

function getDisplayName(user: ChatUser) {
  return user.name ?? user.email;
}

function getInitials(user: ChatUser): string {
  const source = user.name ?? user.email;

  return source
    .split(/\s|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function MessageTimestamp({ value }: { value: string }) {
  const formatted = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));

  return (
    <time
      dateTime={value}
      className="mt-1 text-[0.5625rem] font-medium leading-none text-muted-foreground/70 sm:text-[0.625rem]"
      aria-label={`Sent at ${formatted}`}
    >
      {formatted}
    </time>
  );
}

export default function Chat({ messages, currentUserId }: ChatProps) {
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;
  const [draft, setDraft] = useState("");
  const [temporaryChat, setTemporaryChat] = useState(false);
  const [autoClose, setAutoClose] = useState(false);
  const [terminateRoom, setTerminateRoom] = useState(false);
  const [roomProtection, setRoomProtection] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sessionUserId = currentUser?.id;
  const resolvedCurrentUserId =
    sessionUserId && messages.some((msg) => msg.senderId === sessionUserId)
      ? sessionUserId
      : currentUserId;

  const groups = [...messages]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .reduce<ChatMessage[][]>((acc, msg) => {
      const lastGroup = acc[acc.length - 1];
      if (lastGroup && lastGroup[0].senderId === msg.senderId) {
        lastGroup.push(msg);
      } else {
        acc.push([msg]);
      }
      return acc;
    }, []);

  const canSend = draft.trim().length > 0;

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
  }, [draft]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    setDraft("");

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.overflowY = "hidden";
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-4 sm:py-6 lg:px-8 lg:py-10">
        {groups.map((group) => {
          const sender = group[0].sender;
          const isMe = group[0].senderId === resolvedCurrentUserId;
          const align = isMe ? "end" : "start";
          const senderName = getDisplayName(sender);

          return (
            <MessageGroup key={group[0].id} className="gap-1 sm:gap-1.5">
              {group.map((msg, idx) => {
                const isFirst = idx === 0;

                return (
                  <Message
                    key={msg.id}
                    align={align}
                    className="gap-1.5 text-[0.6875rem]/relaxed sm:gap-2 sm:text-xs/relaxed"
                  >
                    <MessageContent className="gap-0.5 sm:gap-1">
                      {isFirst && (
                        <MessageHeader className="gap-2 px-1 pb-1 text-[0.5625rem] leading-4 group-data-[align=end]/message:flex-row-reverse group-data-[align=end]/message:justify-end sm:gap-2 sm:px-1.5 sm:text-[0.625rem]">
                          <Avatar className="size-5 sm:size-6">
                            <AvatarImage
                              src={
                                isMe && currentUser?.image
                                  ? currentUser.image
                                  : (sender.image ?? undefined)
                              }
                              alt={senderName}
                            />
                            <AvatarFallback className="text-[0.625rem] sm:text-xs">
                              {getInitials(sender)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 truncate">{senderName}</span>
                        </MessageHeader>
                      )}
                      <Bubble
                        variant={isMe ? "tinted" : "muted"}
                        align={align}
                        className="max-w-[min(82vw,38rem)] sm:max-w-[78%] md:max-w-[70%]"
                      >
                        <BubbleContent className="px-2 py-1.5 text-[0.6875rem]/relaxed whitespace-pre-wrap sm:px-2.5 sm:text-xs/relaxed">
                          {msg.content}
                        </BubbleContent>
                      </Bubble>

                      <MessageFooter className="px-2 text-[0.5625rem] leading-none sm:px-2.5">
                        <MessageTimestamp value={msg.createdAt} />
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                );
              })}
            </MessageGroup>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 py-3 backdrop-blur sm:px-4 sm:py-3 lg:px-8"
      >
        <div className="mx-auto flex w-full max-w-5xl items-end gap-2 shadow-sm shadow-black/5 backdrop-blur-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label="Open chat settings"
                className="h-9 w-9 p-0 border border-border bg-transparent"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-64 sm:w-72"
            >
              <DropdownMenuLabel>Chat settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => event.preventDefault()}
                className="justify-between gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Clock />
                  Temporary chat
                </span>
                <Switch
                  size="sm"
                  checked={temporaryChat}
                  onCheckedChange={setTemporaryChat}
                  aria-label="Toggle temporary chat"
                />
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => event.preventDefault()}
                className="justify-between gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <TimerReset />
                  Auto close room
                </span>
                <Switch
                  size="sm"
                  checked={autoClose}
                  onCheckedChange={setAutoClose}
                  aria-label="Toggle auto close room"
                />
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => event.preventDefault()}
                className="justify-between gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Shield />
                  Room protection
                </span>
                <Switch
                  size="sm"
                  checked={roomProtection}
                  onCheckedChange={setRoomProtection}
                  aria-label="Toggle room protection"
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <DoorClosed />
                Close room after chat
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setTerminateRoom((value) => !value);
                }}
              >
                <ArchiveX />
                {terminateRoom ? "Room termination selected" : "Terminate room"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={1}
            placeholder="type something..."
            aria-label="Write a message"
            className="min-h-11 flex resize-none overflow-hidden rounded-xl border-border/70 bg-background px-3 py-3 text-xs leading-5 shadow-none sm:min-h-12 sm:px-4 sm:text-sm"
          />

          <Button
            type="submit"
            size="icon-lg"
            disabled={!canSend}
            aria-label="Send message"
            className="size-11 shrink-0 rounded-xl"
          >
            <Send />
          </Button>
        </div>
      </form>
    </div>
  );
}
