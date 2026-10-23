"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Check,
  ChevronRight,
  Code2,
  Copy,
  FileText,
  Folder,
  Globe,
  Info,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  MessagesSquare,
  Moon,
  Palette,
  Pencil,
  Plus,
  Settings,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible } from "radix-ui";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import GoogleOneTap from "@/components/auth/GoogleOneTap";
import UserDropdown from "@/components/auth/UserDropdown";
import RoomActionDialog from "@/components/rooms/RoomActionDialog";
import RoomCreateDialog from "@/components/rooms/RoomCreateDialog";
import RoomJoinDialog from "@/components/rooms/RoomJoinDialog";
import { useSidebar } from "@/components/sidebar-context";
import { useRooms } from "@/hooks/use-rooms";
import { authClient } from "@/lib/auth-client";
import type { UserRoom, UserRoomMember } from "@/lib/rooms";
import { MAX_CUSTOM_ROOM_CODE_LENGTH } from "@/lib/rooms";

import { InstallApp } from "@/components/pwa/InstallApp";
import NotificationCenter from "@/components/NotificationCenter";
import {
  canChangeRole,
  canEditRoom,
  canRemoveMember,
  type PersistedRoomRole,
} from "@/lib/permissions";

type RoomHeaderProps = {
  room: UserRoom;
  members: UserRoomMember[];
};

