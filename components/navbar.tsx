"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";

import { Menu, MessageCircle, ChevronRight, User2Icon } from "lucide-react";

import {
  FaGithub,
  FaGlobe,
  FaUsers,
  FaMoon,
  FaBell,
  FaPalette,
  FaLanguage,
  FaSignOutAlt,
  FaGoogle,
  FaShieldAlt,
  FaFileAlt,
  FaCode,
  FaBolt,
  FaCopy,
  FaCheck,
  FaShareAlt,
  FaFolder,
  FaCog,
  FaInfoCircle,
} from "react-icons/fa";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar-context";
import GoogleOneTap from "./auth/GoogleOneTap";
import UserDropdown from "./auth/UserDropdown";
import { authClient } from "@/lib/auth-client";
import { initFcm } from "@/lib/fcm";

// ─── Types ────────────────────────────────────────────────────────────────────

// Union so both LucideIcon and react-icons IconType are valid
type AnyIcon = LucideIcon | IconType;

interface SidebarItemConfig {
  id: string;
  label: string;
  icon: AnyIcon;
  iconClass?: string;
  // action-only item
  action?: () => void;
  // link item
  href?: string;
  external?: boolean;
  // toggle item
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
}

interface SidebarSectionConfig {
  id: string;
  label: string;
  icon: AnyIcon;
  color: string;
  bg: string;
  items: SidebarItemConfig[];
}

interface BuildSectionsParams {
  session: ReturnType<typeof authClient.useSession>["data"];
  copied: boolean;
  copyRoom: () => void;
  toggleMembers: () => void;
  setSheetOpen: (open: boolean) => void;
  setTheme: (theme: string) => void;
  resolvedTheme: string | undefined;
  mounted: boolean;
  notifEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
}

// ─── Google Icon ─────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5 shrink-0"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// ─── Sidebar Config ───────────────────────────────────────────────────────────
const buildSections = ({
  session,
  copied,
  copyRoom,
  toggleMembers,
  setSheetOpen,
  setTheme,
  resolvedTheme,
  mounted,
  notifEnabled,
  onToggleNotifications,
}: BuildSectionsParams): SidebarSectionConfig[] => [
    {
      id: "workspace",
      label: "Workspace",
      icon: FaFolder,
      color: "text-muted-foreground",
      bg: "bg-muted",
      items: [
        {
          id: "copy-code",
          label: copied ? "Copied!" : "Copy room code",
          icon: copied ? FaCheck : FaCopy,
          iconClass: copied ? "text-primary" : undefined,
          action: copyRoom,
        },
        {
          id: "share-invite",
          label: "Share invite link",
          icon: FaShareAlt,
          action: () => { },
        },
        {
          id: "members",
          label: "View members",
          icon: FaUsers,
          action: () => {
            setSheetOpen(false);
            toggleMembers();
          },
        },
      ],
    },
    {
      id: "preferences",
      label: "Preferences",
      icon: FaCog,
      color: "text-muted-foreground",
      bg: "bg-muted",
      items: [
        {
          id: "theme",
          label: "Dark mode",
          icon: FaMoon,
          toggle: true,
          toggleValue: mounted ? resolvedTheme === "dark" : true,
          onToggle: (v: boolean) => setTheme(v ? "dark" : "light"),
        },
        {
          id: "notifications",
          label: "Notifications",
          icon: FaBell,
          toggle: true,
          toggleValue: notifEnabled,
          onToggle: onToggleNotifications,
        },
        {
          id: "appearance",
          label: "Appearance",
          icon: FaPalette,
          action: () => { },
        },
        {
          id: "language",
          label: "Language",
          icon: FaLanguage,
          action: () => { },
        },
      ],
    },
    {
      id: "about",
      label: "About",
      icon: FaInfoCircle,
      color: "text-muted-foreground",
      bg: "bg-muted",
      items: [
        {
          id: "about-qchat",
          label: "About QChat",
          icon: FaBolt,
          action: () => { },
        },
        {
          id: "privacy",
          label: "Privacy policy",
          icon: FaShieldAlt,
          href: "/privacy",
        },
        {
          id: "terms",
          label: "Terms of service",
          icon: FaFileAlt,
          href: "/terms",
        },
      ],
    },
    {
      id: "developer",
      label: "Developer",
      icon: FaCode,
      color: "text-muted-foreground",
      bg: "bg-muted",
      items: [
        {
          id: "portfolio",
          label: "Built by Ayush",
          icon: FaGlobe,
          href: "https://ayushkhatri.in",
          external: true,
        },
        {
          id: "github",
          label: "View on GitHub",
          icon: FaGithub,
          href: "https://github.com/yourusername",
          external: true,
        },
      ],
    },
  ];

