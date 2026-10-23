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
import { useRooms } from "@/hooks/use-rooms";
import { canModerateRequests } from "@/lib/permissions";
import {
  isRoomActivity,
  roomActivityChannel,
  roomJoinRequestChannel,
  userActivityChannel,
  type RoomActivity,
} from "@/lib/room-activity";

import {
  pendingJoinRequests,
  pruneInbox,
  requestKey,
  type InboxState,
} from "@/lib/join-request-inbox";

type Decision = "approve" | "reject";

type ActivityContextValue = {
  activities: RoomActivity[];
  pendingRequests: RoomActivity[];
  inboxReady: boolean;
  isRequestSeen: (event: RoomActivity) => boolean;
  markRequestSeen: (event: RoomActivity) => void;
  ignoredRequestIds: Set<string>;
  rooms: UserRoom[];
  ignoreRequest: (id: string) => void;
  decideRequest: (activity: RoomActivity, decision: Decision) => Promise<void>;
  canDecide: (roomId: string) => boolean;
};

const ActivityContext = createContext<ActivityContextValue | null>(null);

function eventKey(event: RoomActivity) {
  return `${event.id}:${event.type}`;
}

function RoomActivitySubscription({
  realtimeClient,
  userId,
  rooms,
  addEvent,
}: {
  realtimeClient: Ably.Realtime | null;
  userId: string | null;
  rooms: UserRoom[];
  addEvent: (event: RoomActivity, live: boolean) => void;
}) {
  useEffect(() => {
    if (!realtimeClient || !userId) return;

    const channelNames = [
      userActivityChannel(userId),
      ...rooms.map((room) => roomActivityChannel(room.id)),
      ...rooms
        .filter((room) => canModerateRequests(room.currentUserRole))
        .map((room) => roomJoinRequestChannel(room.id)),
    ];
    const channels = [...new Set(channelNames)].map((name) =>
      realtimeClient.channels.get(name),
    );
    const listener = (message: Ably.Message) => {
      if (cancelled || !isRoomActivity(message.data)) return;
      addEvent(message.data, true);
      if (
        message.data.type === "room.deleted" ||
        (message.data.type === "member.removed" &&
          message.data.subject?.id === userId)
      ) {
        window.location.assign("/chat");
      }
    };

    let cancelled = false;
    void Promise.all(
      channels.map(async (channel) => {
        try {
          await channel.subscribe(listener);
          let page = await channel.history({
            start: Date.now() - 15 * 60 * 1000,
            direction: "forwards",
            limit: 200,
          });
          while (!cancelled) {
            for (const message of page.items) {
              if (isRoomActivity(message.data)) addEvent(message.data, false);
            }
            if (!page.hasNext()) break;
            const next = await page.next();
            if (!next) break;
            page = next;
          }
        } catch {
          // Live delivery remains available when history is not configured.
        }
      }),
    );

    return () => {
      cancelled = true;
      for (const channel of channels) channel.unsubscribe(listener);
    };
  }, [addEvent, realtimeClient, rooms, userId]);

  return null;
}

