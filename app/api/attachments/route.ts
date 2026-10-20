import { z } from "zod";
import { ATTACHMENT_CONFIG } from "@/constants/attachments";
import {
  attachmentUser,
  requireRoom,
  jsonBody,
  privateJson,
  attachmentResponseError,
} from "@/lib/attachments/http";
import { startUpload } from "@/lib/attachments/uploads";
import { resolveAttachments } from "@/lib/attachments/messages";

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("initiate"),
    roomId: z.string().min(1).max(100),
    name: z.string().max(ATTACHMENT_CONFIG.maxFileNameLength),
    size: z.number().int().positive().max(ATTACHMENT_CONFIG.maxFileBytes),
    mimeType: z.string().max(150),
  }),
  z.object({
    action: z.literal("resolve"),
    roomId: z.string().min(1).max(100),
    serial: z.string().min(1).max(200),
    ids: z
      .array(z.string().min(1).max(100))
      .min(1)
      .max(ATTACHMENT_CONFIG.maxFilesPerMessage),
  }),
]);

export async function POST(request: Request) {
  try {
    const user = await attachmentUser(request);
    const input = inputSchema.parse(await jsonBody(request));
    const room = await requireRoom(input.roomId, user.id);
    if (input.action === "initiate")
      return privateJson(await startUpload(user.id, input));
    return privateJson({
      attachments: await resolveAttachments(
        input.roomId,
        room.code,
        user.id,
        input.serial,
        input.ids,
      ),
    });
  } catch (error) {
    return attachmentResponseError(error);
  }
}
