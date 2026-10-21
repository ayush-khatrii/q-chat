import type { Message as AblyMessage } from "@ably/chat";

export const REPLY_PREVIEW_LENGTH = 140;
export const NOTIFICATION_PREVIEW_WORDS = 10;
export const NOTIFICATION_PREVIEW_LENGTH = 90;

export type MessageReply = {
  serial: string;
  timestamp: number;
  clientId: string;
  previewText: string;
};

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function messagePreview(message: AblyMessage) {
  const text = compact(message.text);
  return Array.from(text || "Attachment")
    .slice(0, REPLY_PREVIEW_LENGTH)
    .join("");
}

export function prepareReply(message: AblyMessage): MessageReply {
  return {
    serial: message.serial,
    timestamp: message.timestamp.getTime(),
    clientId: message.clientId,
    previewText: messagePreview(message),
  };
}

export function getMessageReply(metadata: unknown): MessageReply | null {
  if (!metadata || typeof metadata !== "object") return null;
  const reply = (metadata as Record<string, unknown>).reply;
  if (!reply || typeof reply !== "object") return null;
  const value = reply as Record<string, unknown>;
  if (
    typeof value.serial !== "string" ||
    !value.serial ||
    value.serial.length > 512 ||
    typeof value.timestamp !== "number" ||
    !Number.isFinite(value.timestamp) ||
    typeof value.clientId !== "string" ||
    !value.clientId ||
    value.clientId.length > 256 ||
    typeof value.previewText !== "string"
  )
    return null;

  return {
    serial: value.serial,
    timestamp: value.timestamp,
    clientId: value.clientId,
    previewText: Array.from(compact(value.previewText))
      .slice(0, REPLY_PREVIEW_LENGTH)
      .join(""),
  };
}

export function notificationPreview(value: string) {
  const normalized = compact(value) || "Shared an attachment";
  const words = normalized.split(" ");
  const byWords = words.slice(0, NOTIFICATION_PREVIEW_WORDS).join(" ");
  const preview = Array.from(byWords)
    .slice(0, NOTIFICATION_PREVIEW_LENGTH)
    .join("")
    .trimEnd();
  return words.length > NOTIFICATION_PREVIEW_WORDS ||
    byWords.length > NOTIFICATION_PREVIEW_LENGTH
    ? `${preview}...`
    : preview;
}
