import { NextResponse } from "next/server";
import { parseWhisper, privateInbox, whisperDraftSchema } from "@/lib/whispers";
import {
  deliverWhispers,
  whisperBody,
  whisperChat,
  whisperError,
  WhisperError,
  whisperUser,
} from "@/lib/whispers/server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ serial: string }> },
) {
  try {
    const user = await whisperUser(request);
    const { serial } = await params;
    const body = whisperDraftSchema.parse(await whisperBody(request));
    const original = await whisperChat(user.id, async (chat) => {
      const inbox = await chat.rooms.get(privateInbox(user.id));
      try {
        return parseWhisper(await inbox.messages.get(serial));
      } catch {
        throw new WhisperError("This whisper is no longer available.", 404);
      }
    });
    if (!original || original.timestamp < Date.now() - 30 * 86400000)
      throw new WhisperError("This whisper has expired.", 404);
    const results = await deliverWhispers(
      user,
      original.room.id,
      [original.sender.id],
      body.text,
      body.clientMessageId,
      serial,
    );
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return whisperError(error);
  }
}
