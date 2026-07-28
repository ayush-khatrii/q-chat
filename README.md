# QChat — Real-time Room-Based Chat

Built with Next.js 15, Ably Chat SDK, Prisma, and Firebase Cloud Messaging.

## Architecture
- **Realtime messaging**: Ably (WebSocket-based, handles presence, typing, history)
- **Auth**: Better Auth with Google OAuth
- **Database**: PostgreSQL via Prisma ORM
- **Push notifications**: Firebase Cloud Messaging (FCM)
- **Deployment**: Vercel (serverless)

## Features
- Create/join rooms with custom codes
- Real-time messaging with typing indicators
- Online presence (who's in the room)
- Message history with paginated infinite scroll
- Push notifications when app is in background