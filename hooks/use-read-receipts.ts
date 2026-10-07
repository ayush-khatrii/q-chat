"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAbly } from "ably/react";
import type { ChannelStateChange, Message } from "ably";
import { z } from "zod";
import {
  READ_RECEIPT_EVENT,
  mergeReadReceipts,
  readReceiptChannel,
  remoteReadReceipt,
  readReceiptSchema,
  type ReadReceipt,
} from "@/lib/read-receipts";

import { createReadReceiptOutbox } from "@/lib/read-receipt-outbox";

const snapshotSchema = z.object({ receipts: z.array(readReceiptSchema) });

export function useReadReceipts(roomId: string, userId?: string) {
  const ably = useAbly();
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({});
  const outboxRef = useRef<ReturnType<typeof createReadReceiptOutbox> | null>(null);

  useEffect(() => {
    setReadReceipts({});
    if (!userId) return;

    let disposed = false;
    const abort = new AbortController();
    const channel = ably.channels.get(readReceiptChannel(roomId));
    const storagePrefix = `qchat:pending-reads:${userId}:${roomId}:`;
    const outbox = createReadReceiptOutbox({
      publish: (receipt) => channel.publish(READ_RECEIPT_EVENT, { ...receipt, readerId: userId }),
      save: async (receipt) => {
        const response = await fetch(`/api/rooms/${roomId}/reads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(receipt),
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]),
        });
        if (!response.ok) throw new Error("Unable to save read receipt.");
      },
      remember: (receipt) => {
        try { localStorage.setItem(storagePrefix + receipt.messageSerial, JSON.stringify(receipt)); }
        catch { /* */ }
      },
      forget: (receipt) => {
        try { localStorage.removeItem(storagePrefix + receipt.messageSerial); }
        catch { /* */ }
      },
    });
    outboxRef.current = outbox;
    try {
      const restored: ReadReceipt[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key?.startsWith(storagePrefix)) continue;
        const parsed = readReceiptSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
        if (parsed.success) restored.push(parsed.data);
      }
      restored.forEach((receipt) => outbox.enqueue(receipt));
    } catch { /* */ }
    window.addEventListener("online", outbox.flush);
    const refresh = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/reads`, {
          credentials: "include",
          cache: "no-store",
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("Unable to load read receipts.");
        const { receipts } = snapshotSchema.parse(await response.json());
        if (!disposed) {
          setReadReceipts((current) => mergeReadReceipts(current, receipts));
        }
      } catch (error) {
        if (!disposed) console.error("Error loading read receipts:", error);
      }
    };
    const onReceipt = (message: Message) => {
      const receipt = remoteReadReceipt(message.data, message.clientId, userId);
      if (disposed || !receipt) return;
      setReadReceipts((current) => mergeReadReceipts(current, [receipt]));
    };
    const onAttached = () => void refresh();
    const onUpdate = (change: ChannelStateChange) => {
      if (!change.resumed) void refresh();
    };
    const onFocus = () => void refresh();

    channel.on("attached", onAttached);
    channel.on("update", onUpdate);

    void channel.subscribe(READ_RECEIPT_EVENT, onReceipt).catch((error) => {
      if (!disposed) console.error("Read receipt subscription failed:", error);
    });
    void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      outbox.stop();
      if (outboxRef.current === outbox) outboxRef.current = null;
      window.removeEventListener("online", outbox.flush);
      abort.abort();
      window.removeEventListener("focus", onFocus);
      channel.unsubscribe(READ_RECEIPT_EVENT, onReceipt);
      channel.off("attached", onAttached);
      channel.off("update", onUpdate);

      void channel.detach().catch(() => { });
    };
  }, [ably, roomId, userId]);

  const markRead = useCallback(
    (messageSerial: string): Promise<boolean> => {
      if (!userId) return Promise.resolve(false);
      const outbox = outboxRef.current;
      if (!outbox) return Promise.resolve(false);
      outbox.enqueue({ messageSerial, readAt: new Date().toISOString() });
      return Promise.resolve(true);
    },
    [roomId, userId],
  );

  return { readReceipts, markRead };
}
