# QChat

QChat is a real-time, room-based chat app built with Next.js, Ably Chat, and PostgreSQL. Sign in with Google, create a room, and share its code to start a conversation.

## Features

- Google sign-in through Better Auth.
- Create rooms with generated or custom `QC-` codes and join by code.
- Two members per room, including the creator.
- Real-time text messages, typing indicators, and online presence.
- Paginated message history, with older messages loaded on scroll or by button.
- Read receipts with live updates and database persistence.
- Copy and delete messages.
- Custom room colors and background patterns.
- Browser push notifications through Firebase Cloud Messaging (FCM).

Message editing currently shows a “coming soon” notice. Attachment models exist in the database schema, but the current chat composer sends text messages.

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

## Getting started

### Prerequisites

- Node.js 20.19+ (a recent supported LTS release is recommended) and npm.
- A PostgreSQL database.
- An Ably application and API key configured for Chat.
- A Google OAuth web client.
- A Firebase project with a registered web app, Cloud Messaging web push credentials, and a service account for notification sending.

### 1. Install dependencies

```bash
git clone https://github.com/ayush-khatrii/q-chat.git
cd q-chat
npm ci
```

### 2. Configure environment variables

Create `.env` in the repository root. Prisma's CLI configuration loads `.env` through `dotenv/config`; Next.js also reads it. Use your own values:

```dotenv
# PostgreSQL
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/qchat"

# Better Auth
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="replace-with-a-random-secret-at-least-32-characters-long"

# Google OAuth (use the same client ID for both)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id"

# Ably: server-only API key
ABLY_API_KEY="your-ably-api-key"

# Firebase web app configuration
NEXT_PUBLIC_API_KEY="your-firebase-web-api-key"
NEXT_PUBLIC_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_PROJECT_ID="your-firebase-project-id"
NEXT_PUBLIC_STORAGE_BUCKET="your-firebase-storage-bucket"
NEXT_PUBLIC_MESSAGING_SENDER_ID="your-messaging-sender-id"
NEXT_PUBLIC_APP_ID="your-firebase-app-id"
NEXT_PUBLIC_VAPID_KEY="your-firebase-web-push-public-key"

# Firebase Admin service account
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="your-service-account-email"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

`NEXT_PUBLIC_MEASUREMENT_ID` is optional for the Firebase Analytics configuration in `lib/firebase.ts`.

For databases that use a connection pooler, optionally set `DIRECT_URL` or `DATABASE_URL_UNPOOLED` to a direct database connection for migrations. `prisma.config.ts` prefers `DIRECT_URL`, then `DATABASE_URL_UNPOOLED`, then `DATABASE_URL`. For Neon, it removes the `-pooler` hostname suffix when deriving the migration URL. Application queries continue to use `DATABASE_URL`.

Keep database credentials, auth secrets, the Google client secret, Ably API keys, and Firebase Admin credentials server-side. Use `ABLY_API_KEY`: the auth endpoint supports a legacy `NEXT_PUBLIC_ABLY_API_KEY` fallback, but public-prefixed variables can be exposed in browser bundles. Do not commit your `.env`.

### 3. Configure Google sign-in

In your Google OAuth web client, add:

- Authorized JavaScript origin: `http://localhost:3000`.
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.

Add the equivalent origin and callback URL for your deployed domain. Set `BETTER_AUTH_URL` to that domain in production.

### 4. Configure Firebase notifications

Copy your Firebase web app configuration into the environment variables above. Generate a web push key pair in Firebase Cloud Messaging and use its public key as `NEXT_PUBLIC_VAPID_KEY`. Set the Admin variables from a service account belonging to the same project.

**Also update the Firebase configuration in [public/firebase-messaging-sw.js](public/firebase-messaging-sw.js).** This static service worker currently contains a fixed project configuration; it does not read Next.js environment variables. Its project must match the browser configuration and Admin credentials.

Push notifications require a supported browser, notification permission, and a secure context (HTTPS in production; localhost works for development). Foreground push messages are logged without an additional popup; the service worker handles background notification display and opens the room when clicked.

### 5. Initialize the database and run the app

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and create a room. Sign in with another account in a separate browser or browser profile and join using the room code.

`prisma migrate deploy` applies the checked-in migrations. When deliberately changing the schema during development, use `npx prisma migrate dev --name your_change` to create a new migration.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Generate Prisma Client and build Next.js with webpack |
| `npm start` | Serve an existing production build |
| `npx prisma generate` | Generate the client in `app/generated/prisma` |
| `npx prisma migrate deploy` | Apply committed database migrations |
| `npx tsx --test tests/read-receipts.test.cjs` | Run the read-receipt tests |

There are currently no `lint` or `test` scripts in `package.json`.

## How it works

1. Better Auth handles Google sign-in and stores users, accounts, and sessions in PostgreSQL.
2. Authenticated API routes create rooms and manage memberships.
3. The browser obtains an Ably token from `/api/ably/auth` and connects through the Ably and Chat providers.
4. Chat messages and history are sent and loaded through Ably Chat. PostgreSQL stores room metadata, memberships, themes, and read receipts; the existence of `Message` and `Attachment` models does not mean the current chat flow saves messages there.
5. Read receipts are published over a room-scoped Ably channel and saved through `/api/rooms/[roomId]/reads`. Pending receipts are retried independently of message delivery.
6. The browser registers an FCM token. After sending a message, it requests notifications for the other room member's registered devices.

Message-history availability depends on your Ably configuration and service limits.

## Project structure

```text
app/
  (root)/            Chat, profile, appearance, and information pages
  api/               Auth, Ably tokens, rooms, receipts, users, and FCM endpoints
components/
  chat/              Room UI, message bubbles, and appearance controls
  auth/              Google sign-in and account UI
  ui/                Shared UI components
hooks/               Room data and read-receipt hooks
lib/                 Auth, database, Firebase, room, and receipt utilities
prisma/              Database schema and migration history
providers/           Ably and TanStack Query providers
public/              Static assets and Firebase messaging service worker
tests/               Read-receipt tests
```

## Deployment

For a Next.js host such as Vercel:

1. Configure the environment variables for the production domain and services.
2. Add your production domain to the Google OAuth configuration.
3. Match the service worker's Firebase configuration to your project.
4. Apply migrations to the production database with `npx prisma migrate deploy` as a controlled deployment step.
5. Build with `npm run build` and use the host's Next.js runtime.

The build generates Prisma Client but **does not apply database migrations**. Public-prefixed environment variables are included at build time, so rebuild after changing Firebase web configuration or the public Google client ID. Firebase Admin credentials must be available to the server runtime.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Google redirect mismatch | The callback must exactly match `/api/auth/callback/google` on the configured domain |
| Prisma Client import missing | Run `npx prisma generate` before starting development |
| Missing database tables or receipt errors | Apply the committed migrations to the database the app uses |
| Migration connection or locking errors | Provide a direct connection through `DIRECT_URL` or `DATABASE_URL_UNPOOLED` |
| Ably connection fails | Sign in first, check `ABLY_API_KEY`, and inspect the response from `/api/ably/auth` |
| Room join returns “full” | Rooms currently support two members including the owner |
| Background notifications do not arrive | Check permission, HTTPS, VAPID key, saved FCM tokens, Admin credentials, and matching service worker configuration |

## Contributing

Use a branch for your changes and open a pull request. Include a description of the behavior changed and the checks you ran. Commit a Prisma migration alongside schema changes, and run the read-receipt tests when modifying that flow.

## License

No license file is currently included in this repository.
