"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type * as Ably from "ably";
import type { UserRoom } from "@/lib/rooms";
import { canModerateRequests } from "@/lib/permissions";
import {
  isRoomActivity,
  roomActivityChannel,
  userActivityChannel,
  type RoomActivity,
} from "@/lib/room-activity";

type Decision = "approve" | "reject";

type ActivityContextValue = {
  activities: RoomActivity[];
  pendingRequests: RoomActivity[];
  unreadCount: number;
  ignoredRequestIds: Set<string>;
  rooms: UserRoom[];
  markRead: () => void;
  ignoreRequest: (id: string) => void;
  decideRequest: (activity: RoomActivity, decision: Decision) => Promise<void>;
  canDecide: (roomId: string) => boolean;
};

const ActivityContext = createContext<ActivityContextValue | null>(null);

function eventKey(event: RoomActivity) {
  return `${event.id}:${event.type}`;
}

export function RoomActivityProvider({
  client,
  userId,
  children,
}: {
  client: Ably.Realtime;
  userId: string;
  children: ReactNode;
}) {
  const [rooms, setRooms] = useState<UserRoom[]>([]);
  const [events, setEvents] = useState<Map<string, RoomActivity>>(new Map());
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [ignoredRequestIds, setIgnoredRequestIds] = useState<Set<string>>(
    new Set(),
  );
  const [clock, setClock] = useState(() => Date.now());
  const liveReady = useRef(false);

  const addEvent = useCallback((event: RoomActivity, live: boolean) => {
    const key = eventKey(event);
    setEvents((current) => {
      if (current.has(key)) return current;
      const next = new Map(current);
      next.set(key, event);
      return next;
    });
    if (live && event.type !== "join.requested") {
      setUnreadIds((current) => new Set(current).add(key));
      window.dispatchEvent(new Event("qchat:membership-changed"));
    }
  }, []);

  const loadRooms = useCallback(async () => {
    const response = await fetch("/api/rooms", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { rooms?: UserRoom[] };
    setRooms(payload.rooms ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadRooms();
    const refresh = () => void loadRooms();
    window.addEventListener("qchat:membership-changed", refresh);
    return () =>
      window.removeEventListener("qchat:membership-changed", refresh);
  }, [loadRooms]);

  useEffect(() => {
    const channelNames = [
      userActivityChannel(userId),
      ...rooms.map((room) => roomActivityChannel(room.id)),
    ];
    const channels = [...new Set(channelNames)].map((name) =>
      client.channels.get(name),
    );
    const listener = (message: Ably.Message) => {
      if (isRoomActivity(message.data)) {
        addEvent(message.data, liveReady.current);
        if (
          liveReady.current &&
          (message.data.type === "room.deleted" ||
            (message.data.type === "member.removed" &&
              message.data.subject?.id === userId))
        ) {
          window.location.assign("/chat");
        }
      }
    };

    let cancelled = false;
    void Promise.all(
      channels.map(async (channel) => {
        channel.subscribe(listener);
        try {
          const page = await channel.history({
            start: Date.now() - 15 * 60 * 1000,
            direction: "forwards",
            limit: 200,
          });
          if (!cancelled) {
            for (const message of page.items) {
              if (isRoomActivity(message.data)) addEvent(message.data, false);
            }
          }
        } catch {
          // Live delivery remains available when history is not configured.
        }
      }),
    ).finally(() => {
      if (!cancelled) liveReady.current = true;
    });

    return () => {
      cancelled = true;
      for (const channel of channels) channel.unsubscribe(listener);
    };
  }, [addEvent, client, rooms, userId]);

  const activities = useMemo(
    () =>
      [...events.values()]
        .filter((event) => Date.parse(event.createdAt) > clock - 15 * 60 * 1000)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [clock, events],
  );

  const pendingRequests = useMemo(() => {
    const resolved = new Set(
      activities
        .filter(
          (event) =>
            event.type === "join.approved" || event.type === "join.rejected",
        )
        .map((event) => event.request?.id ?? event.id),
    );
    const now = clock;
    const seenRequesters = new Set<string>();
    return activities.filter((event) => {
      if (
        event.type !== "join.requested" ||
        !event.request ||
        resolved.has(event.request.id) ||
        ignoredRequestIds.has(event.request.id) ||
        Date.parse(event.expiresAt ?? event.createdAt) <= now
      )
        return false;
      const requesterKey = `${event.room.id}:${event.actor.id}`;
      if (seenRequesters.has(requesterKey)) return false;
      seenRequesters.add(requesterKey);
      return true;
    });
  }, [activities, clock, ignoredRequestIds]);

  const canDecide = useCallback(
    (roomId: string) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      return room ? canModerateRequests(room.currentUserRole) : false;
    },
    [rooms],
  );

  const decideRequest = useCallback(
    async (activity: RoomActivity, decision: Decision) => {
      if (!activity.request)
        throw new Error("Join request details are unavailable.");
      const response = await fetch(
        `/api/rooms/${activity.room.id}/join-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: decision,
            ticket: activity.request.ticket,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Unable to update request.");
    },
    [],
  );

  const value = useMemo<ActivityContextValue>(
    () => ({
      activities,
      pendingRequests,
      unreadCount:
        [...unreadIds].filter((id) =>
          activities.some((event) => eventKey(event) === id),
        ).length + pendingRequests.length,
      ignoredRequestIds,
      rooms,
      markRead: () => setUnreadIds(new Set()),
      ignoreRequest: (id) =>
        setIgnoredRequestIds((current) => new Set(current).add(id)),
      decideRequest,
      canDecide,
    }),
    [
      activities,
      canDecide,
      decideRequest,
      ignoredRequestIds,
      pendingRequests,
      rooms,
      unreadIds.size,
    ],
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useRoomActivity() {
  return useContext(ActivityContext);
}
