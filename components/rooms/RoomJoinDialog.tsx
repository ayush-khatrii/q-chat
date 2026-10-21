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
import { parseInviteCode } from "@/lib/invites";
import type { JoinRoomResult, PendingJoinRequest } from "@/lib/rooms";
import { useRoomActivity } from "@/components/room-activity-context";

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
  const [pending, setPending] = useState<PendingJoinRequest | null>(null);
  const activity = useRoomActivity();

  useEffect(() => {
    if (!pending) return;
    const decision = activity?.activities.find(
      (event) =>
        (event.request?.id ?? event.id) === pending.id &&
        (event.type === "join.approved" || event.type === "join.rejected"),
    );
    if (decision?.type === "join.approved") {
      window.dispatchEvent(new Event("qchat:membership-changed"));
      window.location.assign(`/chat/${encodeURIComponent(pending.room.code)}`);
    } else if (decision?.type === "join.rejected") {
      setPending(null);
      setError("Your join request was rejected. You can submit a new request.");
    }
  }, [activity?.activities, pending]);

  useEffect(() => {
    if (!pending) return;
    const delay = Math.max(0, Date.parse(pending.expiresAt) - Date.now());
    const timer = window.setTimeout(() => {
      setPending(null);
      setError("Your join request expired. Submit it again to retry.");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedCode = parseInviteCode(code, window.location.origin);

    if (!parsedCode) {
      setError("Enter a valid room code or a QChat invite link.");
      return;
    }

    setError(null);

    try {
      const result = await onJoin(parsedCode);
      if (result.status === "joined") {
        setCode("");
        onOpenChange(false);
      } else {
        setPending(result.request);
      }
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
            <DialogTitle>{pending ? "Request sent" : "Join room"}</DialogTitle>
            <DialogDescription>
              {pending
                ? `Waiting for an admin of ${pending.room.name} to respond. This request expires in 15 minutes.`
                : "Enter the QC room code or paste a QChat invite link."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {!pending ? (
              <Input
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setError(null);
                }}
                placeholder="QC-TEAM-01 or invite link"
                disabled={isJoining}
                autoFocus
              />
            ) : (
              <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
                <p className="font-medium">{pending.room.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {pending.room.code}
                </p>
              </div>
            )}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            {pending ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            ) : (
              <Button type="submit" disabled={isJoining || !code.trim()}>
                {isJoining ? "Sending request..." : "Request to join"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
