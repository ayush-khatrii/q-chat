"use client";
import { ATTACHMENT_CONFIG } from "@/constants/attachments";

// All selected files share three upload slots, rather than three slots per file.
let runningParts = 0;
const waitingParts: Array<() => void> = [];

function takeUploadSlot() {
  return new Promise<void>((resolve) => {
    if (runningParts < ATTACHMENT_CONFIG.parallelParts) {
      runningParts++;
      resolve();
    } else {
      waitingParts.push(resolve);
    }
  });
}

function releaseUploadSlot() {
  const next = waitingParts.shift();
  if (next) next();
  else runningParts--;
}

export async function attachmentRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Attachment request failed.");
  return result as T;
}

function uploadPart(
  url: string,
  part: Blob,
  signal: AbortSignal,
  progress: (bytes: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    xhr.open("PUT", url);
    xhr.timeout = ATTACHMENT_CONFIG.partTimeoutMs;
    xhr.upload.onprogress = (event) => progress(event.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? finish()
        : finish(new Error("Part upload failed."));
    xhr.onerror = () => finish(new Error("Upload connection failed."));
    xhr.ontimeout = () => finish(new Error("Upload timed out."));
    xhr.onabort = () =>
      finish(new DOMException("Upload cancelled.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      finish(new DOMException("Upload cancelled.", "AbortError"));
      return;
    }
    xhr.send(part);
  });
}

export async function uploadAttachment(
  file: File,
  roomId: string,
  signal: AbortSignal,
  onId: (id: string, expiresAt: string) => void,
  onProgress: (percent: number) => void,
  onProcessing: () => void,
) {
  const upload = await attachmentRequest<{
    id: string;
    partBytes: number;
    expiresAt: string;
  }>(
    "/api/attachments",
    {
      action: "initiate",
      roomId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    },
    signal,
  );
  onId(upload.id, upload.expiresAt);
  const count = Math.ceil(file.size / upload.partBytes);
  const bytes = Array<number>(count).fill(0);
  let nextPart = 0;
  const worker = async () => {
    while (nextPart < count) {
      const index = nextPart++;
      const part = file.slice(
        index * upload.partBytes,
        Math.min(file.size, (index + 1) * upload.partBytes),
      );
      for (
        let attempt = 0;
        attempt < ATTACHMENT_CONFIG.partAttempts;
        attempt++
      ) {
        await takeUploadSlot();
        try {
          const { url } = await attachmentRequest<{ url: string }>(
            `/api/attachments/${upload.id}`,
            { action: "sign", partNumber: index + 1 },
            signal,
          );
          await uploadPart(url, part, signal, (loaded) => {
            bytes[index] = loaded;
            onProgress(
              Math.min(
                100,
                Math.round(
                  (bytes.reduce((sum, value) => sum + value, 0) / file.size) *
                    100,
                ),
              ),
            );
          });
          bytes[index] = part.size;
          break;
        } catch (error) {
          if (signal.aborted || attempt === ATTACHMENT_CONFIG.partAttempts - 1)
            throw error;
          bytes[index] = 0;
          // Every retry obtains a fresh short-lived signature.
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              ATTACHMENT_CONFIG.partRetryDelayMs * (attempt + 1),
            ),
          );
        } finally {
          releaseUploadSlot();
        }
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(ATTACHMENT_CONFIG.parallelParts, count) },
      worker,
    ),
  );
  onProcessing();
  await attachmentRequest(
    `/api/attachments/${upload.id}`,
    { action: "complete" },
    signal,
  );
  return upload.id;
}
