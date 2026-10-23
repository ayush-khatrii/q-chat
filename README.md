# QChat

QChat is a real-time, room-based chat app built with Next.js, Ably Chat, and PostgreSQL. Sign in with Google, create a room, and share its code to start a conversation.

## Features

- Google sign-in through Better Auth.
- Create rooms with generated or custom `QC-` codes and join by code.
- Up to 50 members per room with realtime admin-approved join requests.
- Super Admin, Admin, and Member roles with a room-specific admin join-request inbox.
- Real-time messages, typing indicators, and online presence.
- Paginated message history, with older messages loaded on scroll or by button.
- Read receipts with live updates and database persistence.
- Copy and delete messages.
- Custom room colors and background patterns.
- Browser push notifications through Firebase Cloud Messaging (FCM).
- Private Cloudflare R2 file attachments, previews, and 24-hour expiry with hourly QStash cleanup.

## Tech stack

| Area                 | Technology                                               |
| -------------------- | -------------------------------------------------------- |
| Application          | Next.js 16.2.9 App Router, React 19.2.4, TypeScript      |
| Styling              | Tailwind CSS 4, shadcn/ui, Radix UI                      |
| Real-time chat       | Ably Realtime and Ably Chat SDK                          |
| Authentication       | Better Auth and Google OAuth                             |
| Database             | PostgreSQL, Prisma 7, PostgreSQL driver adapter          |
| Client data fetching | TanStack Query                                           |
| Notifications        | Firebase browser SDK and Firebase Admin SDK              |
| File attachments     | Private Cloudflare R2 storage and Upstash QStash cleanup |

## Install, invites, and message actions

- QChat is installable from the homepage or chat menu. Android/desktop browsers can show a native install prompt; iPhone users get Safari Add to Home Screen instructions. Chatting still requires internet access.
- The existing Firebase service worker handles push and caches only `/offline.html`. Private pages, API responses and attachments are not cached by the worker.
- Share links use `/join/QC-…`. Recipients sign in and request access; a room admin approves them before chat access is granted. Older `/chat/QC-…` links lead nonmembers through the same request flow.
- Senders can edit message text through Ably Chat. Attachment metadata stays intact. Emoji reactions use Ably's `Distinct` type and persisted summaries; no reaction database is required. Reaction retention follows the message's Ably retention.
- Set `NEXT_PUBLIC_APP_URL` to the public HTTPS production origin before building. Public canonical URLs, sitemap and social images use it. Set `BETTER_AUTH_URL` to the same deployment origin and configure the Google OAuth callback and `BETTER_AUTH_SECRET` as usual.
- Public informational pages are indexed; room, invite, user and settings routes use `noindex`. The social image is generated at `/opengraph-image`.

## Realtime membership setup

- Set `JOIN_REQUEST_SECRET` to a long random value. When omitted, QChat uses `BETTER_AUTH_SECRET` to sign 15-minute join request tickets.
- In the Ably dashboard, enable persisted history for `qchat:room:*:activity`, `qchat:room:*:join-requests`, and `qchat:user:*:room-events` channels with retention of at least 15 minutes. The application never stores pending requests in PostgreSQL.
- Enable **revocable tokens** for the API key supplied as `ABLY_API_KEY`. Removed members otherwise retain their existing short-lived capability until its 60-second expiry.
- Firebase credentials and browser permission are optional for membership. They add background alerts; the authoritative request and notification feed always comes from Ably.

### Release verification

Run `npm test`, `npm run test:ui`, `npx tsc --noEmit`, and `npm run build`. In a deployment with real credentials, verify Google sign-in returns to the invitation, a second account joins only after confirmation, both clients see edits/reactions after reload, installation works on target devices, and background notification clicks still open the right room. Browser fixture tests mock Ably and OAuth; they do not replace this live check.

The bell shows only pending join requests for the open room to its Admins and Super Admin. Seen and ignored requests are remembered per account and room in this browser; Ignore does not affect other admins. Only cards at least half visible in the open panel in a visible tab clear their unread badge. Deploy request publishing, Ably permissions, and the client together; requests pending during the channel transition may need resubmission.