export function RoomActivityProvider({
  realtimeClient,
  userId,
  children,
}: {
  realtimeClient: Ably.Realtime | null;
  userId: string | null;
  children: ReactNode;
}) {
  const { rooms } = useRooms(Boolean(userId), userId);
  const [events, setEvents] = useState<Map<string, RoomActivity>>(new Map());
  const [inbox, setInbox] = useState<{
    userId: string | null;
    state: InboxState;
  }>({ userId: null, state: {} });
  const inboxRef = useRef(inbox);
  const inboxReady = inbox.userId === userId;
  const inboxState = useMemo(
    () => (inboxReady ? inbox.state : {}),
    [inbox, inboxReady],
  );
  const storageKey = userId ? `qchat:join-inbox:${userId}` : null;
  useEffect(() => {
    const read = () => {
      try {
        return pruneInbox(
          JSON.parse(localStorage.getItem(storageKey!) ?? "{}"),
          Date.now(),
        );
      } catch {
        return {};
      }
    };
    const restore = () => {
      const state = storageKey ? read() : {};
      inboxRef.current = { userId, state };
      setInbox(inboxRef.current);
    };
    restore();
    const prune = window.setInterval(() => {
      const state = pruneInbox(inboxRef.current.state, Date.now());
      inboxRef.current = { userId, state };
      setInbox(inboxRef.current);
      try {
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {}
    }, 30_000);
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) restore();
    };
    window.addEventListener("storage", sync);
    return () => {
      window.clearInterval(prune);
      window.removeEventListener("storage", sync);
    };
  }, [storageKey, userId]);
  const updateInbox = useCallback(
    (event: RoomActivity, field: "seen" | "ignored") => {
      const current = inboxRef.current;
      if (current.userId !== userId) return;
      let stored: InboxState = {};
      try {
        stored = pruneInbox(
          JSON.parse(localStorage.getItem(storageKey!) ?? "{}"),
          Date.now(),
        );
      } catch {}
      const key = requestKey(event);
      const state = pruneInbox(
        {
          ...stored,
          ...current.state,
          [key]: {
            ...stored[key],
            ...current.state[key],
            expiresAt: Date.parse(event.expiresAt ?? event.createdAt),
            [field]: true,
          },
        },
        Date.now(),
      );
      try {
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* In-memory state remains available. */
      }
      inboxRef.current = { userId, state };
      setInbox(inboxRef.current);
    },
    [storageKey, userId],
  );
  const ignoredRequestIds = useMemo(
    () =>
      new Set(
        Object.entries(inboxState)
          .filter(([, value]) => value.ignored)
          .map(([key]) => key),
      ),
    [inboxState],
  );
  const [clock, setClock] = useState(0);

  const addEvent = useCallback((event: RoomActivity, live: boolean) => {
    const key = eventKey(event);
    setEvents((current) => {
      if (current.has(key)) return current;
      const next = new Map(current);
      next.set(key, event);
      return next;
    });
    if (live && event.type !== "join.requested") {
      window.dispatchEvent(new Event("qchat:membership-changed"));
    }
  }, []);

  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setEvents(new Map());
  }, [realtimeClient, userId]);

  const activities = useMemo(
    () =>
      [...events.values()]
        .filter((event) => Date.parse(event.createdAt) > clock - 15 * 60 * 1000)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [clock, events],
  );

  const canDecide = useCallback(
    (roomId: string) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      return room ? canModerateRequests(room.currentUserRole) : false;
    },
    [rooms],
  );

  const pendingRequests = useMemo(
    () => pendingJoinRequests(activities, inboxState, clock, canDecide),
    [activities, inboxState, clock, canDecide],
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
      addEvent(
        {
          ...activity,
          type: decision === "approve" ? "join.approved" : "join.rejected",
        },
        true,
      );
    },
    [addEvent],
  );

  const value = useMemo<ActivityContextValue>(
    () => ({
      activities,
      pendingRequests,
      inboxReady,
      isRequestSeen: (event) => Boolean(inboxState[requestKey(event)]?.seen),
      markRequestSeen: (event) => updateInbox(event, "seen"),
      ignoredRequestIds,
      rooms,
      ignoreRequest: (id) => {
        const event = pendingRequests.find((event) => event.request?.id === id);
        if (event) updateInbox(event, "ignored");
      },
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
      inboxReady,
      inboxState,
      updateInbox,
    ],
  );

  return (
    <ActivityContext.Provider value={value}>
      <RoomActivitySubscription
        realtimeClient={realtimeClient}
        userId={userId}
        rooms={rooms}
        addEvent={addEvent}
      />
      {children}
    </ActivityContext.Provider>
  );
}

export function useRoomActivity() {
  return useContext(ActivityContext);
}
