# Private Space

Received whispers use one Ably Chat room per user: `qchat:private:<userId>`.
Ably Chat enables 30-day message persistence by default:
https://ably.com/docs/chat/rooms/history
There is no schema migration or separate whisper message store.

The auth endpoint grants subscribe/history access only to the user's own inbox.
The browser explicitly attaches in subscribe-only mode. All publishing uses the
server-side Chat SDK after session, origin, text, and shared-membership checks.
Sender identity and room details come from the server. Each delivery has a stable
ID scoped to sender, room, recipient, client draft ID, and original reply serial.
Retries inspect retained Chat history under a PostgreSQL advisory transaction lock
to serialize concurrent requests across instances; recipients also merge history
and live messages by that stable ID. The lock does not persist message data.

`POST /api/rooms/[roomId]/whispers` accepts `recipientIds`, `text` (1–4,000
characters, with non-whitespace content), and `clientMessageId` (UUID).
`POST /api/whispers/[serial]/reply` accepts `text` and `clientMessageId` and resolves
the original from the caller's own inbox. Responses contain per-recipient
`results` with `recipientId`, `delivered`, and an optional `error`. Keep the same
client message ID and text when retrying failed deliveries. A changed draft must
use a new ID. `APP_URL` or `BETTER_AUTH_URL` must match the browser origin.

Unread state is browser-local and scoped to the account. Counts wait for complete
history reconciliation. Cards are observed only in the visible, active Private
Space viewport. A collapsed long-message preview never marks the message seen.
Another device may have different unread counts. Privacy is access-controlled;
no additional end-to-end encryption is provided.

## Verification

Performed during implementation:

- TypeScript compilation (`tsc --noEmit`) and whitespace validation pass.
- The local home page responds HTTP 200.
- Both new POST endpoints respond HTTP 401 without a session.
- Reviewed capability construction, per-user inbox addressing, server-derived
  reply routing, and absence of whisper publishing to activity/public/push feeds.
- No automated test suites were executed.

The following checks require signed-in browser sessions and a configured Ably
application; they have not been exercised in this environment:

1. Sign in as A, B, C, and an unselected room admin. Send from A to B/C. Confirm
   only B/C receive copies and each sees no other recipients. Attempt subscribing
   to another user's inbox and publishing to one's own inbox; both must fail.
2. Send from several rooms; switch rooms, refresh, disconnect/reconnect, and
   verify the combined inbox, complete count, and duplicate-free replay.
3. Exercise Accept, Reject, and Ignore as an admin. Check red request counts and
   violet whisper counts independently, including 99+ labels with actual-count
   accessible labels. Incoming whispers must never change the open tab.
4. Inspect light/dark themes and a 320px viewport. Navigate tabs/dialogs by
   keyboard. Expand a multiline 4,000-character whisper and collapse it.
5. Keep a long preview collapsed; it stays unread. Expand and reveal its beginning;
   it becomes seen. Short cards become seen at 50% visibility. Inactive tabs,
   hidden documents, and closed panels must not clear whisper unread state.
6. Open two browser tabs, read different messages, and verify synchronized unread
   state. Disable storage and verify the in-memory fallback. Switch accounts and
   confirm the previous account's private state disappears immediately.
7. Reply from B to A; only A receives the new whisper. Leave/remove either user
   from the room: retained whispers remain readable, while sending/replying is
   unavailable. Verify the server also rejects stale membership requests.
8. Fail one recipient's delivery, then retry. Only failed recipients remain
   selected, the draft remains intact, and previously successful deliveries are
   not duplicated. Also retry after a lost HTTP response using the same draft ID.
