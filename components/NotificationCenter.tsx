"use client";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Bell, Check, Clock, X, ShieldCheck, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRoomActivity } from "@/components/room-activity-context";
import { useWhispers } from "@/components/whisper-context";
import { PrivateSpace } from "@/components/PrivateSpace";
import type { RoomActivity } from "@/lib/room-activity";
import type { UserRoom } from "@/lib/rooms";
import { canModerateRequests } from "@/lib/permissions";

export default function NotificationCenter({ room }: { room?: UserRoom }) {
  const activity = useRoomActivity();
  const inbox = useWhispers();
  const [open, setOpen] = useState(false);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const moderate =
    !!room &&
    canModerateRequests(room.currentUserRole) &&
    !!activity?.canDecide(room.id);
  const requests = moderate
    ? activity!.pendingRequests.filter((event) => event.room.id === room!.id)
    : [];
  const unread = activity?.inboxReady
    ? requests.filter((event) => !activity.isRequestSeen(event)).length
    : 0;
  const privateUnread = inbox?.ready
    ? inbox.messages.filter((m) => !inbox.seen[m.id]).length
    : 0;
  const selected =
    moderate && inbox?.tab === "notifications" ? "notifications" : "private";
  const act = async (event: RoomActivity, decision: "approve" | "reject") => {
    if (!activity) return;
    setBusyId(event.id);
    setError(null);
    try {
      await activity.decideRequest(event, decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update request.");
    } finally {
      setBusyId(null);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next && privateUnread > 0) inbox?.setTab("private");
        setOpen(next);
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="relative h-9 gap-2 px-2"
          aria-label={`Open notification center, ${unread} unread join requests, ${inbox?.ready ? `${privateUnread} unread whispers` : "whispers loading"}`}
        >
          <span className="relative">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 text-violet-700 dark:text-violet-300">
            <ShieldCheck className="size-4" />
            {!inbox?.ready ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              privateUnread > 0 && (
                <span className="rounded-full bg-violet-600 px-1.5 text-[10px] font-semibold text-white">
                  {privateUnread > 99 ? "99+" : privateUnread}
                </span>
              )
            )}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-dvh flex-col gap-0 p-0 data-[side=right]:w-[min(100vw,440px)] data-[side=right]:sm:max-w-[440px]"
      >
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>Notification center</SheetTitle>
          <SheetDescription>
            Room requests and your Private Space.
          </SheetDescription>
        </SheetHeader>
        <Tabs
          value={selected}
          onValueChange={(value) => inbox?.setTab(value)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList
            className="mx-4 my-3 shrink-0"
            aria-label="Notification center tabs"
          >
            {moderate && (
              <TabsTrigger
                value="notifications"
                aria-label={`Notifications, ${unread} unread join requests`}
              >
                Notifications
                {unread > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger
              value="private"
              aria-label={`Private Space, ${inbox?.ready ? `${privateUnread} unread whispers` : "loading whispers"}`}
              className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
            >
              <ShieldCheck className="size-4" />
              Private Space
              {privateUnread > 0 && (
                <span>{privateUnread > 99 ? "99+" : privateUnread}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="private" className="flex min-h-0 flex-1 flex-col">
            <PrivateSpace active={open && selected === "private" && visible} />
          </TabsContent>
          {moderate && (
            <TabsContent
              value="notifications"
              className="flex min-h-0 flex-1 flex-col"
            >
              <p className="px-4 pb-2 text-xs text-muted-foreground">
                {room?.name}
              </p>
              {error && (
                <p
                  role="alert"
                  className="mx-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <div
                ref={setViewport}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4"
              >
                {!activity?.inboxReady && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading join requests…
                  </p>
                )}
                {requests.map((event) => (
                  <RequestCard
                    key={event.id}
                    event={event}
                    root={viewport}
                    observe={
                      open &&
                      selected === "notifications" &&
                      visible &&
                      !!activity?.inboxReady
                    }
                    seen={activity!.isRequestSeen(event)}
                    markSeen={activity!.markRequestSeen}
                    busy={busyId !== null}
                    act={act}
                    ignore={() => activity!.ignoreRequest(event.request!.id)}
                  />
                ))}
                {activity?.inboxReady && !requests.length && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No pending join requests.
                  </p>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
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
