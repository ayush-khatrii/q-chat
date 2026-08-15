"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHAT_APPEARANCE_PRESETS,
  useChatAppearance,
  type ChatAppearance,
} from "@/components/chat/chat-appearance";

const COLOR_CONTROLS: {
  key: keyof ChatAppearance;
  label: string;
  description: string;
}[] = [
  { key: "surface", label: "Chat background", description: "Conversation canvas" },
  { key: "outgoingBubble", label: "Your bubbles", description: "Messages you send" },
  { key: "outgoingText", label: "Your text", description: "Text inside your messages" },
  { key: "incomingBubble", label: "Received bubbles", description: "Messages sent to you" },
  { key: "incomingText", label: "Received text", description: "Text inside received messages" },
];

export default function ChatAppearanceSettings() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { appearance, updateAppearance, applyPreset, resetAppearance } =
    useChatAppearance();

  const selectPreset = (mode: "light" | "dark") => {
    setTheme(mode);
    applyPreset(CHAT_APPEARANCE_PRESETS[mode]);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 lg:px-8">
          <Button variant="ghost" size="icon-lg" onClick={() => router.back()}>
            <ArrowLeft />
            <span className="sr-only">Go back</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold">Chat appearance</h1>
            <p className="text-xs text-muted-foreground">
              Saved only in this browser for your account
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={resetAppearance}>
            <RotateCcw />
            Reset
          </Button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <section className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold">Quick presets</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Start with a balanced palette, then fine-tune each color.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => selectPreset("light")}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-accent/40"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Sun className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">WhatsApp Light</span>
                <span className="text-xs text-muted-foreground">Warm and clear</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => selectPreset("dark")}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-accent/40"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-800 text-slate-100">
                <Moon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">WhatsApp Dark</span>
                <span className="text-xs text-muted-foreground">Calm and focused</span>
              </span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card">
            {COLOR_CONTROLS.map((control) => (
              <label
                key={control.key}
                className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{control.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {control.description}
                  </span>
                </span>
                <span className="font-mono text-[0.6875rem] uppercase text-muted-foreground">
                  {appearance[control.key]}
                </span>
                <input
                  type="color"
                  value={appearance[control.key]}
                  onChange={(event) =>
                    updateAppearance({ [control.key]: event.target.value })
                  }
                  className="size-9 cursor-pointer rounded-lg border bg-transparent p-1"
                  aria-label={control.label}
                />
              </label>
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-22 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview
          </p>
          <div
            className="rounded-3xl border p-4 shadow-sm"
            style={{ backgroundColor: appearance.surface }}
          >
            <div className="mb-4 text-center text-[0.625rem] font-medium text-black/45 dark:text-white/45">
              Today
            </div>
            <div className="space-y-3">
              <div className="flex justify-start">
                <div
                  className="max-w-[82%] rounded-2xl px-3 py-2 shadow-sm"
                  style={{
                    backgroundColor: appearance.incomingBubble,
                    color: appearance.incomingText,
                  }}
                >
                  <p className="text-[13px] leading-5">How does this palette look?</p>
                  <p className="mt-0.5 text-left text-[9px] opacity-55">3:08 PM</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div
                  className="max-w-[82%] rounded-2xl px-3 py-2 shadow-sm"
                  style={{
                    backgroundColor: appearance.outgoingBubble,
                    color: appearance.outgoingText,
                  }}
                >
                  <p className="text-[13px] leading-5">Clean, compact, and perfect.</p>
                  <p className="mt-0.5 text-right text-[9px] opacity-55">3:09 PM</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
