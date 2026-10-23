import { NextResponse } from "next/server";
import { z } from "zod";
import { whisperDraftSchema } from "@/lib/whispers";
import {
  deliverWhispers,
  whisperBody,
  whisperError,
  whisperUser,
} from "@/lib/whispers/server";
const schema = whisperDraftSchema.extend({
  recipientIds: z.array(z.string().min(1).max(200)).min(1).max(49),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const user = await whisperUser(request);
    const body = schema.parse(await whisperBody(request));
    const { roomId } = await params;
    const results = await deliverWhispers(
      user,
      roomId,
      [...new Set(body.recipientIds)],
      body.text,
      body.clientMessageId,
    );
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return whisperError(error);
  }
}
