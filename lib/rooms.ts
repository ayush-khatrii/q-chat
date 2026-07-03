import { z } from "zod";

export const ROOM_CODE_PREFIX = "QC-";
export const ROOM_CODE_LENGTH = 6;
export const MAX_CUSTOM_ROOM_CODE_LENGTH = 20;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

export const createRoomSchema = z.object({
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
}).superRefine((value, context) => {
  const normalizedCode = normalizeCustomRoomCode(value.customCode);

  if (
    normalizedCode &&
    normalizedCode.length > MAX_CUSTOM_ROOM_CODE_LENGTH
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customCode"],
      message: `Room code must be ${MAX_CUSTOM_ROOM_CODE_LENGTH} characters or less including QC-.`,
    });
  }
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
