import { z } from "zod";

export const READ_RECEIPT_EVENT = "message-read";

// Separate from qchat:* so receipt access is scoped to room members.
export function readReceiptChannel(roomId: string) {
  return `qchat-reads:${roomId}`;
}

export const readReceiptSchema = z.object({
  messageSerial: z.string().min(1).max(512),
  readAt: z.string().datetime(),
});

export const readReceiptEventSchema = readReceiptSchema.extend({
  readerId: z.string().min(1),
});

export type ReadReceipt = z.infer<typeof readReceiptSchema>;

export function remoteReadReceipt(data: unknown, clientId: string | undefined, userId: string) {
  const parsed = readReceiptEventSchema.safeParse(data);
  if (!parsed.success || parsed.data.readerId === userId || clientId !== parsed.data.readerId) {
    return null;
  }
  return parsed.data;
}

export function mergeReadReceipts(
  current: Record<string, string>,
  receipts: ReadReceipt[],
): Record<string, string> {
  const merged = { ...current };
  for (const { messageSerial, readAt } of receipts) {

    if (!merged[messageSerial] || Date.parse(readAt) < Date.parse(merged[messageSerial])) {
      merged[messageSerial] = readAt;
    }
  }
  return merged;
}
