import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { cleanupAttachments } from "@/lib/attachments/cleanup";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Check at request time, not import time, so builds work without secrets.
  if (
    !process.env.QSTASH_CURRENT_SIGNING_KEY ||
    !process.env.QSTASH_NEXT_SIGNING_KEY
  )
    return Response.json(
      { error: "QStash signing keys are not configured." },
      { status: 503 },
    );
  const handler = verifySignatureAppRouter(
    async () => {
      try {
        return Response.json(await cleanupAttachments());
      } catch {
        return Response.json(
          { error: "Cleanup failed and will be retried." },
          { status: 500 },
        );
      }
    },
    {
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
      devMode: false,
      url: process.env.APP_URL
        ? `${process.env.APP_URL.replace(/\/$/, "")}/api/attachments/cleanup`
        : undefined,
    },
  );
  try {
    return await handler(request);
  } catch {
    // The SDK throws on a valid JWT whose body or destination was tampered with.
    return Response.json(
      { error: "Invalid QStash signature." },
      { status: 403 },
    );
  }
}
