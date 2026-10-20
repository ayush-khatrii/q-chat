# Attachments: setup guide

The application uploads original files directly to a **private Cloudflare R2 bucket**.
Next.js handles authorization and validation, not the 1 GB upload body. No files are
compressed or resized. Limits and supported formats live in `constants/attachments.ts`.

Use Node.js 22 or newer for development and deployment.

## 1. Create a private R2 bucket

In Cloudflare, open **R2 → Create bucket**. Leave the public `r2.dev` URL and public
custom domains disabled. Create an R2 API token with Object Read & Write permission
**for this bucket only**. Never use an account-wide token or expose it with a
`NEXT_PUBLIC_` environment variable.

Add the following values yourself to your local `.env` and deployment environment:

```dotenv
APP_URL=https://your-chat-app.example
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

`APP_URL` is your application's canonical URL (no trailing slash). Use
`http://localhost:3000` locally. It is checked against browser request origins and
used as the QStash callback destination. For local cleanup testing, QStash needs a
public HTTPS tunnel URL. Keep `BETTER_AUTH_URL` consistent with your sign-in domain.

Your existing `ABLY_API_KEY` must be **server-only**. Remove any old
`NEXT_PUBLIC_ABLY_API_KEY` from your deployment configuration and rotate the key if
it was previously shipped to browsers. The server now issues short-lived tokens
scoped to each user's joined rooms.

### Bucket CORS

Open the bucket's Settings → CORS policy. Replace the origin below with your
actual `APP_URL`; do not use `*`. Add `http://localhost:3000` only if needed for
local development. CORS restricts browsers; it is not the authorization mechanism.

```json
[
  {
    "AllowedOrigins": ["https://your-chat-app.example"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag", "Content-Range", "Accept-Ranges", "Content-Length"],
    "MaxAgeSeconds": 300
  }
]
```

As a fallback, configure an R2 lifecycle rule that aborts incomplete multipart
uploads after one day. This covers interruptions during upload initialization.
Do **not** configure deletion of completed objects one day after creation: the
24-hour clock starts when the file is sent, not when uploading begins.

## 2. Apply the database migration

```bash
npm install
npx prisma migrate deploy
npx prisma generate
```

The new tables store upload state, expiry, and request counters. Existing message
and attachment tables are preserved. Run migrations against the intended database
before enabling attachments. No migration or external resource is applied automatically.

## 3. Configure hourly QStash cleanup

Create a QStash project in Upstash. Copy the token and **both signing keys** into
the environment variables above. Deploy the application, then run:

```bash
npm run attachments:setup-cleanup
```

The command creates or updates one schedule for this app. Its cron expression is
`0 * * * *` (once per hour). It sends a POST to:

```text
https://your-chat-app.example/api/attachments/cleanup
```

The endpoint verifies QStash's signature, including the body and destination URL.
A normal browser request cannot trigger cleanup. Signature verification supports
current and next keys so QStash can rotate keys. Do not disable verification.

In the QStash console, check schedule delivery logs for 2xx responses. Cleanup
logs show examined/deleted/failed counts, never credentials or signed URLs. Failed
jobs return 500 so QStash retries; remaining batches enqueue signed continuation
jobs. If a callback is blocked by deployment protection, configure an appropriate
QStash-accessible production destination before enabling the schedule.

## 4. Check the feature

1. Sign in, open a joined room, and click the paperclip.
2. Select a supported file. Wait for **Ready**, then send it with or without text.
3. Open the room as another member. Click the card to preview; use its download
   button to save the original bytes. Office files, text/CSV, and ZIP are downloads.
4. Check the private bucket: files have random keys rather than user filenames.
5. Confirm unauthenticated requests and members of other rooms cannot access it.
6. Check QStash logs after an expired file is available for cleanup.

```bash
npm test
npx playwright install --with-deps chromium
npm run test:ui
npx tsc --noEmit
npm run build
```

A real R2/QStash end-to-end check requires your credentials; automated tests use
local stubs and do not provision cloud resources.

## Retention and security details

- Each file is at most **1,000,000,000 bytes**. Five files can be sent per message.
- Uploads are private until size/content checks pass and the server verifies the
  sender, room, IDs, and send time against the actual Ably message.
- A file is inaccessible to new requests **24 hours after sending**. Signed read
  URLs last at most 60 seconds and never extend past that deadline.
- Physical deletion normally happens on the next hourly job, between 24 and 25
  hours after sending. Outages can delay physical deletion; access still expires.
- Unsent uploads expire after one hour. Cancellation, rejection, message deletion,
  and room deletion make files unavailable and eligible for cleanup.
- Read URLs are short-lived bearer credentials. A removed member's already issued
  URL can work for its remaining lifetime. Already downloaded files cannot be erased.
- HTTPS and R2 encryption at rest protect transport and stored data. This is **not
  end-to-end encryption**. Original metadata (including EXIF) is preserved too.
- File signatures and bounded Office/ZIP directory checks reject obvious type
  mismatches without extracting archives. Large/unsupported ZIP directories,
  encrypted archives, and unsupported Office layouts are rejected.
- File validation is **not malware scanning**. Documents and archives can contain
  malicious content. They are download-only; PDFs use a sandboxed preview on the
  separate R2 origin. Some browsers block embedded PDF viewers; download instead.
- Browser video/audio codecs vary. Use the original download or reload the preview
  if a browser cannot play the file or requests a new range after URL expiry.
- New room members can access unexpired attachments in that room. Access is checked
  against current membership, not membership at send time.
- Uploads have bounded concurrency, pending quotas, and database-backed rate limits.
  Ably metadata is untrusted; only opaque IDs are used, never client-supplied URLs.
