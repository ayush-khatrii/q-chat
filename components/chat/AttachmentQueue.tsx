"use client";
import { FileIcon, RotateCcw, X } from "lucide-react";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentGroup,
} from "@/components/ui/attachment";
import type { QueuedAttachment } from "@/hooks/use-attachment-uploads";

export function AttachmentQueue({
  files,
  remove,
  retry,
  disabled,
}: {
  files: QueuedAttachment[];
  remove: (file: QueuedAttachment) => void;
  retry: (file: QueuedAttachment) => void;
  disabled: boolean;
}) {
  if (!files.length) return null;
  return (
    <AttachmentGroup
      aria-label="Queued attachments"
      className="mx-auto mb-2 max-w-5xl"
    >
      {files.map((item) => (
        <Attachment key={item.key} state={item.state} className="max-w-72">
          <AttachmentMedia>
            <FileIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{item.file.name}</AttachmentTitle>
            <AttachmentDescription title={item.error}>
              {item.error ??
                (item.state === "done"
                  ? "Ready · expires 24 hours after sending"
                  : item.state === "processing"
                    ? "Checking file…"
                    : `Uploading · ${item.progress}%`)}
            </AttachmentDescription>
            {item.state === "uploading" && (
              <progress
                className="h-1 w-full"
                value={item.progress}
                max={100}
                aria-label={`Uploading ${item.file.name}`}
              />
            )}
          </AttachmentContent>
          <AttachmentActions>
            {item.state === "error" && (
              <AttachmentAction
                type="button"
                disabled={disabled}
                aria-label={`Retry ${item.file.name}`}
                onClick={() => retry(item)}
              >
                <RotateCcw />
              </AttachmentAction>
            )}
            <AttachmentAction
              type="button"
              disabled={disabled}
              aria-label={`Remove ${item.file.name}`}
              onClick={() => remove(item)}
            >
              <X />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
      <span className="sr-only" role="status">
        {files.filter((file) => file.state === "done").length} of {files.length}{" "}
        attachments ready.
      </span>
    </AttachmentGroup>
  );
}
