"use client";

import { useEffect, useState } from "react";
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
import type { JoinRoomResult } from "@/lib/rooms";
import { authClient } from "@/lib/auth-client";
import {
  useRoomMembership,
  useRoomRequestEvents,
} from "@/hooks/use-room-requests";

type RoomJoinDialogProps = {
  open: boolean;
  isJoining: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (code: string) => Promise<JoinRoomResult>;
};

export default function RoomJoinDialog({
  open,
  isJoining,
  onOpenChange,
  onJoin,
}: RoomJoinDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<
    Extract<JoinRoomResult, { status: "PENDING" }>['request'] | null
  >(null);
  const { data: session } = authClient.useSession();
  const membershipQuery = useRoomMembership(pendingRequest?.roomId ?? null);

  useRoomRequestEvents({
    userId: session?.user.id,
    requesterEnabled: Boolean(pendingRequest),
  });

  useEffect(() => {
    const status = membershipQuery.data?.membership.status;

    if (status === "APPROVED" && pendingRequest) {
      window.location.assign(`/chat/${pendingRequest.roomCode}`);
    }

    if (status === "REJECTED") {
      setError("The room admin rejected your request.");
    }
  }, [membershipQuery.data?.membership.status, pendingRequest]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedCode = joinRoomSchema.safeParse({ code });

    if (!parsedCode.success) {
      setError(parsedCode.error.issues[0]?.message ?? "Invalid room code.");
      return;
    }

    setError(null);

    try {
      const result = await onJoin(parsedCode.data.code);

      if (result.status === "PENDING") {
        setPendingRequest(result.request);
        setError(null);
        return;
      }

      setPendingRequest(null);
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
          {pendingRequest ? (
            <>
              <DialogHeader>
                <DialogTitle>Waiting for approval</DialogTitle>
                <DialogDescription>
                  Your request to join <strong>{pendingRequest.roomName}</strong> is waiting for the room admin.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 text-sm text-muted-foreground">
                This dialog will update automatically when the admin approves or rejects your request.
                {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
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
                  {isJoining ? "Sending request..." : "Request to join"}
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
