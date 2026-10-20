import "server-only";
import { ChatClient } from "@ably/chat";
import { Realtime } from "ably";

// autoConnect:false: REST message inspection does not need a WebSocket.
export async function getAttachmentMessage(
  code: string,
  userId: string,
  serial: string,
) {
  if (!process.env.ABLY_API_KEY) throw new Error("Ably is not configured.");
  const realtime = new Realtime({
    key: process.env.ABLY_API_KEY,
    clientId: userId,
    autoConnect: false,
  });
  const chat = new ChatClient(realtime);
  try {
    const room = await chat.rooms.get(`qchat:${code}`);
    return await room.messages.get(serial);
  } finally {
    await chat.dispose();
    realtime.close();
  }
}
