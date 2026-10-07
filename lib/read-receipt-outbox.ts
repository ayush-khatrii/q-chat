import type { ReadReceipt } from "./read-receipts";

type PendingReceipt = { receipt: ReadReceipt; published: boolean; busy: boolean };

type OutboxOptions = {
  publish: (receipt: ReadReceipt) => Promise<unknown>;
  save: (receipt: ReadReceipt) => Promise<unknown>;
  remember: (receipt: ReadReceipt) => void;
  forget: (receipt: ReadReceipt) => void;
  retryMs?: number;
};

// Own retries independently of the message's viewport observer.
export function createReadReceiptOutbox(options: OutboxOptions) {
  const pending = new Map<string, PendingReceipt>();
  const completed = new Set<string>();
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (stopped) return;
    for (const item of pending.values()) void deliver(item);
  };

  const deliver = async (item: PendingReceipt) => {
    if (stopped || item.busy) return;
    item.busy = true;
    try {
      if (!item.published) {
        await options.publish(item.receipt);
        item.published = true;
      }
      if (stopped) return;
      // The sender has already received the realtime event. DB latency/failure
      // cannot hold up the ticks, and retries do not republish that event.
      await options.save(item.receipt);
      pending.delete(item.receipt.messageSerial);
      completed.add(item.receipt.messageSerial);
      options.forget(item.receipt);
    } catch {
      // Keep the original timestamp and persisted queue entry until successful.
    } finally {
      item.busy = false;
      if (!stopped && pending.size && retry === undefined) {
        retry = setTimeout(() => {
          retry = undefined;
          flush();
        }, options.retryMs ?? 4_000);
      }
    }
  };

  return {
    enqueue(receipt: ReadReceipt) {
      if (stopped || completed.has(receipt.messageSerial) || pending.has(receipt.messageSerial)) return;
      options.remember(receipt);
      const item = { receipt, published: false, busy: false };
      pending.set(receipt.messageSerial, item);
      void deliver(item);
    },
    flush,
    stop() {
      stopped = true;
      clearTimeout(retry);
    },
  };
}
