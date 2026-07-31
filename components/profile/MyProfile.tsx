"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  FolderPlus,
  MessageSquare,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { authClient } from "@/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileRoom = {
  id: string;
  code: string;
  name: string;
  memberCount: number;
  createdAt: string;
};

type MyProfileData = {
  createdRooms: ProfileRoom[];
  joinedRooms: ProfileRoom[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return (
    name
      .split(/\s|@/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

// ─── Room grid ────────────────────────────────────────────────────────────────

function RoomGrid({
  rooms,
  emptyMessage,
}: {
  rooms: ProfileRoom[];
  emptyMessage: string;
}) {
  if (rooms.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <MessageSquare className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <Link key={room.id} href={`/chat/${room.code}`}>
          <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/40">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="truncate">{room.name}</CardTitle>
                <Badge variant="secondary" className="shrink-0">
                  {room.code}
                </Badge>
              </div>
              <CardDescription>
                Created {formatDate(room.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {room.memberCount} member{room.memberCount === 1 ? "" : "s"}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyProfile() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [data, setData] = useState<MyProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/me/profile", {
          credentials: "include",
        });

        const payload = (await response.json().catch(() => null)) as
          | MyProfileData
          | { error?: string }
          | null;

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(
            payload && "error" in payload && payload.error
              ? payload.error
              : "Unable to load your profile.",
          );
          return;
        }

        setData(payload as MyProfileData);
      } catch {
        if (active) {
          setError("Unable to load your profile.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Profile unavailable</CardTitle>
            <CardDescription>{error ?? "Profile not found."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft />
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2 text-muted-foreground"
        onClick={() => router.back()}
      >
        <ArrowLeft />
        Back
      </Button>

      {/* ── Profile card ── */}
      <Card className="mb-8">
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              <AvatarImage
                src={user?.image ?? undefined}
                alt={user?.name ?? user?.email ?? "You"}
              />
              <AvatarFallback className="text-lg">
                {getInitials(user?.name ?? user?.email ?? "You")}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-semibold sm:text-2xl">
                  {user?.name ?? user?.email ?? "You"}
                </h1>
                <Badge variant="secondary">You</Badge>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="mt-4 sm:mt-0">
            <Link href="/chat">
              <MessageSquare />
              Go to chat
            </Link>
          </Button>
        </CardHeader>
      </Card>

      {/* ── Rooms I created ── */}
      <div className="mb-4 flex items-center gap-2">
        <Crown className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Rooms I created</h2>
        <Badge variant="outline">{data.createdRooms.length}</Badge>
      </div>
      <div className="mb-10">
        <RoomGrid
          rooms={data.createdRooms}
          emptyMessage="You haven't created any rooms yet."
        />
      </div>

      {/* ── Rooms I joined ── */}
      <div className="mb-4 flex items-center gap-2">
        <FolderPlus className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Rooms I joined</h2>
        <Badge variant="outline">{data.joinedRooms.length}</Badge>
      </div>
      <RoomGrid
        rooms={data.joinedRooms}
        emptyMessage="You haven't joined any rooms yet."
      />
    </div>
  );
}
