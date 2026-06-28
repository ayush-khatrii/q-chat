"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

import { Search, MessageCircle, Users, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const members = [
  {
    id: 1,
    name: "Olivia",
    lastMessage: "Typing...",
    online: true,
    unread: 0,
  },
  {
    id: 2,
    name: "Ethan",
    lastMessage: "See you tomorrow 👋",
    online: true,
    unread: 2,
  },
  {
    id: 3,
    name: "Sophia",
    lastMessage: "Image received",
    online: false,
    unread: 0,
  },
  {
    id: 4,
    name: "Noah",
    lastMessage: "Let's deploy now.",
    online: true,
    unread: 6,
  },
  {
    id: 5,
    name: "Emma",
    lastMessage: "Thanks ❤️",
    online: false,
    unread: 0,
  },
  {
    id: 6,
    name: "Liam",
    lastMessage: "Room updated",
    online: true,
    unread: 1,
  },
  {
    id: 7,
    name: "Mia",
    lastMessage: "Sent a file",
    online: false,
    unread: 0,
  },
  {
    id: 8,
    name: "Lucas",
    lastMessage: "Good night!",
    online: true,
    unread: 0,
  },
];

interface ChatMembersSidebarProps {
  open: boolean;
  onClose?: () => void;
}

export default function ChatMembersSidebar({
  open,
  onClose,
}: ChatMembersSidebarProps) {
  return (
    <>
      {/* Mobile overlay backdrop — only on screens < lg */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      {/* Sidebar — pushes content on lg+, overlays on mobile */}
      <aside
        className={cn(
          // Mobile: fixed overlay with translate
          "fixed left-0 top-14 bottom-0 z-50 flex w-[280px] flex-col border-r bg-background transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: static in flex layout, full height, width-based push
          "lg:static lg:z-auto lg:h-full lg:transition-[width] lg:duration-300 lg:ease-out lg:overflow-hidden",
          open ? "lg:w-[280px]" : "lg:w-0",
        )}
      >
        {/* Inner wrapper keeps content at full width so it doesn't collapse */}
        <div className="flex min-w-[280px] flex-col h-full">
          {/* Fixed Header */}
          <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Chats</h2>

              <p className="text-xs text-muted-foreground">
                {members.length} Conversations
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable Middle */}
          <ScrollArea className="flex-1 min-h-0">
            <div>
              {/* Search */}
              <div className="border-b p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input placeholder="Search chats..." className="pl-9" />
                </div>
              </div>

              {/* Room */}
              <div className="border-b p-4">
                <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                  <div className="rounded-lg bg-primary p-2 text-primary-foreground">
                    <Users className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      General Room
                    </p>

                    <p className="text-xs text-muted-foreground">
                      18 Members Online
                    </p>
                  </div>
                </div>
              </div>

              {/* Members */}
              <div className="p-2">
                {members.map((member) => (
                  <Button
                    key={member.id}
                    variant="ghost"
                    className="mb-1 h-auto w-full justify-start rounded-xl px-3 py-3"
                  >
                    <div className="relative mr-3">
                      <Avatar className="h-10 w-10 border border-border/50">
                        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background",
                          member.online ? "bg-emerald-500" : "bg-muted-foreground/55"
                        )}
                      />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {member.name}
                        </p>

                        {member.unread > 0 && (
                          <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {member.unread}
                          </div>
                        )}
                      </div>

                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {member.lastMessage}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </ScrollArea>

          <Separator className="shrink-0" />

          {/* Fixed Footer */}
          <div className="shrink-0 p-3">
            <Button className="w-full gap-2">
              <MessageCircle className="h-4 w-4" />
              New Conversation
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
