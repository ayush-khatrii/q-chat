"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import RoomCreateDialog from "@/components/rooms/RoomCreateDialog";
import RoomJoinDialog from "@/components/rooms/RoomJoinDialog";
import { useRooms } from "@/hooks/use-rooms";

export default function RoomStart({ userId }: { userId: string }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const {
    createRoom,
    joinRoom,
    isCreating,
    isJoining,
    error,
  } = useRooms(true, userId);

  const handleCreate = async (name: string, customCode?: string) => {
    const room = await createRoom(name, customCode);
    router.push(`/chat/${room.code}`);
  };

  const handleJoin = async (code: string) => {
    const room = await joinRoom(code);
    router.push(`/chat/${room.code}`);
  };

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Start chatting</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a room or enter a QC code shared by another user.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Create room
          </Button>
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            <LogIn />
            Join room
          </Button>
        </div>

        {error ? (
          <p className="mt-4 text-xs text-destructive">{error}</p>
        ) : null}
      </div>

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
