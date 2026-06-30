import * as z from "zod";

const dateTimeStringSchema = z.string().datetime();

export const userSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});

export const roomSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
});

export const roomMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  roomId: z.string(),
  joinedAt: dateTimeStringSchema,
  user: userSchema,
});

export const attachmentSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  mimeType: z.string(),
  name: z.string(),
  size: z.number().int(),
  url: z.string(),
  slug: z.string(),
  type: z.string(),
  createdAt: dateTimeStringSchema,
});

export const messageSchema = z.object({
  id: z.string(),
  content: z.string(),
  senderId: z.string(),
  roomId: z.string(),
  createdAt: dateTimeStringSchema,
  updatedAt: dateTimeStringSchema,
  sender: userSchema,
  attachments: z.array(attachmentSchema),
});

export const chatRoomResponseSchema = z.object({
  room: roomSchema,
  members: z.array(roomMemberSchema),
  messages: z.array(messageSchema),
});

export type ChatUser = z.infer<typeof userSchema>;
export type ChatRoom = z.infer<typeof roomSchema>;
export type ChatRoomMember = z.infer<typeof roomMemberSchema>;
export type ChatAttachment = z.infer<typeof attachmentSchema>;
export type ChatMessage = z.infer<typeof messageSchema>;
export type ChatRoomResponse = z.infer<typeof chatRoomResponseSchema>;

const ayush: ChatUser = {
  id: "user_ayush_khatri",
  name: "Ayush Khatri",
  email: "ayush@example.com",
  emailVerified: true,
  image: null,
  createdAt: "2026-06-29T18:30:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const oliver: ChatUser = {
  id: "user_oliver_rabbit",
  name: "Oliver Rabbit",
  email: "oliver@example.com",
  emailVerified: true,
  image: "/avatars/02.png",
  createdAt: "2026-06-29T18:35:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const olivia: ChatUser = {
  id: "user_olivia",
  name: "Olivia",
  email: "olivia@example.com",
  emailVerified: true,
  image: null,
  createdAt: "2026-06-29T18:40:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const ethan: ChatUser = {
  id: "user_ethan",
  name: "Ethan",
  email: "ethan@example.com",
  emailVerified: true,
  image: null,
  createdAt: "2026-06-29T18:45:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const sophia: ChatUser = {
  id: "user_sophia",
  name: "Sophia",
  email: "sophia@example.com",
  emailVerified: true,
  image: null,
  createdAt: "2026-06-29T18:50:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

export const mockChatRoomResponse = chatRoomResponseSchema.parse({
  room: {
    id: "room_general",
    code: "QC-ABCD",
    name: "General Room",
    ownerId: ayush.id,
    createdAt: "2026-06-29T18:30:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
  members: [
    {
      id: "member_ayush_general",
      userId: ayush.id,
      roomId: "room_general",
      joinedAt: "2026-06-29T18:30:00.000Z",
      user: ayush,
    },
    {
      id: "member_oliver_general",
      userId: oliver.id,
      roomId: "room_general",
      joinedAt: "2026-06-29T18:35:00.000Z",
      user: oliver,
    },
    {
      id: "member_olivia_general",
      userId: olivia.id,
      roomId: "room_general",
      joinedAt: "2026-06-29T18:40:00.000Z",
      user: olivia,
    },
    {
      id: "member_ethan_general",
      userId: ethan.id,
      roomId: "room_general",
      joinedAt: "2026-06-29T18:45:00.000Z",
      user: ethan,
    },
    {
      id: "member_sophia_general",
      userId: sophia.id,
      roomId: "room_general",
      joinedAt: "2026-06-29T18:50:00.000Z",
      user: sophia,
    },
  ],
  messages: [
    {
      id: "message_001",
      content: "Deploying to prod real quick.",
      senderId: ayush.id,
      roomId: "room_general",
      createdAt: "2026-06-30T21:31:00.000Z",
      updatedAt: "2026-06-30T21:31:00.000Z",
      sender: ayush,
      attachments: [],
    },
    {
      id: "message_002",
      content: "It's 4:55 PM. On a Friday.",
      senderId: oliver.id,
      roomId: "room_general",
      createdAt: "2026-06-30T21:32:00.000Z",
      updatedAt: "2026-06-30T21:32:00.000Z",
      sender: oliver,
      attachments: [],
    },
    {
      id: "message_003",
      content: "It's a one-line change.",
      senderId: ayush.id,
      roomId: "room_general",
      createdAt: "2026-06-30T21:33:00.000Z",
      updatedAt: "2026-06-30T21:33:00.000Z",
      sender: ayush,
      attachments: [],
    },
    {
      id: "message_004",
      content: "ok",
      senderId: oliver.id,
      roomId: "room_general",
      createdAt: "2026-06-30T21:34:00.000Z",
      updatedAt: "2026-06-30T21:34:00.000Z",
      sender: oliver,
      attachments: [],
    },
    {
      id: "message_005",
      content: "Alright, let me take a look.",
      senderId: oliver.id,
      roomId: "room_general",
      createdAt: "2026-06-30T21:35:00.000Z",
      updatedAt: "2026-06-30T21:35:00.000Z",
      sender: oliver,
      attachments: [],
    },
  ],
} satisfies ChatRoomResponse);
