import { Receiver } from "@upstash/qstash";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { cleanupAttachments } from "@/lib/attachments/cleanup";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Check at request time, not import time, so builds work without secrets.
  if (
    !process.env.QSTASH_CURRENT_SIGNING_KEY ||
    !process.env.QSTASH_NEXT_SIGNING_KEY ||
    !process.env.APP_URL
  )
    return Response.json(
      { error: "QStash signing keys and APP_URL are required." },
      { status: 503 },
    );
  const destination = `${process.env.APP_URL.replace(/\/$/, "")}/api/attachments/cleanup`;
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    devMode: false,
  });
  const handler = verifySignatureAppRouter(
    async (verifiedRequest: Request) => {
      // The App Router wrapper currently omits the URL when verifying.
      // Verify it explicitly too, so tokens for other endpoints cannot be reused.
      await receiver.verify({
        signature: verifiedRequest.headers.get("upstash-signature")!,
        body: await verifiedRequest.text(),
        url: destination,
      });
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
      url: destination,
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
