"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_ROOM_THEME,
  normalizeRoomTheme,
  type RoomTheme,
} from "@/lib/rooms";

export const ROOM_THEME_PRESETS: Record<string, RoomTheme> = {
  midnight: DEFAULT_ROOM_THEME,
  hearts: {
    surface: "#09070a",
    outgoingBubble: "#9d174d",
    outgoingText: "#fff1f2",
    incomingBubble: "#2a1722",
    incomingText: "#fce7f3",
    pattern: "hearts",
    patternColor: "#f472b6",
    patternOpacity: "soft",
  },
  paper: {
    surface: "#efeae2",
    outgoingBubble: "#d9fdd3",
    outgoingText: "#111b21",
    incomingBubble: "#ffffff",
    incomingText: "#111b21",
    pattern: "lines",
    patternColor: "#64748b",
    patternOpacity: "subtle",
  },
  ocean: {
    surface: "#071b24",
    outgoingBubble: "#075e54",
    outgoingText: "#ecfeff",
    incomingBubble: "#12313d",
    incomingText: "#ecfeff",
    pattern: "dots",
    patternColor: "#22d3ee",
    patternOpacity: "subtle",
  },
};

type ThemeResponse = { theme: RoomTheme; updatedAt: string };

async function requestRoomTheme(roomId: string, theme?: RoomTheme) {
  const response = await fetch(`/api/rooms/${roomId}/theme`, {
    method: theme ? "PATCH" : "GET",
    headers: theme ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: theme ? JSON.stringify(theme) : undefined,
  });
  const payload = (await response.json().catch(() => null)) as
    | ThemeResponse
    | { error?: string }
    | null;

  if (!response.ok || !payload || !("theme" in payload)) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : `Unable to ${theme ? "save" : "load"} the room theme.`,
    );
  }

  return { ...payload, theme: normalizeRoomTheme(payload.theme) };
}

export function useRoomTheme(roomId: string, initialTheme?: RoomTheme) {
  const queryClient = useQueryClient();
  const queryKey = ["room-theme", roomId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => requestRoomTheme(roomId),
    initialData: initialTheme
      ? { theme: initialTheme, updatedAt: "" }
      : undefined,
    staleTime: 5 * 60 * 1000,
  });
  const mutation = useMutation({
    mutationFn: (theme: RoomTheme) => requestRoomTheme(roomId, theme),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  return {
    theme: query.data?.theme ?? initialTheme ?? DEFAULT_ROOM_THEME,
    isLoading: query.isLoading,
    error: query.error,
    saveTheme: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

const OPACITY_VALUES: Record<RoomTheme["patternOpacity"], number> = {
  subtle: 0.045,
  soft: 0.08,
  visible: 0.14,
};

function hexToRgba(hex: string, opacity: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function getRoomThemeStyle(theme: RoomTheme): React.CSSProperties {
  const patternColor = hexToRgba(
    theme.patternColor,
    OPACITY_VALUES[theme.patternOpacity],
  );
  let backgroundImage = "none";
  let backgroundSize: string | undefined;

  if (theme.pattern === "grid") {
    backgroundImage = `linear-gradient(${patternColor} 1px, transparent 1px), linear-gradient(90deg, ${patternColor} 1px, transparent 1px)`;
    backgroundSize = "32px 32px";
  } else if (theme.pattern === "lines") {
    backgroundImage = `repeating-linear-gradient(135deg, transparent 0 22px, ${patternColor} 22px 23px)`;
  } else if (theme.pattern === "dots") {
    backgroundImage = `radial-gradient(circle, ${patternColor} 1.5px, transparent 1.5px)`;
    backgroundSize = "24px 24px";
  } else if (theme.pattern === "hearts") {
    const opacity = OPACITY_VALUES[theme.patternOpacity];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><path fill="${theme.patternColor}" fill-opacity="${opacity}" d="M22 34C10 26 7 20 7 15a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 5-3 11-15 19Z"/></svg>`;
    backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    backgroundSize = "44px 44px";
  }

  return {
    backgroundColor: theme.surface,
    backgroundImage,
    backgroundSize,
    "--chat-outgoing": theme.outgoingBubble,
    "--chat-outgoing-foreground": theme.outgoingText,
    "--chat-incoming": theme.incomingBubble,
    "--chat-incoming-foreground": theme.incomingText,
  } as React.CSSProperties;
}
