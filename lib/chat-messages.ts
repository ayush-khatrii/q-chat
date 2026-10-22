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
    // SDK messages expose `with()`. Keeping this defensive also supports a
    // just-acknowledged REST payload while the richer realtime event catches up.
    let merged = previous
      ? typeof previous.with === "function"
        ? previous.with(message)
        : message
      : message;
    const summary = summaries.get(message.serial);
    if (summary) merged = merged.with(summary);
    bySerial.set(message.serial, merged);
  }
  return Array.from(bySerial.values());
}
