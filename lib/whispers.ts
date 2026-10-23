import { z } from "zod";
import type { Message } from "@ably/chat";
export const privateInbox = (userId: string) => `qchat:private:${userId}`;
export const whisperDraftSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(4000)
    .refine((text) => text.trim().length > 0),
  clientMessageId: z.string().uuid(),
});
export const whisperMetadataSchema = z.object({
  kind: z.literal("whisper"),
  id: z.string(),
  sender: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  }),
  room: z.object({ id: z.string(), name: z.string(), code: z.string() }),
});
export type Whisper = z.infer<typeof whisperMetadataSchema> & {
  serial: string;
  text: string;
  timestamp: number;
};
export function parseWhisper(message: Message): Whisper | null {
  const metadata = whisperMetadataSchema.safeParse(message.metadata);
  return metadata.success
    ? {
        ...metadata.data,
        serial: message.serial,
        text: message.text,
        timestamp: message.timestamp.getTime(),
      }
    : null;
}
