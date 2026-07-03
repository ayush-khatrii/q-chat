"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserRoom } from "@/lib/rooms";

type RoomActionDialogProps = {
  room: UserRoom | null;
  open: boolean;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export default function RoomActionDialog({
  room,
  open,
  isBusy,
  onOpenChange,
  onConfirm,
}: RoomActionDialogProps) {
  const actionLabel = room?.isOwner ? "Delete room" : "Leave room";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>
            {room?.isOwner
              ? "Deleting this room removes the room code and membership for everyone in it."
              : "Leaving this room removes it from your room list."}
          </DialogDescription>
        </DialogHeader>

        {room ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="truncate text-xs font-medium">{room.name}</p>
            <p className="font-mono text-[0.6875rem] text-muted-foreground">
              {room.code}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={isBusy || !room}
          >
            {isBusy ? "Working..." : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