// ─── Section Item ─────────────────────────────────────────────────────────────
function SidebarItem({ item }: { item: SidebarItemConfig }) {
  const Icon = item.icon;
  const baseClass =
    "group flex w-full items-center gap-3 rounded-lg px-3 h-9 text-[13px] font-medium text-foreground/70 hover:text-foreground hover:bg-accent/60 transition-all duration-150 cursor-pointer select-none";

  const inner = (
    <>
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          item.iconClass,
        )}
      />
      <span className="flex-1 text-left leading-none">{item.label}</span>
      {item.toggle !== undefined ? (
        <Switch
          checked={item.toggleValue}
          onCheckedChange={item.onToggle}
          className="scale-75 origin-right"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        />
      ) : item.href ? (
        item.external && (
          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        )
      ) : (
        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener noreferrer" : undefined}
        className={baseClass}
      >
        {inner}
      </Link>
    );
  }

  if (item.toggle !== undefined) {
    return (
      <div
        className={baseClass}
        onClick={() => item.onToggle?.(!item.toggleValue)}
      >
        {inner}
      </div>
    );
  }

  return (
    <button className={baseClass} onClick={item.action}>
      {inner}
    </button>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function SidebarSection({ section }: { section: SidebarSectionConfig }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <div className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl px-3 h-10 transition-all duration-150",
          open
            ? "bg-accent/50 text-foreground"
            : "text-foreground/80 hover:bg-accent/40 hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            section.bg,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", section.color)} />
        </span>
        <span className="flex-1 text-left text-[13px] font-semibold leading-none">
          {section.label}
        </span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-2 mt-1 mb-1 space-y-0.5 border-l border-border/50 pl-3">
            {section.items.map((item) => (
              <SidebarItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Account Block ────────────────────────────────────────────────────────────
function AccountBlock({
  session,
}: {
  session: ReturnType<typeof authClient.useSession>["data"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex justify-between w-full items-center gap-3 rounded-xl px-3 h-10 transition-all duration-150",
          open
            ? "bg-accent/50 text-foreground"
            : "text-foreground/80 hover:bg-accent/40 hover:text-foreground",
        )}
      >
        <span className="flex items-center gap-3 text-[13px] font-semibold leading-none">
          <span className="border bg-muted rounded-full p-1">
            <User2Icon className="h-3.5 w-3.5" />
          </span>
          Profile{" "}
        </span>
        <span>
          <ChevronRight className="flex justify-end items-center h-3.5 w-3.5 opacity-50 hover:opacity-100" />
        </span>
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-2 mt-1 mb-1 border-l border-border/50 pl-3">
            {session ? (
              <>
                {/* User card */}
                <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-1.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage
                      src={session.user.image ?? undefined}
                      alt={session.user.name}
                    />
                    <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                      {session.user.name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
                      {session.user.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate leading-tight max-w-[160px]">
                      {session.user.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await authClient.signOut();
                    window.location.reload();
                  }}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 h-9 text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-all duration-150"
                >
                  <FaSignOutAlt className="h-3.5 w-3.5 shrink-0" />
                  <span>Sign out</span>
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  await authClient.signIn.social({
                    provider: "google",
                    callbackURL: "/chat",
                  });
                }}
                className="group flex w-full items-center justify-center gap-2.5 rounded-lg px-3 h-9 text-[13px] font-semibold border border-border hover:bg-accent/50 transition-all duration-150 mt-0.5"
              >
                <GoogleIcon />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { toggle: toggleMembers } = useSidebar();
  const { data: session } = authClient.useSession();
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const roomCode = "QCHAT-ABCD";

  useEffect(() => {
    setMounted(true);
  }, []);

  async function copyRoom() {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onToggleNotifications(enabled: boolean) {
    if (enabled && session?.user?.id) {
      const ok = await initFcm(session.user.id);
      setNotifEnabled(ok);
      if (!ok) {
        alert("Please allow notifications in your browser settings:\n\nClick the lock icon in the address bar → Site settings → Notifications → Allow");
      }
    } else {
      setNotifEnabled(false);
    }
  }

  const sections = buildSections({
    session,
    copied,
    copyRoom,
    toggleMembers,
    setSheetOpen,
    setTheme,
    resolvedTheme,
    mounted,
    notifEnabled,
    onToggleNotifications,
  });

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between px-2 sm:px-4 lg:px-8">
          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
            </div>
            <span className="hidden text-sm font-semibold sm:block tracking-tight">
              QChat
            </span>
          </Link>

          {/* ── Right actions ── */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMembers}
              className="h-8 w-8"
              title="Toggle members"
            >
              <FaUsers className="h-4 w-4" />
            </Button>

            {session ? <UserDropdown session={session} /> : <GoogleOneTap />}

            {/* ── Sheet trigger ── */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>

              {/* ── Sheet panel ── */}
              <SheetContent
                side="right"
                className="w-[min(88vw,360px)] p-0 flex flex-col h-full border-l border-border/60 bg-background/98 backdrop-blur-xl"
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 shrink-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight tracking-tight">
                      QChat
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Room-based chat
                    </p>
                  </div>

                  {/* Room badge */}
                  <div className="ml-auto flex items-center gap-1.5 rounded-md bg-accent/50 px-2 py-1 shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-mono font-semibold text-foreground/70">
                      {roomCode}
                    </span>
                  </div>
                </div>

                {/* Scrollable body */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="px-3 py-3 space-y-0.5">
                    {sections.map((section) => (
                      <SidebarSection key={section.id} section={section} />
                    ))}

                    <div className="py-1">
                      <Separator className="opacity-50" />
                    </div>

                    {/* Account always last */}
                    <AccountBlock session={session} />
                  </div>
                </ScrollArea>

                {/* Footer */}
                <div className="shrink-0 border-t border-border/60 px-5 py-3 flex items-center justify-between bg-muted/20">
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Fast · Simple · Room Based
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-[9px] font-bold px-1.5 py-0.5 h-auto bg-primary/10 text-primary border-none rounded-md"
                  >
                    v1.0.0
                  </Badge>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
