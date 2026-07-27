import "server-only";

import * as Ably from "ably";
export {
  ownerRequestEventsChannel,
  userRequestStatusChannel,
} from "@/lib/room-event-channels";

let ablyRest: Ably.Rest | null = null;

function getAblyRest() {
  const apiKey = process.env.ABLY_API_KEY;

  if (!apiKey) {
    return null;
  }

  ablyRest ??= new Ably.Rest(apiKey);
  return ablyRest;
}

export async function publishRoomEvent(
  channelName: string,
  name: string,
  data: Record<string, unknown>,
) {
  const client = getAblyRest();

  if (!client) {
    console.warn("ABLY_API_KEY is not configured; realtime room events are disabled.");
    return;
  }

  await client.channels.get(channelName).publish(name, data);
}

export async function publishRoomEventSafely(
  channelName: string,
  name: string,
  data: Record<string, unknown>,
) {
  try {
    await publishRoomEvent(channelName, name, data);
  } catch (error) {
    // A realtime hint must never make a successful database mutation fail.
    console.error("Unable to publish room event", { channelName, name, error });
  }
}
