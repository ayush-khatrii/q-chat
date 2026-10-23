"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Bell, Check, Clock, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useRoomActivity } from "@/components/room-activity-context";
import type { RoomActivity } from "@/lib/room-activity";
import type { UserRoom } from "@/lib/rooms";
import { canModerateRequests } from "@/lib/permissions";

export default function NotificationCenter({ room }: { room: UserRoom }) {
  // Remount transient UI on navigation or role changes.
  return (
    <RequestInbox key={`${room.id}:${room.currentUserRole}`} room={room} />
  );
}

function RequestInbox({ room }: { room: UserRoom }) {
  const activity = useRoomActivity();
  const [open, setOpen] = useState(false);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tabVisible, setTabVisible] = useState(false);
  useEffect(() => {
    const update = () => setTabVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  if (
    !activity ||
    !canModerateRequests(room.currentUserRole) ||
    !activity.canDecide(room.id)
  )
    return null;
  const requests = activity.pendingRequests.filter(
    (event) => event.room.id === room.id,
  );
  const unread = activity.inboxReady
    ? requests.filter((event) => !activity.isRequestSeen(event)).length
    : 0;
  const act = async (event: RoomActivity, decision: "approve" | "reject") => {
    setBusyId(event.id);
    setError(null);
    try {
      await activity.decideRequest(event, decision);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to update request.",
      );
    } finally {
      setBusyId(null);
    }
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="relative"
          aria-label={`Open join requests${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full w-[min(94vw,420px)] flex-col p-0"
      >
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>Join requests</SheetTitle>
          <p className="text-xs text-muted-foreground">{room.name}</p>
        </SheetHeader>
        {error && (
          <p
            role="alert"
            className="mx-4 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
        <div
          ref={setViewport}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
        >
          <div className="space-y-2">
            {requests.map((event) => (
              <RequestCard
                key={event.id}
                event={event}
                root={viewport}
                observe={open && tabVisible && activity.inboxReady}
                seen={activity.isRequestSeen(event)}
                markSeen={activity.markRequestSeen}
                busy={busyId !== null}
                act={act}
                ignore={() => activity.ignoreRequest(event.request!.id)}
              />
            ))}
            {!requests.length && (
              <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                No pending join requests.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RequestCard({
  event,
  root,
  observe,
  seen,
  markSeen,
  busy,
  act,
  ignore,
}: {
  event: RoomActivity;
  root: HTMLDivElement | null;
  observe: boolean;
  seen: boolean;
  markSeen: (event: RoomActivity) => void;
  busy: boolean;
  act: (event: RoomActivity, decision: "approve" | "reject") => Promise<void>;
  ignore: () => void;
}) {
  const { ref, inView } = useInView({
    root,
    threshold: 0.5,
    skip: !observe || !root || seen,
  });
  useEffect(() => {
    if (observe && root && inView && !seen) markSeen(event);
  }, [observe, root, inView, seen, markSeen, event]);
  const name = event.actor.name ?? event.actor.email;
  const initials = name
    .split(/\s|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      ref={ref}
      data-request-id={event.id}
      className="rounded-xl border bg-card p-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarImage src={event.actor.image ?? undefined} />
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{name}</p>
          <p className="text-[10px] text-muted-foreground">
            Requested to join · expires{" "}
            {new Date(event.expiresAt ?? event.createdAt).toLocaleTimeString(
              [],
              { hour: "numeric", minute: "2-digit" },
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void act(event, "approve")}
        >
          <Check />
          Accept
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={ignore}>
          <Clock />
          Ignore
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void act(event, "reject")}
        >
          <X />
          Reject
        </Button>
      </div>
    </div>
  );
}
