"use client";

import { useState, useRef, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import type { UserRoomMember } from "@/lib/rooms";
import {
  ChatMessageEventType,
  type ChatMessageEvent,
  type Message as AblyMessage,
} from "@ably/chat";
import { useMessages } from "@ably/chat/react";

type ChatProps = {
  members: UserRoomMember[];
};

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

export default function Chat({ members }: ChatProps) {
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;

  const [messages, setMessages] = useState<AblyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // This is the entire "receive messages" setup — straight from Ably's docs.
  const { sendMessage } = useMessages({
    listener: (event: ChatMessageEvent) => {
      if (event.type === ChatMessageEventType.Created) {
        setMessages((prev) => [...prev, event.message]);
      }
    },
  });

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
      // No need to manually add it to `messages` — the listener above
      // will receive the Created event and add it for us.
    } catch (error) {
      setDraft(text); // put the draft back so the user doesn't lose it
      setSendError(
        error instanceof Error ? error.message : "Unable to send message.",
      );
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

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
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

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 border-t px-4 py-3"
      >
        <div className="mx-auto flex w-full max-w-5xl items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            placeholder="type something..."
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
