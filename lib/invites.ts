import {
  normalizeCustomRoomCode,
  MAX_CUSTOM_ROOM_CODE_LENGTH,
} from "@/lib/rooms";

export function parseInviteCode(value: string, origin?: string): string | null {
  let input = value.trim();
  if (/^https?:\/\//i.test(input) || input.startsWith("/")) {
    if (!origin) return null;
    try {
      const url = new URL(input, origin);
      if (url.origin !== origin || url.search || url.hash) return null;
      const match = /^\/(?:join|chat)\/([^/]+)\/?$/.exec(url.pathname);
      if (!match) return null;
      input = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  const code = normalizeCustomRoomCode(input);
  return code &&
    code.length <= MAX_CUSTOM_ROOM_CODE_LENGTH &&
    /^QC-[A-Z0-9-]+$/.test(code)
    ? code
    : null;
}

// Only invite destinations may be used as OAuth callbacks here.
export function inviteDestination(code: string) {
  const parsed = parseInviteCode(code);
  return parsed ? `/join/${encodeURIComponent(parsed)}` : "/chat";
}
