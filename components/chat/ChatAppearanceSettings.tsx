"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Grid3X3,
  Heart,
  Loader2,
  Moon,
  Save,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  getRoomThemeStyle,
  ROOM_THEME_PRESETS,
  useRoomTheme,
} from "@/components/chat/chat-appearance";
import { authClient } from "@/lib/auth-client";
import { useRooms } from "@/hooks/use-rooms";
import {
  DEFAULT_ROOM_THEME,
  type RoomTheme,
  type UserRoom,
} from "@/lib/rooms";

const COLOR_CONTROLS: {
  key: keyof Pick<
    RoomTheme,
    | "surface"
    | "outgoingBubble"
    | "outgoingText"
    | "incomingBubble"
    | "incomingText"
    | "patternColor"
  >;
  label: string;
}[] = [
  { key: "surface", label: "Page background" },
  { key: "patternColor", label: "Pattern color" },
  { key: "outgoingBubble", label: "Your bubbles" },
  { key: "outgoingText", label: "Your text" },
  { key: "incomingBubble", label: "Received bubbles" },
  { key: "incomingText", label: "Received text" },
];

const PRESETS = [
  { id: "midnight", label: "Midnight", icon: Moon },
  { id: "hearts", label: "Pink hearts", icon: Heart },
  { id: "paper", label: "Soft lines", icon: Waves },
  { id: "ocean", label: "Ocean dots", icon: Grid3X3 },
] as const;

const PATTERNS: { value: RoomTheme["pattern"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "hearts", label: "Hearts" },
  { value: "grid", label: "Grid" },
  { value: "lines", label: "Lines" },
  { value: "dots", label: "Dots" },
];

const OPACITIES: {
  value: RoomTheme["patternOpacity"];
  label: string;
}[] = [
  { value: "subtle", label: "Subtle" },
  { value: "soft", label: "Soft" },
  { value: "visible", label: "Visible" },
];

function initials(value: string) {
  return value
    .split(/\s|-/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ChatAppearanceSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const { rooms, isLoading: roomsLoading } = useRooms(
    Boolean(session?.user),
    session?.user.id,
  );
  const requestedCode = searchParams.get("room")?.toUpperCase();
  const selectedRoom = useMemo(
    () => rooms.find((room) => room.code === requestedCode) ?? rooms[0],
    [requestedCode, rooms],
  );

  if (roomsLoading || !selectedRoom) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <RoomThemeEditor
      room={selectedRoom}
      rooms={rooms}
      onBack={() => router.back()}
    />
  );
}

