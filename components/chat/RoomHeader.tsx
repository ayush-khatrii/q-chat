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
  Menu,
  MessagesSquare,
  Moon,
  Palette,
  Settings,
  Share2,
  ShieldCheck,
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
import { useSidebar } from "@/components/sidebar-context";
import { authClient } from "@/lib/auth-client";
import type { ChatRoom, ChatRoomMember, ChatUser } from "@/constants";

type RoomHeaderProps = {
  room: ChatRoom;
  members: ChatRoomMember[];
};

function getDisplayName(user: ChatUser) {
  return user.name ?? user.email;
}

function getInitials(user: ChatUser) {
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
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const admin = members.find((member) => member.userId === room.ownerId);
  const memberCount = members.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  const copyRoom = async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                {room.code}
              </h1>
            </div>
            <p className="truncate text-[0.6875rem] text-muted-foreground sm:text-xs">
              {room.name}
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
                  {room.code}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {room.name} · {memberCount} members
                </p>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-3">
                <div className="rounded-lg border bg-card p-2 text-card-foreground">
                  <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                    <div>
                      <p className="text-xs font-semibold">Members</p>
                      <p className="text-[0.625rem] text-muted-foreground">
                        Current room membership
                      </p>
                    </div>
                    <Badge variant="secondary">{memberCount} total</Badge>
                  </div>
                  <div className="mt-1 space-y-1">
                    {members.map((member) => (
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
                        {member.userId === room.ownerId ? (
                          <Badge variant="default">Admin</Badge>
                        ) : (
                          <Badge variant="outline">Member</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <MenuSection icon={Folder} title="Workspace">
                  <MenuButton
                    icon={copied ? Check : Copy}
                    label={copied ? "Copied!" : "Copy room code"}
                    onClick={copyRoom}
                  />
                  <MenuButton icon={Share2} label="Share invite link" />
                  <MenuButton
                    icon={Users}
                    label="Open chat list"
                    onClick={() => {
                      toggleChatList();
                      setMenuOpen(false);
                    }}
                  />
                  <MenuButton icon={UserPlus} label="Invite members" />
                  <MenuButton icon={Settings} label="Room settings" />
                  <MenuButton icon={ShieldCheck} label="Admin controls" />
                </MenuSection>

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
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-9 w-full items-center gap-3 px-3 text-left text-xs font-medium hover:bg-accent hover:text-accent-foreground"
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
