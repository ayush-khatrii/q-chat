import { z } from "zod";

export const ROOM_CODE_PREFIX = "QC-";
export const ROOM_CODE_LENGTH = 6;
export const MAX_CUSTOM_ROOM_CODE_LENGTH = 20;
export const MAX_ROOM_MEMBERS = 2;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const themeColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const bubbleColorSchema = z.union([themeColorSchema, z.literal("primary")]);
const bubbleBorderSchema = z
  .union([themeColorSchema, z.literal("none")])
  .default("none");

export const roomThemeSchema = z.object({
  surface: themeColorSchema,
  outgoingBubble: bubbleColorSchema,
  outgoingText: themeColorSchema,
  outgoingBorder: bubbleBorderSchema,
  incomingBubble: bubbleColorSchema,
  incomingText: themeColorSchema,
  incomingBorder: bubbleBorderSchema,
  pattern: z.enum(["none", "hearts", "grid", "lines", "dots"]),
  patternColor: themeColorSchema,
  patternOpacity: z.enum(["subtle", "soft", "visible"]),
});

export type RoomTheme = z.infer<typeof roomThemeSchema>;

export const DEFAULT_ROOM_THEME: RoomTheme = {
  surface: "#000000",
  outgoingBubble: "primary",
  outgoingText: "#efefef",
  outgoingBorder: "none",
  incomingBubble: "#262626",
  incomingText: "#efefef",
  incomingBorder: "none",
  pattern: "none",
  patternColor: "#ffffff",
  patternOpacity: "subtle",
};

export function normalizeRoomTheme(value: unknown): RoomTheme {
  const parsed = roomThemeSchema.safeParse(value);
  if (!parsed.success) return DEFAULT_ROOM_THEME;

  // Recognize complete historical default palettes, not individual color choices.
  const oldWhiteTheme = {
    ...DEFAULT_ROOM_THEME,
    outgoingBubble: "#ffffff",
    outgoingText: "#09090b",
    incomingText: "#fafafa",
    outgoingBorder: "#a3a3a3",
    incomingBorder: "#a3a3a3",
  };
  const previousDefaults = [
    { ...oldWhiteTheme, incomingBubble: "#000000" },
    { ...oldWhiteTheme, incomingBubble: "#262626" },
    {
      ...DEFAULT_ROOM_THEME,
      outgoingBubble: "#262626",
      incomingBubble: "primary",
      outgoingBorder: "#a3a3a3",
      incomingBorder: "#a3a3a3",
    },
  ];
  const stored = value as Record<string, unknown>;
  // Missing borders belonged to older versions. Explicit "none" is a user choice.
  const previousTheme = {
    ...parsed.data,
    outgoingBorder: stored.outgoingBorder ?? "#a3a3a3",
    incomingBorder: stored.incomingBorder ?? "#a3a3a3",
  };
  const isPreviousDefault = previousDefaults.some((previous) =>
    Object.entries(previous).every(
      ([key, color]) =>
        String(previousTheme[key as keyof RoomTheme]).toLowerCase() === color,
    ),
  );
  return isPreviousDefault ? { ...DEFAULT_ROOM_THEME } : parsed.data;
}

export function normalizeCustomRoomCode(code?: string | null) {
  const trimmedCode = code?.trim();

  if (!trimmedCode) {
    return null;
  }

  const upperCode = trimmedCode.toUpperCase();

  return upperCode.startsWith(ROOM_CODE_PREFIX)
    ? upperCode
    : `${ROOM_CODE_PREFIX}${upperCode}`;
}

export const createRoomSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Room name must be at least 3 characters long.")
      .max(50, "Room name must be 50 characters or less."),
    customCode: z
      .string()
      .trim()
      .max(
        MAX_CUSTOM_ROOM_CODE_LENGTH,
        `Custom room code must be ${MAX_CUSTOM_ROOM_CODE_LENGTH} characters or less.`,
      )
      .regex(
        /^[A-Za-z0-9-]*$/,
        "Room code can only include letters, numbers, and hyphens.",
      )
      .optional(),
  })
  .superRefine((value, context) => {
    const normalizedCode = normalizeCustomRoomCode(value.customCode);

    if (normalizedCode && normalizedCode.length > MAX_CUSTOM_ROOM_CODE_LENGTH) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customCode"],
        message: `Room code must be ${MAX_CUSTOM_ROOM_CODE_LENGTH} characters or less including QC-.`,
      });
    }
  });

export const joinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a room code.")
    .transform((code) => normalizeCustomRoomCode(code) ?? ""),
});

export type UserRoomMember = {
  id: string;
  userId: string;
  roomId: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

export type UserRoom = {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  isOwner: boolean;
  memberCount: number;
  members: UserRoomMember[];
  theme: RoomTheme;
  createdAt: string;
  updatedAt: string;
};

export function generateRoomCode() {
  let suffix = "";
  const randomValues = new Uint32Array(ROOM_CODE_LENGTH);

  globalThis.crypto.getRandomValues(randomValues);

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const randomIndex = randomValues[index] % ROOM_CODE_ALPHABET.length;
    suffix += ROOM_CODE_ALPHABET[randomIndex];
  }

  return `${ROOM_CODE_PREFIX}${suffix}`;
}
