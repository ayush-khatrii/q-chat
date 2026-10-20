// Shared by the browser and the server. Never put credentials in this file.
export const ATTACHMENT_CONFIG = {
  maxFileNameLength: 240,
  maxRequestBytes: 16_384,
  maxZipEntries: 20_000,
  partAttempts: 3,
  partRetryDelayMs: 500,
  partTimeoutMs: 5 * 60_000,
  maxFileBytes: 1_000_000_000,
  maxFilesPerMessage: 5,
  partBytes: 16 * 1024 * 1024,
  parallelParts: 3,
  uploadUrlSeconds: 300,
  readUrlSeconds: 60,
  retentionMs: 24 * 60 * 60 * 1000,
  unsentRetentionMs: 60 * 60 * 1000,
  maxPendingPerUser: 5,
  maxUploadsPerHour: 30,
  maxRequestsPerMinute: 600,
  cleanupBatchSize: 50,
  cleanupCron: "0 * * * *",
  signatureBytes: 8192,
  maxZipDirectoryBytes: 4 * 1024 * 1024,
} as const;

export const ATTACHMENT_TYPES = {
  jpg: { mime: "image/jpeg", preview: "image" },
  jpeg: { mime: "image/jpeg", preview: "image" },
  png: { mime: "image/png", preview: "image" },
  webp: { mime: "image/webp", preview: "image" },
  gif: { mime: "image/gif", preview: "image" },
  mp4: { mime: "video/mp4", preview: "video" },
  webm: { mime: "video/webm", preview: "video" },
  mp3: { mime: "audio/mpeg", preview: "audio" },
  wav: { mime: "audio/wav", preview: "audio" },
  pdf: { mime: "application/pdf", preview: "pdf" },
  doc: { mime: "application/msword", preview: "none" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    preview: "none",
  },
  xls: { mime: "application/vnd.ms-excel", preview: "none" },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    preview: "none",
  },
  ppt: { mime: "application/vnd.ms-powerpoint", preview: "none" },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    preview: "none",
  },
  txt: { mime: "text/plain", preview: "none" },
  csv: { mime: "text/csv", preview: "none" },
  zip: { mime: "application/zip", preview: "none" },
} as const;

export type AttachmentExtension = keyof typeof ATTACHMENT_TYPES;
export type AttachmentPreview =
  (typeof ATTACHMENT_TYPES)[AttachmentExtension]["preview"];
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");

export function attachmentType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (
    !extension ||
    !Object.prototype.hasOwnProperty.call(ATTACHMENT_TYPES, extension)
  )
    return null;
  return {
    extension: extension as AttachmentExtension,
    ...ATTACHMENT_TYPES[extension as AttachmentExtension],
  };
}

export function validateAttachment(name: string, size: number, mime: string) {
  const type = attachmentType(name);
  if (
    !name.trim() ||
    name.length > ATTACHMENT_CONFIG.maxFileNameLength ||
    /[\x00-\x1f\x7f/\\]/.test(name)
  )
    throw new Error("Invalid file name.");
  if (!type) throw new Error("This file type is not allowed.");
  if (
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > ATTACHMENT_CONFIG.maxFileBytes
  )
    throw new Error("Each file must be between 1 byte and 1 GB.");
  // Some browsers supply an empty or generic MIME type, especially for Office files.
  const aliases: Record<string, string[]> = {
    "audio/wav": ["audio/x-wav", "audio/wave"],
    "application/zip": ["application/x-zip-compressed"],
  };
  if (
    mime &&
    mime !== "application/octet-stream" &&
    mime !== type.mime &&
    !aliases[type.mime]?.includes(mime)
  )
    throw new Error("The file extension and content type do not match.");
  return type;
}

export type SharedAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  preview: AttachmentPreview;
  expiresAt: string;
  state: "ready" | "expired" | "processing";
};

export function attachmentIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const ids = (metadata as Record<string, unknown>).attachmentIds;
  if (!Array.isArray(ids) || ids.length > ATTACHMENT_CONFIG.maxFilesPerMessage)
    return [];
  return [
    ...new Set(
      ids.filter(
        (id): id is string =>
          typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id),
      ),
    ),
  ];
}
