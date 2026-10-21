import { type Message, type MessageReactionSummaryEvent } from "@ably/chat";

// Content versions and reaction summaries advance independently in Ably.
export function mergeMessagePage(
  current: Message[],
  incoming: Message[],
  summaries: Map<string, MessageReactionSummaryEvent>,
) {
  const bySerial = new Map(current.map((message) => [message.serial, message]));
  for (const message of incoming) {
    const previous = bySerial.get(message.serial);
    let merged = previous ? previous.with(message) : message;
    const summary = summaries.get(message.serial);
    if (summary) merged = merged.with(summary);
    bySerial.set(message.serial, merged);
  }
  return Array.from(bySerial.values());
}
