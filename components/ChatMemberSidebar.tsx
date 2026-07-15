"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Search, Users, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useRooms } from "@/hooks/use-rooms";

type ChatMembersSidebarProps = {
  open: boolean;
  onClose?: () => void;
};

function getInitials(name: string) {
  return name
    .split(/\s|-/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ChatMembersSidebar({
  open,
  onClose,
}: ChatMembersSidebarProps) {
  const { data: session } = authClient.useSession();
  const { rooms, isLoading } = useRooms(
    Boolean(session?.user),
    session?.user.id,
  );
  const [search, setSearch] = useState("");

  const filteredRooms = rooms.filter((room) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      room.name.toLowerCase().includes(query) ||
      room.code.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-14 z-50 flex w-[280px] flex-col border-r bg-background transition-transform duration-300 ease-out sm:top-16",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-auto lg:h-full lg:overflow-hidden lg:transition-[width] lg:duration-300 lg:ease-out",
          open ? "lg:w-[280px]" : "lg:w-0",
        )}
      >
        <div className="flex h-full min-w-[280px] flex-col">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Rooms</h2>
              <p className="text-xs text-muted-foreground">
                {rooms.length} joined
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

          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search rooms..."
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {filteredRooms.map((room) => {
                const owner = room.members.find(
                  (member) => member.userId === room.ownerId,
                )?.user;

                return (
                  <Button
                    key={room.id}
                    asChild
                    variant="ghost"
                    className="mb-1 h-auto w-full justify-start rounded-xl px-3 py-3"
                  >
                    <Link href={`/chat/${room.code}`} onClick={onClose}>
                      <Avatar className="mr-3 h-10 w-10 border border-border/50">
                        <AvatarImage src={owner?.image ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {getInitials(room.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold">
                          {room.name}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                          {room.code} · {room.memberCount} members
                        </p>
                      </div>
                    </Link>
                  </Button>
                );
              })}

              {!isLoading && filteredRooms.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No rooms found.
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <Separator className="shrink-0" />
          <div className="shrink-0 p-3">
            <Button asChild className="w-full gap-2">
              <Link href="/chat" onClick={onClose}>
                <MessageCircle className="h-4 w-4" />
                Create or join room
              </Link>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
