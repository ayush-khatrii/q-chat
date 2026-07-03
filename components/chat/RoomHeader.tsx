"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Bell,
  Check,
  ChevronRight,
  Code2,
  Copy,
  FileText,
  Folder,
  Globe,
  Info,
  Languages,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Palette,
  Plus,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import GoogleOneTap from "@/components/auth/GoogleOneTap";
import UserDropdown from "@/components/auth/UserDropdown";
import RoomActionDialog from "@/components/rooms/RoomActionDialog";
import RoomCreateDialog from "@/components/rooms/RoomCreateDialog";
import { useSidebar } from "@/components/sidebar-context";
import { useRooms } from "@/hooks/use-rooms";
import { authClient } from "@/lib/auth-client";
import type { ChatRoom, ChatRoomMember, ChatUser } from "@/constants";
import type { UserRoomMember } from "@/lib/rooms";

type RoomHeaderProps = {
  room: ChatRoom;
  members: ChatRoomMember[];
};

type HeaderUser = Pick<ChatUser, "name" | "email" | "image">;
type HeaderMember = ChatRoomMember | UserRoomMember;

function getDisplayName(user: HeaderUser) {
  return user.name ?? user.email;
}

function getInitials(user: HeaderUser) {
  const source = user.name ?? user.email;

  return source
    .split(/\s|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatJoinedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export default function RoomHeader({ room, members }: RoomHeaderProps) {
  const { toggle: toggleChatList } = useSidebar();
  const { data: session } = authClient.useSession();
  const {
    rooms,
    isCreating,
    error: roomsError,
    createRoom,
    removeRoom,
    hasLoaded,
  } = useRooms(Boolean(session?.user), session?.user.id);
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [roomActionOpen, setRoomActionOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [isRemovingRoom, setIsRemovingRoom] = useState(false);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);

  const currentRoom = rooms[0] ?? null;
  const hasActiveRoom = Boolean(currentRoom);
  const isResolvingRoom = Boolean(session?.user) && !hasLoaded && !currentRoom;
  const membersToRender: HeaderMember[] = currentRoom?.members ?? members;
  const memberCount = currentRoom?.memberCount ?? members.length;
  const displayCode =
    currentRoom?.code ?? (isResolvingRoom ? "QC------" : "No room created");
  const displayName =
    currentRoom?.name ??
    (isResolvingRoom
      ? room.name
      : "You are chatting in preview mode. Create a room to save a private code.");

  useEffect(() => {
    setMounted(true);
  }, []);

  const copyRoom = async () => {
    if (!currentRoom) {
      setCreateRoomOpen(true);
      return;
    }

    await navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateRoom = async (name: string, customCode?: string) => {
    const createdRoom = await createRoom(name, customCode);

    setRoomNotice(`Room ${createdRoom.code} is ready.`);
  };

  const handleRemoveRoom = async () => {
    if (!currentRoom) {
      return;
    }

    setIsRemovingRoom(true);

    try {
      const action = await removeRoom(currentRoom.id);
      setRoomNotice(
        action === "deleted" ? "Room deleted." : "You left the room.",
      );
      setRoomActionOpen(false);
      setMenuOpen(false);
    } finally {
      setIsRemovingRoom(false);
    }
  };

  return (
    <section className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-1.5 px-2 py-2 sm:min-h-16 sm:gap-2 sm:px-4 lg:px-8">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Open chat list"
          onClick={toggleChatList}
        >
          <Users />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="hidden size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground sm:flex">
            <MessagesSquare className="size-4 sm:size-5" />
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <h1 className="truncate font-mono text-sm font-semibold tracking-normal sm:text-base">
                <span
                  className={
                    isResolvingRoom
                      ? "animate-pulse text-muted-foreground"
                      : undefined
                  }
                >
                  {displayCode}
                </span>
              </h1>
              {session && !hasActiveRoom && hasLoaded ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Add room"
                  onClick={() => setCreateRoomOpen(true)}
                >
                  <Plus />
                </Button>
              ) : null}
            </div>
            <p className="truncate text-[0.6875rem] text-muted-foreground sm:text-xs">
              {displayName}
            </p>
          </div>
        </div>

        {session ? <UserDropdown session={session} /> : <GoogleOneTap />}

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label="Open chat menu"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex h-full w-[min(92vw,380px)] flex-col p-0"
          >
            <div className="flex shrink-0 items-center gap-3 border-b px-5 py-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <MessagesSquare className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-semibold">
                  {displayCode}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {isResolvingRoom
                    ? room.name
                    : hasActiveRoom
                    ? `${displayName} · ${memberCount} members`
                    : "Create a room to save a private QC code"}
                </p>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-3">
                <div className="rounded-lg border bg-card p-2 text-card-foreground">
                  <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                    <div>
                      <p className="text-xs font-semibold">
                        {hasActiveRoom ? "Members" : "Room status"}
                      </p>
                      <p className="text-[0.625rem] text-muted-foreground">
                        {hasActiveRoom
                          ? "Current room membership"
                          : isResolvingRoom
                          ? room.name
                          : "The current chat is visible, but no database room has been created yet."}
                      </p>
                    </div>
                    <Badge variant={hasActiveRoom ? "secondary" : "outline"}>
                      {hasActiveRoom
                        ? `${memberCount} total`
                        : "Preview"}
                    </Badge>
                  </div>
                  {hasActiveRoom ? (
                    <div className="mt-1 space-y-1">
                      {membersToRender.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5"
                        >
                          <Avatar className="size-7">
                            <AvatarImage
                              src={member.user.image ?? undefined}
                              alt={getDisplayName(member.user)}
                            />
                            <AvatarFallback className="text-[0.625rem]">
                              {getInitials(member.user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">
                              {getDisplayName(member.user)}
                            </p>
                            <p className="truncate text-[0.625rem] text-muted-foreground">
                              Joined {formatJoinedAt(member.joinedAt)}
                            </p>
                          </div>
                          {member.userId === currentRoom?.ownerId ? (
                            <Badge variant="default">Admin</Badge>
                          ) : (
                            <Badge variant="outline">Member</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      Use the Add room button to create a private room code for this chat.
                    </div>
                  )}
                </div>

                <MenuSection icon={Folder} title="Workspace">
                  {hasActiveRoom ? (
                    <>
                      <MenuButton
                        icon={copied ? Check : Copy}
                        label={copied ? "Copied!" : "Copy room code"}
                        onClick={copyRoom}
                      />
                      <MenuButton icon={Share2} label="Share invite link" />
                    </>
                  ) : hasLoaded ? (
                    <MenuButton
                      icon={Plus}
                      label="Add room"
                      onClick={() => {
                        setMenuOpen(false);
                        setCreateRoomOpen(true);
                      }}
                    />
                  ) : null}
                  <MenuButton
                    icon={Users}
                    label="Open chat list"
                    onClick={() => {
                      toggleChatList();
                      setMenuOpen(false);
                    }}
                  />
                  {hasActiveRoom ? (
                    <>
                      <MenuButton icon={UserPlus} label="Invite members" />
                      <MenuButton icon={Settings} label="Room settings" />
                      <MenuButton icon={ShieldCheck} label="Admin controls" />
                      <MenuButton
                        icon={currentRoom?.isOwner ? Trash2 : LogOut}
                        label={currentRoom?.isOwner ? "Delete room" : "Leave room"}
                        tone="destructive"
                        onClick={() => setRoomActionOpen(true)}
                      />
                    </>
                  ) : null}
                </MenuSection>

                {roomsError || roomNotice ? (
                  <div className="rounded-lg border bg-card px-3 py-2 text-xs">
                    {roomsError ? (
                      <p className="text-destructive">{roomsError}</p>
                    ) : (
                      <p className="text-muted-foreground">{roomNotice}</p>
                    )}
                  </div>
                ) : null}

                <MenuSection icon={Settings} title="Preferences">
                  <ToggleRow
                    icon={Moon}
                    label="Dark mode"
                    checked={mounted ? resolvedTheme === "dark" : true}
                    onCheckedChange={(value) =>
                      setTheme(value ? "dark" : "light")
                    }
                  />
                  <ToggleRow
                    icon={Bell}
                    label="Notifications"
                    checked={notifications}
                    onCheckedChange={setNotifications}
                  />
                  <MenuButton icon={Palette} label="Appearance" />
                  <MenuButton icon={Languages} label="Language" />
                </MenuSection>

                <MenuSection icon={Info} title="About">
                  <MenuButton icon={Info} label="About QChat" />
                  <MenuLink
                    icon={ShieldCheck}
                    label="Privacy policy"
                    href="/privacy"
                  />
                  <MenuLink
                    icon={FileText}
                    label="Terms of service"
                    href="/terms"
                  />
                </MenuSection>

                <MenuSection icon={Code2} title="Developer">
                  <MenuLink
                    icon={Globe}
                    label="Built by Ayush"
                    href="https://ayushkhatri.in"
                    external
                  />
                  <MenuLink
                    icon={Code2}
                    label="View on GitHub"
                    href="https://github.com/ayush-khatrii"
                    external
                  />
                </MenuSection>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      <RoomCreateDialog
        open={createRoomOpen}
        onOpenChange={setCreateRoomOpen}
        isCreating={isCreating}
        onCreate={handleCreateRoom}
      />
      <RoomActionDialog
        room={currentRoom}
        open={roomActionOpen}
        isBusy={isRemovingRoom}
        onOpenChange={setRoomActionOpen}
        onConfirm={handleRemoveRoom}
      />
    </section>
  );
}

function MenuSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{title}</span>
      </div>
      <div className="overflow-hidden rounded-lg border">{children}</div>
    </section>
  );
}

function MenuButton({
  icon: Icon,
  label,
  tone = "default",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "default" | "destructive";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={
        tone === "destructive"
          ? "flex min-h-9 w-full items-center gap-3 px-3 text-left text-xs font-medium text-destructive hover:bg-destructive/10"
          : "flex min-h-9 w-full items-center gap-3 px-3 text-left text-xs font-medium hover:bg-accent hover:text-accent-foreground"
      }
      onClick={onClick}
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="size-3 text-muted-foreground" />
    </button>
  );
}

function MenuLink({
  icon: Icon,
  label,
  href,
  external,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex min-h-9 w-full items-center gap-3 px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="size-3 text-muted-foreground" />
    </Link>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-9 w-full items-center gap-3 px-3 text-xs font-medium">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={`Toggle ${label.toLowerCase()}`}
      />
    </div>
  );
}
