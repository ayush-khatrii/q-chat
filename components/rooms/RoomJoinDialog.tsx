"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { joinRoomSchema } from "@/lib/rooms";

type RoomJoinDialogProps = {
  open: boolean;
  isJoining: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (code: string) => Promise<void>;
};

export default function RoomJoinDialog({
  open,
  isJoining,
  onOpenChange,
  onJoin,
}: RoomJoinDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedCode = joinRoomSchema.safeParse({ code });

    if (!parsedCode.success) {
      setError(parsedCode.error.issues[0]?.message ?? "Invalid room code.");
      return;
    }

    setError(null);

    try {
      await onJoin(parsedCode.data.code);
      setCode("");
      onOpenChange(false);
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "Unable to join the room.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Join room</DialogTitle>
            <DialogDescription>
              Enter the QC room code shared by the room owner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="QC-TEAM-01"
              disabled={isJoining}
              autoFocus
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isJoining || !code.trim()}>
              {isJoining ? "Joining..." : "Join room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
