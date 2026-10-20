"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ATTACHMENT_CONFIG, validateAttachment } from "@/constants/attachments";
import { attachmentRequest, uploadAttachment } from "@/lib/attachments/client";

export type QueuedAttachment = {
  key: string;
  file: File;
  id?: string;
  state: "uploading" | "processing" | "done" | "error";
  progress: number;
  error?: string;
  expiresAt?: string;
};

export function useAttachmentUploads(roomId: string) {
  const [files, setFiles] = useState<QueuedAttachment[]>([]);
  const active = useRef(
    new Map<string, { controller: AbortController; id?: string }>(),
  );
  const filesRef = useRef(files);
  filesRef.current = files;

  const patch = (key: string, change: Partial<QueuedAttachment>) =>
    setFiles((items) =>
      items.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  const cancelStored = (id?: string) => {
    if (id)
      void attachmentRequest(`/api/attachments/${id}`, {
        action: "cancel",
      }).catch(() => {});
  };

  const run = useCallback(
    async (item: QueuedAttachment) => {
      const operation: { controller: AbortController; id?: string } = {
        controller: new AbortController(),
      };
      active.current.set(item.key, operation);
      patch(item.key, { state: "uploading", error: undefined, progress: 0 });
      try {
        const id = await uploadAttachment(
          item.file,
          roomId,
          operation.controller.signal,
          (id, expiresAt) => {
            operation.id = id;
            patch(item.key, { id, expiresAt });
          },
          (progress) => patch(item.key, { progress }),
          () => patch(item.key, { state: "processing" }),
        );
        patch(item.key, { id, state: "done", progress: 100 });
      } catch (error) {
        operation.controller.abort();
        cancelStored(operation.id);
        patch(item.key, {
          state: "error",
          id: undefined,
          error: error instanceof Error ? error.message : "Upload failed.",
        });
      } finally {
        active.current.delete(item.key);
      }
    },
    [roomId],
  );

  const add = (selected: FileList | File[]) => {
    const available =
      ATTACHMENT_CONFIG.maxFilesPerMessage - filesRef.current.length;
    if (selected.length > available)
      toast.error("You can attach up to five files per message.");
    const additions: QueuedAttachment[] = [];
    for (const file of Array.from(selected).slice(0, Math.max(0, available))) {
      try {
        validateAttachment(file.name, file.size, file.type);
        additions.push({
          key: crypto.randomUUID(),
          file,
          state: "uploading",
          progress: 0,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Invalid file.");
      }
    }
    filesRef.current = [...filesRef.current, ...additions];
    setFiles(filesRef.current);
    for (const item of additions) void run(item);
  };
  const remove = (item: QueuedAttachment) => {
    const operation = active.current.get(item.key);
    operation?.controller.abort();
    cancelStored(operation?.id ?? item.id);
    setFiles((items) => items.filter((file) => file.key !== item.key));
  };
  useEffect(() => {
    const expire = () => {
      const expired = filesRef.current.filter(
        (item) =>
          item.state !== "error" &&
          item.expiresAt &&
          Date.parse(item.expiresAt) <= Date.now(),
      );
      if (!expired.length) return;
      for (const item of expired)
        active.current.get(item.key)?.controller.abort();
      setFiles((items) =>
        items.map((item) =>
          expired.some((file) => file.key === item.key)
            ? {
                ...item,
                state: "error",
                error: "Unsent upload expired. Remove it or retry.",
              }
            : item,
        ),
      );
    };
    const interval = setInterval(expire, 5000);
    document.addEventListener("visibilitychange", expire);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", expire);
    };
  }, []);

  useEffect(() => {
    const operations = active.current;
    return () => {
      for (const operation of operations.values()) {
        operation.controller.abort();
        cancelStored(operation.id);
      }
    };
  }, []);
  return {
    files,
    add,
    remove,
    retry: (item: QueuedAttachment) => void run(item),
    clear: () => setFiles([]),
    ready: files.every((file) => file.state === "done" && file.id),
  };
}
