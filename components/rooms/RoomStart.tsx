"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Crown,
  Hash,
  LogIn,
  MessageCircle,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RoomCreateDialog from "@/components/rooms/RoomCreateDialog";
import RoomJoinDialog from "@/components/rooms/RoomJoinDialog";
import { useRooms } from "@/hooks/use-rooms";

function initials(name: string) {
  return name
    .split(/\s|-/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function RoomListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading your chats" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card/50 p-4 sm:p-5"
          aria-hidden="true"
        >
          <div className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 max-w-full animate-pulse rounded bg-muted/70" />
          </div>
          <div className="hidden h-9 w-24 animate-pulse rounded-lg bg-muted sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function RoomStart({ userId }: { userId: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const {
    rooms,
    isLoading,
    isCreating,
    isJoining,
    createRoom,
    joinRoom,
    error,
  } = useRooms(true, userId);
  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter(
      (room) =>
        room.name.toLowerCase().includes(query) ||
        room.code.toLowerCase().includes(query),
    );
  }, [rooms, search]);

  const handleCreate = async (name: string, customCode?: string) => {
    const room = await createRoom(name, customCode);
    router.push(`/chat/${room.code}`);
  };

  const handleJoin = async (code: string) => {
    const result = await joinRoom(code);
    if (result.status === "joined") router.push(`/chat/${result.room.code}`);
    return result;
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <MessageCircle className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your chats
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Choose a room to continue the conversation, or start a new one.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              <LogIn className="size-4" />
              Join
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create room
            </Button>
          </div>
        </div>

        {rooms.length > 0 || search ? (
          <div className="relative mt-8">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats by name or code"
              className="h-11 rounded-xl border-border/70 bg-card pl-10"
              aria-label="Search chats"
            />
          </div>
        ) : null}

        <div className="mt-6">
          {isLoading && rooms.length === 0 ? <RoomListSkeleton /> : null}
          {!isLoading && rooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-14 text-center sm:py-20">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <MessageCircle className="size-6" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">No chats yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Create your first room and invite people, or join a room with a
                code someone shared with you.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" />
                  Create your first room
                </Button>
                <Button variant="outline" onClick={() => setJoinOpen(true)}>
                  <LogIn className="size-4" />
                  Join with a code
                </Button>
              </div>
            </div>
          ) : null}
          {!isLoading && rooms.length > 0 && filteredRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-12 text-center">
              <p className="text-sm font-medium">No matching chats</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try another room name or code.
              </p>
            </div>
          ) : null}
          {filteredRooms.length > 0 ? (
            <div className="space-y-3">
              {filteredRooms.map((room) => {
                const owner = room.members.find(
                  (member) => member.userId === room.ownerId,
                )?.user;
                return (
                  <Link
                    key={room.id}
                    href={`/chat/${room.code}`}
                    className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3.5 transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4 sm:p-5"
                  >
                    <Avatar className="size-11 rounded-xl sm:size-12">
                      <AvatarImage
                        src={owner?.image ?? undefined}
                        alt=""
                        className="rounded-xl"
                      />
                      <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                        {initials(room.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-sm font-semibold sm:text-base">
                          {room.name}
                        </h2>
                        {room.isOwner ? (
                          <Badge
                            variant="secondary"
                            className="hidden gap-1 sm:flex"
                          >
                            <Crown className="size-3" />
                            Owner
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono">
                          <Hash className="size-3" />
                          {room.code.replace(/^QC-/, "")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="size-3" />
                          {room.memberCount}{" "}
                          {room.memberCount === 1 ? "member" : "members"}
                        </span>
                      </div>
                    </div>
                    <div
                      className="hidden -space-x-2 sm:flex"
                      aria-hidden="true"
                    >
                      {room.members.slice(0, 3).map((member) => (
                        <Avatar
                          key={member.id}
                          size="sm"
                          className="ring-2 ring-card"
                        >
                          <AvatarImage src={member.user.image ?? undefined} />
                          <AvatarFallback className="text-[9px]">
                            {initials(member.user.name ?? member.user.email)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
          {error ? (
            <p className="mt-4 text-center text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      </section>

      <RoomCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isCreating={isCreating}
        onCreate={handleCreate}
      />
      <RoomJoinDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        isJoining={isJoining}
        onJoin={handleJoin}
      />
    </div>
  );
}
