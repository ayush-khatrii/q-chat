import type { RoomActivity } from "./room-activity";

export type InboxState = Record<
  string,
  { expiresAt: number; seen?: boolean; ignored?: boolean }
>;
export function requestKey(event: RoomActivity) {
  return `${event.room.id}:${event.request?.id ?? event.id}`;
}
export function pruneInbox(value: unknown, now: number): InboxState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([, entry]) =>
          entry &&
          typeof entry === "object" &&
          Number.isFinite(entry.expiresAt) &&
          entry.expiresAt > now,
      )
      .map(([key, entry]) => [
        key,
        {
          expiresAt: entry.expiresAt,
          seen: entry.seen === true,
          ignored: entry.ignored === true,
        },
      ]),
  );
}
export function pendingJoinRequests(
  events: RoomActivity[],
  state: InboxState,
  now: number,
  canDecide: (roomId: string) => boolean,
) {
  const resolved = new Set(
    events
      .filter(
        (event) =>
          event.type === "join.approved" || event.type === "join.rejected",
      )
      .map(requestKey),
  );
  const requesters = new Set<string>();
  return [...events]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((event) => {
      if (
        event.type !== "join.requested" ||
        !event.request ||
        !canDecide(event.room.id) ||
        Date.parse(event.expiresAt ?? event.createdAt) <= now
      )
        return false;
      const requester = `${event.room.id}:${event.actor.id}`;
      if (requesters.has(requester)) return false;
      requesters.add(requester);
      return (
        !resolved.has(requestKey(event)) && !state[requestKey(event)]?.ignored
      );
    });
}
