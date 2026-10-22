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
  RotateCcw,
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
import { DEFAULT_ROOM_THEME, type RoomTheme, type UserRoom } from "@/lib/rooms";

const COLOR_CONTROLS: {
  key: keyof Pick<
    RoomTheme,
    | "surface"
    | "outgoingBubble"
    | "outgoingText"
    | "outgoingBorder"
    | "incomingBubble"
    | "incomingText"
    | "incomingBorder"
    | "patternColor"
  >;
  label: string;
}[] = [
  { key: "surface", label: "Page background" },
  { key: "patternColor", label: "Pattern color" },
  { key: "outgoingBubble", label: "Your bubbles" },
  { key: "outgoingText", label: "Your text" },
  { key: "outgoingBorder", label: "Your bubble border" },
  { key: "incomingBubble", label: "Received bubbles" },
  { key: "incomingText", label: "Received text" },
  { key: "incomingBorder", label: "Received bubble border" },
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
      <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Loading room appearance">
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <div className="size-10 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
          <div className="animate-pulse rounded-2xl bg-muted/70" />
          <div className="animate-pulse rounded-2xl bg-muted/50" />
        </div>
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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto bg-background lg:overflow-hidden">
      <header className="shrink-0 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-3 px-3 py-3 sm:flex sm:gap-3 sm:px-4 lg:px-6">
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
          <div className="col-span-2 grid grid-cols-2 items-center gap-2 sm:ml-auto sm:flex">
            <Button
              variant="outline"
              className="min-h-10"
              onClick={() => setDraft(DEFAULT_ROOM_THEME)}
              disabled={isSaving}
            >
              <RotateCcw />
              <span className="hidden sm:inline">Reset to default</span>
              <span className="sm:hidden">Reset</span>
            </Button>
            <Button
              className="min-h-10"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              {isSaving ? "Saving..." : "Save theme"}
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)] lg:min-h-0 lg:flex-1 lg:shrink lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b bg-muted/20 p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <p className="mb-2 px-2 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Your chats
          </p>
          <div className="flex w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain p-1 lg:flex-col lg:overflow-visible">
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
                    "flex w-56 min-w-0 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition lg:w-full",
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
                  {selected ? (
                    <Check className="size-3.5 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 lg:min-h-0 lg:overflow-y-auto">
          <div className="mx-auto grid w-full min-w-0 max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 p-3 pb-8 sm:gap-6 sm:p-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:p-6">
            <section className="min-w-0 space-y-5">
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
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border bg-card p-3 text-left text-xs font-medium hover:border-primary/50"
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
                  <div
                    key={control.key}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b px-3 py-3 last:border-b-0 sm:px-4"
                  >
                    <span className="min-w-0 flex-1 text-xs font-medium">
                      {control.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {draft[control.key] === "primary"
                        ? "Primary"
                        : draft[control.key] === "none"
                          ? "None"
                          : draft[control.key]}
                    </span>
                    <span
                      className="relative size-9 shrink-0 overflow-hidden rounded-lg border"
                      style={{
                        backgroundColor:
                          draft[control.key] === "primary"
                            ? "var(--primary)"
                            : draft[control.key] === "none"
                              ? "transparent"
                              : draft[control.key],
                      }}
                    >
                      <input
                        type="color"
                        aria-label={control.label}
                        value={
                          draft[control.key] === "primary" ||
                          draft[control.key] === "none"
                            ? "#a3a3a3"
                            : draft[control.key]
                        }
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [control.key]: event.target.value,
                          }))
                        }
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                      />
                    </span>
                    {(control.key === "outgoingBorder" ||
                      control.key === "incomingBorder") && (
                      <button
                        type="button"
                        aria-label={`No border for ${control.key === "outgoingBorder" ? "your bubbles" : "received bubbles"}`}
                        aria-pressed={draft[control.key] === "none"}
                        className="col-span-3 min-h-9 justify-self-start rounded-md border px-3 text-xs hover:bg-accent"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            [control.key]: "none",
                          }))
                        }
                      >
                        No border
                      </button>
                    )}
                    {control.key === "outgoingBubble" && (
                      <button
                        type="button"
                        aria-pressed={draft.outgoingBubble === "primary"}
                        className="col-span-3 min-h-9 justify-self-start rounded-md border px-3 text-xs hover:bg-accent"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            outgoingBubble: "primary",
                          }))
                        }
                      >
                        Use shadcn primary
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
              <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Full chat preview
              </p>
              <div
                className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-2xl border shadow-sm sm:min-h-[420px] xl:min-h-[520px]"
                style={getRoomThemeStyle(draft)}
              >
                <div className="border-b bg-background/95 px-4 py-3">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {room.name}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {room.code}
                  </p>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-3 p-4">
                  <PreviewBubble
                    incoming
                    text="Try the new room background."
                    time="3:08 PM"
                  />
                  <PreviewBubble
                    text="The hearts are subtle and readable!"
                    time="3:09 PM"
                  />
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
        "min-h-10 min-w-0 rounded-lg border px-2 py-2 text-[0.6875rem] font-medium transition",
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
        style={{
          borderWidth: incoming
            ? "var(--chat-incoming-border-width, 0px)"
            : "var(--chat-outgoing-border-width, 0px)",
        }}
        className={[
          "max-w-[85%] min-w-0 rounded-2xl border px-3 py-1.5 break-words shadow-sm",
          incoming
            ? "border-[var(--chat-incoming-border)] bg-[var(--chat-incoming)] text-[var(--chat-incoming-foreground)]"
            : "border-[var(--chat-outgoing-border)] bg-[var(--chat-outgoing)] text-[var(--chat-outgoing-foreground)]",
        ].join(" ")}
      >
        <p className="text-[13px] leading-5">{text}</p>
        <p
          className={
            incoming
              ? "text-left text-[9px] opacity-55"
              : "text-right text-[9px] opacity-55"
          }
        >
          {time}
        </p>
      </div>
    </div>
  );
}
