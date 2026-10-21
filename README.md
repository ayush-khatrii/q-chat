# QChat

QChat is a real-time, room-based chat app built with Next.js, Ably Chat, and PostgreSQL. Sign in with Google, create a room, and share its code to start a conversation.

## Features

- Google sign-in through Better Auth.
- Create rooms with generated or custom `QC-` codes and join by code.
- Two members per room, including the creator.
- Real-time messages, typing indicators, and online presence.
- Paginated message history, with older messages loaded on scroll or by button.
- Read receipts with live updates and database persistence.
- Copy and delete messages.
- Custom room colors and background patterns.
- Browser push notifications through Firebase Cloud Messaging (FCM).
- Private Cloudflare R2 file attachments, previews, and 24-hour expiry with hourly QStash cleanup.

Message editing currently shows a “coming soon” notice. See the [attachment setup guide](docs/attachments.md) to configure R2, the required environment variables, and scheduled cleanup.

## Tech stack

| Area | Technology |
| --- | --- |
| Application | Next.js 16.2.9 App Router, React 19.2.4, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI |
| Real-time chat | Ably Realtime and Ably Chat SDK |
| Authentication | Better Auth and Google OAuth |
| Database | PostgreSQL, Prisma 7, PostgreSQL driver adapter |
| Client data fetching | TanStack Query |
| Notifications | Firebase browser SDK and Firebase Admin SDK |
| File attachments | Private Cloudflare R2 storage and Upstash QStash cleanup |


