"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { OrderBy, type ChatClient, type Message } from "@ably/chat";
import type { Realtime } from "ably";
import { parseWhisper, privateInbox, type Whisper } from "@/lib/whispers";
const RETENTION = 30 * 86400000;
type Inbox = {
  messages: Whisper[];
  ready: boolean;
  connected: boolean;
  error: string | null;
  seen: Record<string, number>;
  markSeen: (id: string) => void;
  retry: () => void;
  tab: string;
  setTab: (tab: string) => void;
};
const Context = createContext<Inbox | null>(null);
export const useWhispers = () => useContext(Context);
export function WhisperProvider({
  userId,
  chatClient,
  realtimeClient,
  children,
}: {
  userId: string | null;
  chatClient: ChatClient | null;
  realtimeClient: Realtime | null;
  children: ReactNode;
}) {
  // A keyed boundary clears private state synchronously on account changes.
  return (
    <WhisperState
      key={userId ?? "signed-out"}
      userId={userId}
      chatClient={chatClient}
      realtimeClient={realtimeClient}
    >
      {children}
    </WhisperState>
  );
}
function WhisperState({
  userId,
  chatClient,
  realtimeClient,
  children,
}: {
  userId: string | null;
  chatClient: ChatClient | null;
  realtimeClient: Realtime | null;
  children: ReactNode;
}) {
  const [messages, setMessages] = useState<Whisper[]>([]);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const seenRef = useRef<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState("private");
  const storageKey = `qchat:whisper-seen:${userId}`;
  const mergeSeen = useCallback((raw: string | null) => {
    try {
      const value: unknown = JSON.parse(raw ?? "{}");
      const next = { ...seenRef.current };
      if (value && typeof value === "object" && !Array.isArray(value))
        for (const [id, timestamp] of Object.entries(value))
          if (
            typeof timestamp === "number" &&
            timestamp > Date.now() - RETENTION &&
            timestamp <= Date.now()
          )
            next[id] = timestamp;
      for (const [id, timestamp] of Object.entries(next))
        if (timestamp < Date.now() - RETENTION) delete next[id];
      seenRef.current = next;
      setSeen(next);
    } catch {
      /* Keep memory state if browser storage is unavailable. */
    }
  }, []);
  const markSeen = useCallback(
    (id: string) => {
      try {
        mergeSeen(localStorage.getItem(storageKey));
      } catch {}
      const next = { ...seenRef.current, [id]: Date.now() };
      seenRef.current = next;
      setSeen(next);
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(
            Object.fromEntries(
              Object.entries(next).sort(([a], [b]) => a.localeCompare(b)),
            ),
          ),
        );
      } catch {}
    },
    [storageKey, mergeSeen],
  );
  useEffect(() => {
    try {
      mergeSeen(localStorage.getItem(storageKey));
    } catch {}
    const update = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      mergeSeen(event.newValue);
      // Preserve the union when two tabs mark different messages simultaneously.
      try {
        mergeSeen(localStorage.getItem(storageKey));
        const serialized = JSON.stringify(
          Object.fromEntries(
            Object.entries(seenRef.current).sort(([a], [b]) =>
              a.localeCompare(b),
            ),
          ),
        );
        if (localStorage.getItem(storageKey) !== serialized)
          localStorage.setItem(storageKey, serialized);
      } catch {}
    };
    const prune = window.setInterval(() => {
      mergeSeen(null);
      setMessages((current) =>
        current.filter((message) => message.timestamp > Date.now() - RETENTION),
      );
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(
            Object.fromEntries(
              Object.entries(seenRef.current).sort(([a], [b]) =>
                a.localeCompare(b),
              ),
            ),
          ),
        );
      } catch {}
    }, 60_000);
    window.addEventListener("storage", update);
    return () => {
      window.clearInterval(prune);
      window.removeEventListener("storage", update);
    };
  }, [storageKey, mergeSeen]);
  useEffect(() => {
    if (!userId || !chatClient || !realtimeClient) return;
    let cancelled = false;
    let cleanup = () => {};
    let loading = false;
    let again = false;
    setReady(false);
    setError(null);
    const merge = (items: Message[]) => {
      if (cancelled) return;
      setMessages((previous) => {
        const all = new Map(
          previous
            .filter((m) => m.timestamp > Date.now() - RETENTION)
            .map((m) => [m.id, m]),
        );
        for (const message of items) {
          const item = parseWhisper(message);
          if (item && item.timestamp > Date.now() - RETENTION)
            all.set(item.id, item);
        }
        return [...all.values()].sort((a, b) => b.timestamp - a.timestamp);
      });
    };
    void (async () => {
      const room = await chatClient.rooms.get(privateInbox(userId), {
        presence: { enableEvents: false },
      });
      if (cancelled) return;
      // Chat defaults to requesting PUBLISH mode; this inbox is read-only.
      await room.channel.setOptions({ modes: ["SUBSCRIBE"] });
      if (cancelled) return;
      const subscription = room.messages.subscribe((event) =>
        merge([event.message]),
      );
      const reconcile = async () => {
        if (loading) {
          again = true;
          return;
        }
        loading = true;
        if (!cancelled) {
          setReady(false);
          setError(null);
        }
        try {
          do {
            again = false;
            let page = await room.messages.history({
              limit: 1000,
              orderBy: OrderBy.NewestFirst,
            });
            merge(page.items);
            while (page.hasNext() && !cancelled) {
              const next = await page.next();
              if (!next) break;
              page = next;
              merge(page.items);
            }
          } while (again && !cancelled);
          if (!cancelled) setReady(true);
        } catch {
          if (!cancelled)
            setError(
              "Could not load Private Space. Retry to reconcile your inbox.",
            );
        } finally {
          loading = false;
        }
      };
      const status = () => {
        if (!cancelled) {
          setConnected(realtimeClient.connection.state === "connected");
          if (realtimeClient.connection.state === "connected") void reconcile();
        }
      };
      const discontinuity = room.onDiscontinuity(() => {
        void reconcile();
      });
      realtimeClient.connection.on(status);
      cleanup = () => {
        subscription.unsubscribe();
        discontinuity.off();
        realtimeClient.connection.off(status);
        void chatClient.rooms.release(privateInbox(userId)).catch(() => {});
      };
      await room.attach();
      setConnected(realtimeClient.connection.state === "connected");
      await reconcile();
    })().catch(() => {
      if (!cancelled) setError("Private Space is unavailable. Please retry.");
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [userId, chatClient, realtimeClient, attempt]);
  return (
    <Context.Provider
      value={
        userId
          ? {
              messages,
              seen,
              markSeen,
              ready,
              connected,
              error,
              retry: () => setAttempt((n) => n + 1),
              tab,
              setTab,
            }
          : null
      }
    >
      {children}
    </Context.Provider>
  );
}
