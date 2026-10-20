import { z } from "zod";
import { ChatMessageAction } from "@ably/chat";
import prisma from "@/lib/prisma";
import { attachmentType } from "@/constants/attachments";
import {
  attachmentUser,
  requireRoom,
  jsonBody,
  privateJson,
  attachmentResponseError,
  AttachmentError,
} from "@/lib/attachments/http";
import { signPart, completeUpload } from "@/lib/attachments/uploads";
import { fileUrl, removeStoredFile } from "@/lib/attachments/r2";
import { resolveAttachments } from "@/lib/attachments/messages";
import { getAttachmentMessage } from "@/lib/attachments/ably";
import { attachmentIds } from "@/constants/attachments";

type Context = { params: Promise<{ id: string }> };
const actions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign"),
    partNumber: z.number().int().positive(),
  }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("cancel") }),
]);

export async function POST(request: Request, context: Context) {
  try {
    const user = await attachmentUser(request);
    const { id } = await context.params;
    const file = await prisma.attachmentUpload.findUnique({ where: { id } });
    if (!file || file.ownerId !== user.id)
      throw new AttachmentError("Attachment not found.", 404);
    await requireRoom(file.roomId, user.id);
    const input = actions.parse(await jsonBody(request));
    if (file.messageSerial || file.deletedAt)
      throw new AttachmentError("This upload cannot be changed.", 409);
    if (input.action === "sign")
      return privateJson(await signPart(file, input.partNumber));
    if (input.action === "complete")
      return privateJson(await completeUpload(id));
    const cancelled = await prisma.attachmentUpload.updateMany({
      where: { id, messageSerial: null },
      data: { state: "cancelled", expiresAt: new Date() },
    });
    if (!cancelled.count)
      throw new AttachmentError("Attachment was already sent.", 409);
    try {
      await removeStoredFile(file);
      await prisma.attachmentUpload.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch {
      /* Scheduled cleanup retries failed deletion. */
    }
    return privateJson({ cancelled: true });
  } catch (error) {
    return attachmentResponseError(error);
  }
}

export async function GET(request: Request, context: Context) {
  try {
    const user = await attachmentUser(request);
    const { id } = await context.params;
    let file = await prisma.attachmentUpload.findUnique({ where: { id } });
    if (!file) throw new AttachmentError("Attachment not found.", 404);
    const room = await requireRoom(file.roomId, user.id);
    if (
      !file.messageSerial ||
      file.deletedAt ||
      file.state !== "ready" ||
      file.expiresAt.getTime() <= Date.now()
    )
      throw new AttachmentError("Attachment expired or unavailable.", 410);
    // Also catches messages deleted outside this browser before cleanup runs.
    const message = await getAttachmentMessage(
      room.code,
      user.id,
      file.messageSerial,
    );
    await resolveAttachments(
      file.roomId,
      room.code,
      user.id,
      file.messageSerial,
      message.action === ChatMessageAction.MessageDelete
        ? [file.id]
        : attachmentIds(message.metadata),
      message,
    );
    file = await prisma.attachmentUpload.findUniqueOrThrow({ where: { id } });
    if (file.state !== "ready" || file.expiresAt.getTime() <= Date.now())
      throw new AttachmentError("Attachment expired or unavailable.", 410);
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    if (preview && attachmentType(file.name)?.preview === "none")
      throw new AttachmentError("Preview is not supported for this file.");
    return privateJson({
      url: await fileUrl(file, preview),
      expiresAt: file.expiresAt.toISOString(),
    });
  } catch (error) {
    return attachmentResponseError(error);
  }
}