function RoomThemeEditor({
  room,
  rooms,
  onBack,
}: {
  room: UserRoom;
  rooms: UserRoom[];
  onBack: () => void;
}) {
  const router = useRouter();
  const { theme, saveTheme, isSaving } = useRoomTheme(room.id, room.theme);
  const [draft, setDraft] = useState<RoomTheme>(theme ?? DEFAULT_ROOM_THEME);

  useEffect(() => {
    setDraft(theme);
  }, [room.id, theme]);

  const selectRoom = (code: string) => {
    router.replace(`/appearance?room=${encodeURIComponent(code)}`);
  };

  const handleSave = async () => {
    try {
      await saveTheme(draft);
      toast.success(`Theme saved for ${room.name}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save room theme.",
      );
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="shrink-0 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 lg:px-8">
          <Button variant="ghost" size="icon-lg" onClick={onBack}>
            <ArrowLeft />
            <span className="sr-only">Go back</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold">Room appearance</h1>
            <p className="truncate text-xs text-muted-foreground">
              Shared with everyone in {room.name}
            </p>
          </div>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            {isSaving ? "Saving..." : "Save theme"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b bg-muted/20 p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <p className="mb-2 px-2 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Your chats
          </p>
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {rooms.map((listedRoom) => {
              const owner = listedRoom.members.find(
                (member) => member.userId === listedRoom.ownerId,
              )?.user;
              const selected = listedRoom.id === room.id;

              return (
                <button
                  key={listedRoom.id}
                  type="button"
                  onClick={() => selectRoom(listedRoom.code)}
                  className={[
                    "flex min-w-56 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition lg:min-w-0",
                    selected
                      ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                      : "hover:bg-accent",
                  ].join(" ")}
                >
                  <Avatar className="size-9">
                    <AvatarImage src={owner?.image ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {initials(listedRoom.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {listedRoom.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {listedRoom.code}
                    </span>
                  </span>
                  {selected ? <Check className="size-3.5 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto">
          <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:p-6">
            <section className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold">Presets</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Patterns remain subtle so every bubble stays readable.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDraft(ROOM_THEME_PRESETS[id])}
                    className="flex items-center gap-2 rounded-xl border bg-card p-3 text-left text-xs font-medium hover:border-primary/50"
                  >
                    <Icon className="size-4 text-primary" />
                    {label}
                  </button>
                ))}
              </div>

              <ControlGroup title="Background pattern">
                <div className="grid grid-cols-3 gap-2">
                  {PATTERNS.map((pattern) => (
                    <ChoiceButton
                      key={pattern.value}
                      active={draft.pattern === pattern.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          pattern: pattern.value,
                        }))
                      }
                    >
                      {pattern.label}
                    </ChoiceButton>
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup title="Pattern opacity">
                <div className="grid grid-cols-3 gap-2">
                  {OPACITIES.map((opacity) => (
                    <ChoiceButton
                      key={opacity.value}
                      active={draft.patternOpacity === opacity.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          patternOpacity: opacity.value,
                        }))
                      }
                    >
                      {opacity.label}
                    </ChoiceButton>
                  ))}
                </div>
              </ControlGroup>

              <div className="overflow-hidden rounded-2xl border bg-card">
                {COLOR_CONTROLS.map((control) => (
                  <label
                    key={control.key}
                    className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 text-xs font-medium">
                      {control.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {draft[control.key]}
                    </span>
                    <input
                      type="color"
                      value={draft[control.key]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [control.key]: event.target.value,
                        }))
                      }
                      className="size-8 cursor-pointer rounded-lg border bg-transparent p-1"
                    />
                  </label>
                ))}
              </div>
            </section>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Full chat preview
              </p>
              <div
                className="flex min-h-[520px] flex-col overflow-hidden rounded-3xl border shadow-sm"
                style={getRoomThemeStyle(draft)}
              >
                <div className="border-b bg-background/95 px-4 py-3">
                  <p className="text-xs font-semibold text-foreground">{room.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{room.code}</p>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-3 p-4">
                  <PreviewBubble incoming text="Try the new room background." time="3:08 PM" />
                  <PreviewBubble text="The hearts are subtle and readable!" time="3:09 PM" />
                </div>
                <div className="border-t border-white/10 bg-black/15 p-3">
                  <div className="h-10 rounded-full border border-white/10 bg-black/20" />
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function ControlGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{title}</p>
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-2 py-2 text-[0.6875rem] font-medium transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "bg-card hover:bg-accent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PreviewBubble({
  incoming = false,
  text,
  time,
}: {
  incoming?: boolean;
  text: string;
  time: string;
}) {
  return (
    <div className={incoming ? "flex justify-start" : "flex justify-end"}>
      <div
        className={[
          "max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm",
          incoming
            ? "bg-[var(--chat-incoming)] text-[var(--chat-incoming-foreground)]"
            : "bg-[var(--chat-outgoing)] text-[var(--chat-outgoing-foreground)]",
        ].join(" ")}
      >
        <p className="text-[13px] leading-5">{text}</p>
        <p className={incoming ? "text-left text-[9px] opacity-55" : "text-right text-[9px] opacity-55"}>
          {time}
        </p>
      </div>
    </div>
  );
}
