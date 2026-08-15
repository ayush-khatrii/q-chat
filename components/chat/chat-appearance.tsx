"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";

export type ChatAppearance = {
  surface: string;
  outgoingBubble: string;
  outgoingText: string;
  incomingBubble: string;
  incomingText: string;
};

export const CHAT_APPEARANCE_PRESETS = {
  light: {
    surface: "#efeae2",
    outgoingBubble: "#d9fdd3",
    outgoingText: "#111b21",
    incomingBubble: "#ffffff",
    incomingText: "#111b21",
  },
  dark: {
    surface: "#0b141a",
    outgoingBubble: "#005c4b",
    outgoingText: "#e9edef",
    incomingBubble: "#202c33",
    incomingText: "#e9edef",
  },
} satisfies Record<string, ChatAppearance>;

type ChatAppearanceContextValue = {
  appearance: ChatAppearance;
  updateAppearance: (updates: Partial<ChatAppearance>) => void;
  applyPreset: (preset: ChatAppearance) => void;
  resetAppearance: () => void;
};

const ChatAppearanceContext = createContext<ChatAppearanceContextValue | null>(
  null,
);

const CSS_VARIABLES: Record<keyof ChatAppearance, string> = {
  surface: "--chat-surface",
  outgoingBubble: "--chat-outgoing",
  outgoingText: "--chat-outgoing-foreground",
  incomingBubble: "--chat-incoming",
  incomingText: "--chat-incoming-foreground",
};

function isChatAppearance(value: unknown): value is ChatAppearance {
  if (!value || typeof value !== "object") return false;

  return Object.keys(CSS_VARIABLES).every((key) => {
    const color = (value as Record<string, unknown>)[key];
    return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
  });
}

export function ChatAppearanceProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [appearance, setAppearance] = useState<ChatAppearance>(
    CHAT_APPEARANCE_PRESETS.dark,
  );

  useEffect(() => {
    if (!userId) return;

    const storageKey = `qchat:appearance:${userId}`;

    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : null;

      setAppearance(
        isChatAppearance(parsed)
          ? parsed
          : document.documentElement.classList.contains("dark")
            ? CHAT_APPEARANCE_PRESETS.dark
            : CHAT_APPEARANCE_PRESETS.light,
      );
    } catch {
      setAppearance(CHAT_APPEARANCE_PRESETS.dark);
    }
  }, [userId]);

  useEffect(() => {
    const root = document.documentElement;

    for (const key of Object.keys(CSS_VARIABLES) as (keyof ChatAppearance)[]) {
      root.style.setProperty(CSS_VARIABLES[key], appearance[key]);
    }

    if (userId) {
      try {
        window.localStorage.setItem(
          `qchat:appearance:${userId}`,
          JSON.stringify(appearance),
        );
      } catch {
        // The live theme still works when storage is unavailable.
      }
    }

    return () => {
      for (const variable of Object.values(CSS_VARIABLES)) {
        root.style.removeProperty(variable);
      }
    };
  }, [appearance, userId]);

  const updateAppearance = useCallback(
    (updates: Partial<ChatAppearance>) => {
      setAppearance((current) => ({ ...current, ...updates }));
    },
    [],
  );

  const applyPreset = useCallback((preset: ChatAppearance) => {
    setAppearance(preset);
  }, []);

  const resetAppearance = useCallback(() => {
    setAppearance(
      document.documentElement.classList.contains("dark")
        ? CHAT_APPEARANCE_PRESETS.dark
        : CHAT_APPEARANCE_PRESETS.light,
    );
  }, []);

  const value = useMemo(
    () => ({ appearance, updateAppearance, applyPreset, resetAppearance }),
    [appearance, applyPreset, resetAppearance, updateAppearance],
  );

  return (
    <ChatAppearanceContext.Provider value={value}>
      {children}
    </ChatAppearanceContext.Provider>
  );
}

export function useChatAppearance() {
  const context = useContext(ChatAppearanceContext);

  if (!context) {
    throw new Error("useChatAppearance must be used inside ChatAppearanceProvider");
  }

  return context;
}
