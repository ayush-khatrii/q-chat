"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Check, Clock, ExternalLink, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useRoomActivity } from "@/components/room-activity-context";
import type { RoomActivity } from "@/lib/room-activity";

function initials(event: RoomActivity) {
  const value = event.actor.name ?? event.actor.email;
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function label(event: RoomActivity) {
  const actor = event.actor.name ?? event.actor.email;
  const subject = event.subject?.name ?? event.subject?.email ?? "a member";
  switch (event.type) {
    case "join.requested":
      return `${actor} requested to join`;
    case "join.approved":
      return `${actor} approved ${subject}`;
    case "join.rejected":
      return `${actor} rejected ${subject}`;
    case "member.joined":
      return `${actor} joined the room`;
    case "member.left":
      return `${actor} left the room`;
    case "member.removed":
      return `${actor} removed ${subject}`;
    case "member.promoted":
      return `${actor} promoted ${subject} to admin`;
    case "member.demoted":
      return `${actor} changed ${subject} to member`;
    case "room.deleted":
      return `${actor} deleted the room`;
  }
}

function time(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function NotificationCenter() {
  const activity = useRoomActivity();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!activity) return null;

  const act = async (event: RoomActivity, decision: "approve" | "reject") => {
    setBusyId(event.id);
    setError(null);
    try {
      await activity.decideRequest(event, decision);
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : "Unable to update request.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) activity.markRead();
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="relative"
          aria-label={`Open notifications${activity.unreadCount ? `, ${activity.unreadCount} unread` : ""}`}
        >
          <Bell />
          {activity.unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
              {activity.unreadCount > 99 ? "99+" : activity.unreadCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full w-[min(94vw,420px)] flex-col p-0"
      >
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>Notifications</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Live room activity from the last 15 minutes
          </p>
        </SheetHeader>
        {error ? (
          <p
            role="alert"
            className="mx-4 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-4">
            {activity.pendingRequests.length ? (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold">Join requests</p>
                  <Badge variant="secondary">
                    {activity.pendingRequests.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {activity.pendingRequests.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border bg-card p-3 shadow-sm"
                    >
                      <ActivityIdentity event={event} />
                      {activity.canDecide(event.room.id) ? (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <Button
                            size="sm"
                            onClick={() => void act(event, "approve")}
                            disabled={busyId === event.id}
                          >
                            <Check />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              activity.ignoreRequest(
                                event.request?.id ?? event.id,
                              )
                            }
                            disabled={busyId === event.id}
                          >
                            <Clock />
                            Ignore
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void act(event, "reject")}
                            disabled={busyId === event.id}
                          >
                            <X />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          An admin can respond to this request.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <p className="mb-2 text-xs font-semibold">Recent activity</p>
              <div className="space-y-1">
                {activity.activities.length ? (
                  activity.activities.map((event) => (
                    <Link
                      key={`${event.id}:${event.type}`}
                      href={
                        event.type === "room.deleted"
                          ? "/chat"
                          : `/chat/${encodeURIComponent(event.room.code)}`
                      }
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60"
                    >
                      <Avatar className="size-8">
                        <AvatarImage src={event.actor.image ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(event)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-5">
                          {label(event)}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {event.room.name} · {time(event.createdAt)}
                        </p>
                      </div>
                      <ExternalLink className="mt-1 size-3 text-muted-foreground" />
                    </Link>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                    No room activity yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ActivityIdentity({ event }: { event: RoomActivity }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-9">
        <AvatarImage src={event.actor.image ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {initials(event)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          {event.actor.name ?? event.actor.email}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {event.room.name} · expires in 15 minutes
        </p>
      </div>
    </div>
  );
}
