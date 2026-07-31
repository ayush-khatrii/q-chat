"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, DoorOpen, UserRound } from "lucide-react";

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

// ─── Types ────────────────────────────────────────────────────────────────────

type SharedRoom = {
  id: string;
  code: string;
  name: string;
  ownerId: string;
  joinedAt: string;
};

type UserProfileData = {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    createdAt: string;
  };
  isMe: boolean;
  sharedRooms: SharedRoom[];
  createdRoomsCount: number;
  joinedRoomsCount: number;
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

function getDisplayName(
  user: UserProfileData["user"],
) {
  return user.name ?? user.email;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserProfile({ userId }: { userId: string }) {
  const router = useRouter();
  const [data, setData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}`, {
          credentials: "include",
        });

        const payload = (await response.json().catch(() => null)) as
          | UserProfileData
          | { error?: string }
          | null;

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(
            payload && "error" in payload && payload.error
              ? payload.error
              : "Unable to load this profile.",
          );
          return;
        }

        setData(payload as UserProfileData);
      } catch {
        if (active) {
          setError("Unable to load this profile.");
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
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
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

  const { user, isMe, sharedRooms, createdRoomsCount, joinedRoomsCount } =
    data;

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
                src={user.image ?? undefined}
                alt={getDisplayName(user)}
              />
              <AvatarFallback className="text-lg">
                {getInitials(getDisplayName(user))}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-semibold sm:text-2xl">
                  {getDisplayName(user)}
                </h1>
                {isMe ? <Badge variant="secondary">You</Badge> : null}
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {user.email}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                Joined {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
        </CardHeader>

        {/* ── Stats ── */}
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/40 p-4 text-center">
              <p className="text-2xl font-bold">{createdRoomsCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Rooms created
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 text-center">
              <p className="text-2xl font-bold">{joinedRoomsCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Rooms joined
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Rooms shared with me ── */}
      <div className="mb-4 flex items-center gap-2">
        <DoorOpen className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          {isMe
            ? "Your rooms"
            : `Rooms ${user.name ?? "this user"} joined with you`}
        </h2>
      </div>

      {sharedRooms.length === 0 ? (
        <Card className="mb-4">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <UserRound className="size-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {isMe
                ? "No rooms found yet."
                : "No shared rooms yet. Join the same room to see them here."}
            </p>
            {isMe ? (
              <Button asChild size="sm" className="mt-2">
                <Link href="/chat">Create or join a room</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sharedRooms.map((room) => (
            <Link key={room.id} href={`/chat/${room.code}`}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/40">
                <CardHeader>
                  <CardTitle className="truncate">{room.name}</CardTitle>
                  <CardDescription className="font-mono">
                    {room.code}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  Joined {formatDate(room.joinedAt)}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
