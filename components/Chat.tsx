"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import { authClient } from "@/lib/auth-client";

type MessageData = {
  id: string;
  senderId: "me" | "other";
  content: string;
  timestamp?: string;
  footer?: string;
  reactions?: string[];
  variant?: "tinted" | "muted" | "default";
};

const mockUser = {
  id: "user_other_001",
  name: "Oliver Rabbit",
  email: "oliver@example.com",
  image: "/avatars/02.png",
  initials: "OR",
};

const initialMessages: MessageData[] = [
  {
    id: "m1",
    senderId: "me",
    content: "Deploying to prod real quick.",
    variant: "tinted",
  },
  {
    id: "m2",
    senderId: "other",
    content: "It's 4:55 PM. On a Friday.",
    variant: "muted",
  },
  {
    id: "m3",
    senderId: "me",
    content: "It's a one-line change.",
    footer: "Delivered",
    variant: "tinted",
  },
  {
    id: "m4",
    senderId: "other",
    content: "It's always a one-line change 😭.",
    variant: "muted",
  },
  {
    id: "m5",
    senderId: "other",
    content: "Alright, let me take a look.",
    variant: "muted",
    reactions: ["👍"],
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Chat() {
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;

  const meInitials = currentUser?.name
    ? getInitials(currentUser.name)
    : "ME";

  return (
    <div className="flex w-full max-w-full px-8 flex-col gap-6 py-12">
      {initialMessages.map((msg) => {
        const isMe = msg.senderId === "me";

        return (
          <Message key={msg.id} align={isMe ? "end" : "start"}>
            <MessageAvatar>
              <Avatar>
                <AvatarImage
                  src={
                    isMe
                      ? (currentUser?.image ?? "/avatars/10.png")
                      : mockUser.image
                  }
                  alt={isMe ? (currentUser?.name ?? "@me") : mockUser.name}
                />
                <AvatarFallback>
                  {isMe ? meInitials : mockUser.initials}
                </AvatarFallback>
              </Avatar>
            </MessageAvatar>

            <MessageContent>
              {/* If both consecutive messages from "other" are grouped, render as BubbleGroup */}
              {msg.reactions ? (
                <BubbleGroup>
                  <Bubble variant={msg.variant ?? "muted"}>
                    <BubbleContent>{msg.content}</BubbleContent>
                    <BubbleReactions aria-label="Reactions: thumbs up">
                      {msg.reactions.map((r) => (
                        <span key={r}>{r}</span>
                      ))}
                    </BubbleReactions>
                  </Bubble>
                </BubbleGroup>
              ) : (
                <Bubble variant={msg.variant ?? "default"}>
                  <BubbleContent>{msg.content}</BubbleContent>
                </Bubble>
              )}

              {msg.footer && <MessageFooter>{msg.footer}</MessageFooter>}
            </MessageContent>
          </Message>
        );
      })}

      <Marker role="status">
        <MarkerContent className="shimmer">
          <span className="font-medium">{mockUser.name.split(" ")[0]}</span> is
          typing...
        </MarkerContent>
      </Marker>
    </div>
  );
}
