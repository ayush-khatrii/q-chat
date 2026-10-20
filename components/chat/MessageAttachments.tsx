"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Download,
  FileIcon,
  ImageIcon,
  Film,
  Music,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { attachmentIds, type SharedAttachment } from "@/constants/attachments";
import { attachmentRequest } from "@/lib/attachments/client";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
  AttachmentGroup,
} from "@/components/ui/attachment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function MessageAttachments({
  roomId,
  serial,
  metadata,
}: {
  roomId: string;
  serial: string;
  metadata: unknown;
}) {
  const idsKey = attachmentIds(metadata).join(",");
  const [files, setFiles] = useState<SharedAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SharedAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!idsKey) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const load = async () => {
      try {
        const result = await attachmentRequest<{
          attachments: SharedAttachment[];
        }>(
          "/api/attachments",
          { action: "resolve", roomId, serial, ids: idsKey.split(",") },
          controller.signal,
        );
        setFiles(result.attachments);
        setError(null);
      } catch {
        if (controller.signal.aborted) return;
        if (++attempts < 4) timer = setTimeout(load, 1500 * attempts);
        else setError("Attachments could not be loaded.");
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [roomId, serial, idsKey, retry]);

  useEffect(() => {
    const check = () => setNow(Date.now());
    const interval = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const isExpired = useCallback(
    (file: SharedAttachment) =>
      file.state === "expired" || Date.parse(file.expiresAt) <= now,
    [now],
  );
  useEffect(() => {
    if (selected && isExpired(selected)) {
      setSelected(null);
      setPreviewUrl(null);
    }
  }, [selected, isExpired]);

  useEffect(() => {
    setPreviewUrl(null);
    setPreviewError(null);
    if (!selected || selected.preview === "none") return;
    const controller = new AbortController();
    attachmentRequest<{ url: string }>(
      `/api/attachments/${selected.id}?preview=1`,
      undefined,
      controller.signal,
    )
      .then(({ url }) => setPreviewUrl(url))
      .catch((error) => {
        if (!controller.signal.aborted) setPreviewError(error.message);
      });
    return () => controller.abort();
  }, [selected]);

  const download = async (file: SharedAttachment) => {
    try {
      const { url } = await attachmentRequest<{ url: string }>(
        `/api/attachments/${file.id}`,
      );
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noreferrer";
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    }
  };
  if (!idsKey) return null;
  return (
    <div className="mt-2 max-w-full min-w-0">
      {error ? (
        <div className="text-xs">
          <p>{error}</p>
          <Button variant="link" onClick={() => setRetry((value) => value + 1)}>
            Retry attachments
          </Button>
        </div>
      ) : !files.length ? (
        <p role="status" className="text-xs">
          Loading attachments…
        </p>
      ) : null}
      <AttachmentGroup
        aria-label="Message attachments"
        className="flex-wrap overflow-visible"
      >
        {files.map((file) => {
          const expired = isExpired(file);
          const Icon = {
            image: ImageIcon,
            video: Film,
            audio: Music,
            pdf: FileText,
            none: FileIcon,
          }[file.preview];
          return (
            <Attachment
              key={file.id}
              className="w-64 max-w-full"
              state={expired ? "idle" : "done"}
            >
              <AttachmentMedia>
                <Icon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{file.name}</AttachmentTitle>
                <AttachmentDescription>
                  {expired
                    ? "Attachment expired"
                    : `${(file.size / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB · expires ${new Date(file.expiresAt).toLocaleString()}`}
                </AttachmentDescription>
              </AttachmentContent>
              {!expired && (
                <>
                  <AttachmentActions>
                    <AttachmentAction
                      type="button"
                      aria-label={`Download ${file.name}`}
                      onClick={() => void download(file)}
                    >
                      <Download />
                    </AttachmentAction>
                  </AttachmentActions>
                  <AttachmentTrigger
                    aria-label={`Preview ${file.name}`}
                    onClick={() => setSelected(file)}
                  />
                </>
              )}
            </Attachment>
          );
        })}
      </AttachmentGroup>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="break-all pr-6">
              {selected?.name}
            </DialogTitle>
            <DialogDescription>
              Original file · available for 24 hours after sending.
            </DialogDescription>
          </DialogHeader>
          {selected?.preview === "none" ? (
            <p className="text-sm">
              Preview is unavailable for this file type. Download the original
              to open it.
            </p>
          ) : previewError ? (
            <p role="alert" className="text-sm">
              {previewError}
            </p>
          ) : !previewUrl ? (
            <p role="status">Loading preview…</p>
          ) : (
            <>
              {selected?.preview === "image" && (
                <img
                  src={previewUrl}
                  alt={selected.name}
                  className="max-h-[65vh] w-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setPreviewError(
                      "Preview unavailable. Download the original file.",
                    )
                  }
                />
              )}
              {selected?.preview === "video" && (
                <video
                  src={previewUrl}
                  controls
                  preload="metadata"
                  className="max-h-[65vh] w-full"
                  onError={() =>
                    setPreviewError(
                      "Your browser cannot play this file. Download the original.",
                    )
                  }
                />
              )}
              {selected?.preview === "audio" && (
                <audio
                  src={previewUrl}
                  controls
                  preload="metadata"
                  className="w-full"
                  onError={() =>
                    setPreviewError(
                      "Your browser cannot play this file. Download the original.",
                    )
                  }
                />
              )}
              {selected?.preview === "pdf" && (
                <iframe
                  src={previewUrl}
                  title={`Preview ${selected.name}`}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  className="h-[65vh] w-full rounded border"
                />
              )}
            </>
          )}
          {selected && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void download(selected)}>
                <Download />
                Download original
              </Button>
              {selected.preview !== "none" && (
                <Button
                  variant="outline"
                  onClick={() => setSelected({ ...selected })}
                >
                  Reload preview
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