type HeaderUser = Pick<UserRoomMember["user"], "name" | "email" | "image">;

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
  const router = useRouter();
  const { toggle: toggleChatList } = useSidebar();
  const { data: session } = authClient.useSession();
  const {
    isCreating,
    isJoining,
    error: roomsError,
    createRoom,
    joinRoom,
    removeRoom,
    hasLoaded,
  } = useRooms(Boolean(session?.user), session?.user.id);
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [joinRoomOpen, setJoinRoomOpen] = useState(false);
  const [roomActionOpen, setRoomActionOpen] = useState(false);
  const [roomSettingsOpen, setRoomSettingsOpen] = useState(false);
  const [roomName, setRoomName] = useState(room.name);
  const [roomCode, setRoomCode] = useState(room.code.replace(/^QC-/, ""));
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [roomSettingsError, setRoomSettingsError] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied">(
    "idle",
  );
  const [mounted, setMounted] = useState(false);
  const [isRemovingRoom, setIsRemovingRoom] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<UserRoomMember | null>(
    null,
  );
  const [roomNotice, setRoomNotice] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [changingMemberId, setChangingMemberId] = useState<string | null>(null);
  const [roleChange, setRoleChange] = useState<{
    member: UserRoomMember;
    role: PersistedRoomRole;
  } | null>(null);

  const currentRoom = room;
  const hasActiveRoom = true;
  const roleOrder = { SUPER_ADMIN: 0, ADMIN: 1, MEMBER: 2 } as const;
  const membersToRender = [...members]
    .filter((member) => {
      const query = memberSearch.trim().toLowerCase();
      return (
        !query || getDisplayName(member.user).toLowerCase().includes(query)
      );
    })
    .sort(
      (a, b) =>
        roleOrder[a.role] - roleOrder[b.role] ||
        Date.parse(a.joinedAt) - Date.parse(b.joinedAt),
    );
  const memberCount = currentRoom.memberCount;
  const displayCode = currentRoom.code;
  const displayName = currentRoom.name;
  const editableRoom = canEditRoom(currentRoom.currentUserRole);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("qchat:membership-changed", refresh);
    return () =>
      window.removeEventListener("qchat:membership-changed", refresh);
  }, [router]);

  const copyRoom = async () => {
    if (!currentRoom) {
      setCreateRoomOpen(true);
      return;
    }

    await navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRoom = async () => {
    const inviteUrl = `${window.location.origin}/join/${encodeURIComponent(currentRoom.code)}`;
    const shareData = {
      title: `Join ${currentRoom.name} on QChat`,
      text: `Join my QChat room with code ${currentRoom.code}.`,
      url: inviteUrl,
    };

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        setShareStatus("shared");
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setShareStatus("copied");
      }

      setTimeout(() => setShareStatus("idle"), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        await navigator.clipboard.writeText(inviteUrl);
        setShareStatus("copied");
        setTimeout(() => setShareStatus("idle"), 2000);
      } catch {
        setRoomNotice("Unable to share this room. Copy the room code instead.");
      }
    }
  };

  const handleCreateRoom = async (name: string, customCode?: string) => {
    const createdRoom = await createRoom(name, customCode);

    router.push(`/chat/${createdRoom.code}`);
  };

  const handleJoinRoom = async (code: string) => {
    const result = await joinRoom(code);
    if (result.status === "joined") router.push(`/chat/${result.room.code}`);
    return result;
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
      router.push("/chat");
      router.refresh();
    } finally {
      setIsRemovingRoom(false);
    }
  };

  const handleSaveRoom = async () => {
    setIsSavingRoom(true);
    setRoomSettingsError(null);
    try {
      const response = await fetch(`/api/rooms/${currentRoom.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName, code: roomCode }),
      });
      const payload = (await response.json().catch(() => null)) as {
        room?: { name: string; code: string };
        error?: string;
      } | null;
      if (!response.ok || !payload?.room) {
        throw new Error(payload?.error ?? "Unable to update room settings.");
      }

      const codeChanged = payload.room.code !== currentRoom.code;
      setRoomSettingsOpen(false);
      setMenuOpen(false);
      setRoomNotice("Room settings updated.");
      window.dispatchEvent(new Event("qchat:membership-changed"));
      if (codeChanged) {
        router.replace(`/chat/${encodeURIComponent(payload.room.code)}`);
      }
      router.refresh();
    } catch (error) {
      setRoomSettingsError(
        error instanceof Error
          ? error.message
          : "Unable to update room settings.",
      );
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    setRemovingMemberId(userId);
    setRoomNotice(null);

    try {
      const response = await fetch(
        `/api/rooms/${currentRoom.id}/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to remove this member.");
      }

      setRoomNotice(`${name} was removed from the room.`);
      setMemberToRemove(null);
      router.refresh();
    } catch (error) {
      setRoomNotice(
        error instanceof Error
          ? error.message
          : "Unable to remove this member.",
      );
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleChangeRole = async (
    member: UserRoomMember,
    role: PersistedRoomRole,
  ) => {
    setChangingMemberId(member.userId);
    setRoomNotice(null);
    try {
      const response = await fetch(
        `/api/rooms/${currentRoom.id}/members/${encodeURIComponent(member.userId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Unable to update this role.");
      setRoomNotice(
        `${getDisplayName(member.user)} is now ${role === "ADMIN" ? "an admin" : "a member"}.`,
      );
      setRoleChange(null);
      window.dispatchEvent(new Event("qchat:membership-changed"));
      router.refresh();
    } catch (error) {
      setRoomNotice(
        error instanceof Error ? error.message : "Unable to update this role.",
      );
    } finally {
      setChangingMemberId(null);
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

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <h1 className="truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
                {displayName}
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
          </div>
        </div>

        {session ? <NotificationCenter room={currentRoom} /> : null}
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
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              (event.currentTarget as HTMLElement | null)
                ?.querySelector<HTMLButtonElement>('[data-slot="sheet-close"]')
                ?.focus();
            }}
            className="min-w-0 max-w-full overflow-hidden border-l bg-background p-0 data-[side=right]:h-dvh data-[side=right]:w-[min(100vw,400px)] data-[side=right]:sm:max-w-[400px] [&>[data-slot=sheet-close]]:size-11"
          >
            <div className="flex shrink-0 items-center gap-3 border-b bg-gradient-to-br from-primary/10 via-background to-background pl-4 pr-16 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <MessagesSquare className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base font-semibold leading-tight tracking-tight">
                  {displayName}
                </SheetTitle>
                <SheetDescription className="truncate text-xs text-muted-foreground">
                  {hasActiveRoom
                    ? `${memberCount} members`
                    : "Create a room to save a private QC code"}
                </SheetDescription>
              </div>
            </div>

            <div
              data-slot="room-menu-scroll"
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
            >
              <div className="min-w-0 space-y-3 px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
                <div className="rounded-2xl border bg-card p-2.5 text-card-foreground shadow-sm">
                  <div className="flex min-w-0 items-center justify-between gap-2 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">Members</p>
                      <p className="text-[0.625rem] text-muted-foreground">
                        Manage current room membership
                      </p>
                    </div>
                    <Badge variant="secondary">{memberCount} / 50</Badge>
                  </div>
                  <div className="relative mx-2 my-2">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Search members"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <div className="max-h-[min(40dvh,20rem)] overflow-y-auto overscroll-contain">
                    <div className="space-y-1 px-1 pb-1">
                      {membersToRender.map((member) => {
                        const removable = canRemoveMember(
                          currentRoom.currentUserRole,
                          member.role,
                        );
                        const promotable = canChangeRole(
                          currentRoom.currentUserRole,
                          member.role,
                          "ADMIN",
                        );
                        const demotable = canChangeRole(
                          currentRoom.currentUserRole,
                          member.role,
                          "MEMBER",
                        );
                        return (
                          <div
                            key={member.id}
                            className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/50"
                          >
                            <Avatar className="size-8 shrink-0">
                              <AvatarImage
                                src={member.user.image ?? undefined}
                                alt={getDisplayName(member.user)}
                              />
                              <AvatarFallback className="text-[0.625rem]">
                                {getInitials(member.user)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">
                                {getDisplayName(member.user)}
                              </p>
                              <p className="truncate text-[0.625rem] text-muted-foreground">
                                Joined {formatJoinedAt(member.joinedAt)}
                              </p>
                            </div>
                            <Badge
                              className="shrink-0"
                              variant={
                                member.role === "SUPER_ADMIN"
                                  ? "default"
                                  : member.role === "ADMIN"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {member.role === "SUPER_ADMIN"
                                ? "Super Admin"
                                : member.role === "ADMIN"
                                  ? "Admin"
                                  : "Member"}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  className="size-11 shrink-0"
                                  aria-label={`Actions for ${getDisplayName(member.user)}`}
                                  disabled={
                                    changingMemberId !== null ||
                                    removingMemberId !== null
                                  }
                                >
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem asChild>
                                  <Link href={`/users/${member.userId}`}>
                                    View profile
                                  </Link>
                                </DropdownMenuItem>
                                {promotable || demotable || removable ? (
                                  <DropdownMenuSeparator />
                                ) : null}
                                {promotable ? (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setRoleChange({ member, role: "ADMIN" })
                                    }
                                  >
                                    <UserCog />
                                    Promote to admin
                                  </DropdownMenuItem>
                                ) : null}
                                {demotable ? (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setRoleChange({ member, role: "MEMBER" })
                                    }
                                  >
                                    <UserCog />
                                    Demote to member
                                  </DropdownMenuItem>
                                ) : null}
                                {removable ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => setMemberToRemove(member)}
                                  >
                                    Remove from room
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                      {!membersToRender.length ? (
                        <p className="p-4 text-center text-xs text-muted-foreground">
                          No members match your search.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <MenuSection icon={Folder} title="Workspace">
                  <div className="mx-1 mb-1 flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.625rem] font-medium text-muted-foreground">
                        Room code
                      </p>
                      <p className="truncate font-mono text-xs font-semibold">
                        {displayCode}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="size-11 shrink-0"
                      aria-label="Copy room code"
                      onClick={() => void copyRoom()}
                    >
                      {copied ? <Check /> : <Copy />}
                    </Button>
                  </div>
                  {editableRoom ? (
                    <MenuButton
                      icon={Pencil}
                      label="Edit room settings"
                      onClick={() => {
                        setRoomName(currentRoom.name);
                        setRoomCode(currentRoom.code.replace(/^QC-/, ""));
                        setRoomSettingsError(null);
                        setMenuOpen(false);
                        setRoomSettingsOpen(true);
                      }}
                    />
                  ) : null}
                  <MenuButton
                    icon={Plus}
                    label="Create new room"
                    onClick={() => {
                      setMenuOpen(false);
                      setCreateRoomOpen(true);
                    }}
                  />
                  {hasActiveRoom ? (
                    <>
                      <MenuButton
                        icon={shareStatus === "idle" ? Share2 : Check}
                        label={
                          shareStatus === "shared"
                            ? "Shared!"
                            : shareStatus === "copied"
                              ? "Invite link copied!"
                              : "Share invite link"
                        }
                        onClick={() => void shareRoom()}
                      />
                    </>
                  ) : null}
                  <MenuButton
                    icon={Users}
                    label="Open chat list"
                    onClick={() => {
                      toggleChatList();
                      setMenuOpen(false);
                    }}
                  />
                  <MenuButton
                    icon={LogIn}
                    label="Join another room"
                    onClick={() => {
                      setMenuOpen(false);
                      setJoinRoomOpen(true);
                    }}
                  />
                  {hasActiveRoom ? (
                    <MenuButton
                      icon={currentRoom?.isOwner ? Trash2 : LogOut}
                      label={
                        currentRoom?.isOwner ? "Delete room" : "Leave room"
                      }
                      tone="destructive"
                      onClick={() => setRoomActionOpen(true)}
                    />
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
                  <InstallApp />
                  <ToggleRow
                    icon={Moon}
                    label="Dark mode"
                    checked={mounted ? resolvedTheme === "dark" : true}
                    onCheckedChange={(value) =>
                      setTheme(value ? "dark" : "light")
                    }
                  />
                  <MenuLink
                    icon={Palette}
                    label="Chat appearance"
                    href={`/appearance?room=${encodeURIComponent(currentRoom.code)}`}
                  />
                </MenuSection>

                <MenuSection icon={Info} title="About" defaultOpen={false}>
                  <MenuLink icon={Info} label="About QChat" href="/about" />
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

                <MenuSection icon={Code2} title="Developer" defaultOpen={false}>
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
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <RoomCreateDialog
        open={createRoomOpen}
        onOpenChange={setCreateRoomOpen}
        isCreating={isCreating}
        onCreate={handleCreateRoom}
      />
      <RoomJoinDialog
        open={joinRoomOpen}
        onOpenChange={setJoinRoomOpen}
        isJoining={isJoining}
        onJoin={handleJoinRoom}
      />
      <RoomActionDialog
        room={currentRoom}
        open={roomActionOpen}
        isBusy={isRemovingRoom}
        onOpenChange={setRoomActionOpen}
        onConfirm={handleRemoveRoom}
      />
      <Dialog
        open={roomSettingsOpen}
        onOpenChange={(open) => {
          if (!isSavingRoom) setRoomSettingsOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit room settings</DialogTitle>
            <DialogDescription>
              Change how this room appears and the code people use to join it.
              Admins and the super admin can update these details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-room-name" className="text-xs font-medium">
                Room name
              </label>
              <Input
                id="edit-room-name"
                value={roomName}
                maxLength={50}
                disabled={isSavingRoom}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Room name"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-room-code" className="text-xs font-medium">
                Room code
              </label>
              <div className="flex items-center gap-2">
                <div className="flex h-9 shrink-0 items-center rounded-md border border-input bg-muted px-2 font-mono text-xs text-muted-foreground">
                  QC-
                </div>
                <Input
                  id="edit-room-code"
                  value={roomCode}
                  disabled={isSavingRoom}
                  maxLength={MAX_CUSTOM_ROOM_CODE_LENGTH - 3}
                  onChange={(event) =>
                    setRoomCode(
                      event.target.value
                        .replace(/^QC-/i, "")
                        .replace(/[^A-Za-z0-9-]/g, "")
                        .toUpperCase(),
                    )
                  }
                  className="font-mono"
                  placeholder="TEAM-01"
                />
              </div>
              <p className="text-[0.6875rem] text-muted-foreground">
                Letters, numbers, and hyphens. Changing the code updates the
                room link.
              </p>
            </div>
            {roomSettingsError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {roomSettingsError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingRoom}
              onClick={() => setRoomSettingsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                isSavingRoom ||
                roomName.trim().length < 3 ||
                roomCode.trim().length === 0
              }
              onClick={() => void handleSaveRoom()}
            >
              {isSavingRoom ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open && removingMemberId === null) {
            setMemberToRemove(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Remove{" "}
              {memberToRemove
                ? getDisplayName(memberToRemove.user)
                : "this member"}{" "}
              from this room? They will need to join again to continue chatting.
            </DialogDescription>
          </DialogHeader>

          {memberToRemove ? (
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <Avatar className="size-8">
                <AvatarImage
                  src={memberToRemove.user.image ?? undefined}
                  alt={getDisplayName(memberToRemove.user)}
                />
                <AvatarFallback className="text-[0.625rem]">
                  {getInitials(memberToRemove.user)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {getDisplayName(memberToRemove.user)}
                </p>
                <p className="truncate text-[0.6875rem] text-muted-foreground">
                  {memberToRemove.user.email}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={removingMemberId !== null}
              onClick={() => setMemberToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!memberToRemove || removingMemberId !== null}
              onClick={() => {
                if (memberToRemove) {
                  void handleRemoveMember(
                    memberToRemove.userId,
                    getDisplayName(memberToRemove.user),
                  );
                }
              }}
            >
              {removingMemberId ? "Removing..." : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={roleChange !== null}
        onOpenChange={(open) => {
          if (!open && changingMemberId === null) setRoleChange(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {roleChange?.role === "ADMIN" ? "Promote member" : "Demote admin"}
            </DialogTitle>
            <DialogDescription>
              {roleChange
                ? `${getDisplayName(roleChange.member.user)} will become ${roleChange.role === "ADMIN" ? "an admin who can approve requests, remove members, and promote members" : "a member with chat and viewing access"}.`
                : "Confirm this role change."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={changingMemberId !== null}
              onClick={() => setRoleChange(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={!roleChange || changingMemberId !== null}
              onClick={() => {
                if (roleChange)
                  void handleChangeRole(roleChange.member, roleChange.role);
              }}
            >
              {changingMemberId ? "Updating..." : "Confirm role change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MenuSection({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible.Root
      defaultOpen={defaultOpen}
      className="min-w-0 rounded-2xl border bg-card text-card-foreground"
    >
      <Collapsible.Trigger className="group flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
      </Collapsible.Trigger>
      <Collapsible.Content className="min-w-0 space-y-0.5 border-t p-1.5">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
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
          ? "group flex min-h-11 min-w-0 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-medium text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-destructive/10"
          : "group flex min-h-11 min-w-0 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground"
      }
      onClick={onClick}
    >
      <span
        className={
          tone === "destructive"
            ? "flex size-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10"
            : "flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-background"
        }
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <ChevronRight className="size-3 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
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
      className="group flex min-h-11 min-w-0 w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-background">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <ChevronRight className="size-3 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
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
    <div className="flex min-h-11 min-w-0 w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium hover:bg-accent/50">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={`Toggle ${label.toLowerCase()}`}
      />
    </div>
  );
}
