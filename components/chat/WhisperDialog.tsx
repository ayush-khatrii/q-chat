"use client";
import { useState, useRef } from "react";
import { LockKeyhole, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { useRooms } from "@/hooks/use-rooms";
import type { UserRoomMember } from "@/lib/rooms";
export async function sendPrivate(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to send whisper.");
  return data.results as {
    recipientId: string;
    delivered: boolean;
    error?: string;
  }[];
}
export function WhisperDialog({
  roomId,
  members,
}: {
  roomId: string;
  members: UserRoomMember[];
}) {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const draftId = useRef<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const memberships = useRooms(open, session?.user.id);
  const currentRoom = memberships.rooms.find((room) => room.id === roomId);
  const membershipReady = memberships.hasLoaded && !memberships.error;
  const canSend =
    membershipReady &&
    !!currentRoom &&
    selected.every((id) =>
      currentRoom.members.some((member) => member.userId === id),
    );
  const currentMembers = membershipReady
    ? (currentRoom?.members ?? [])
    : members;
  const candidates = currentMembers.filter(
    (m) => m.userId !== session?.user.id,
  );
  const name = (id: string) => {
    const user = members.find((m) => m.userId === id)?.user;
    return user?.name ?? user?.email ?? "Former member";
  };
  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    setConfirmation("");
    draftId.current ??= crypto.randomUUID();
    try {
      const results = await sendPrivate(`/api/rooms/${roomId}/whispers`, {
        recipientIds: selected,
        text,
        clientMessageId: draftId.current,
      });
      const failed = results.filter((r) => !r.delivered);
      if (failed.length) {
        setSelected(failed.map((r) => r.recipientId));
        setRetrying(true);
        setError(
          `${results.length - failed.length} delivered. ${failed.map((r) => `${name(r.recipientId)}: ${r.error}`).join(" ")}`,
        );
      } else {
        setText("");
        setSelected([]);
        draftId.current = null;
        setRetrying(false);
        setConfirmation("Whisper delivered privately.");
        setOpen(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send whisper.");
      setRetrying(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-1 text-violet-700 dark:text-violet-300"
            aria-label="Whisper to room members"
          >
            <LockKeyhole />
            <span className="hidden sm:inline">Whisper</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole className="size-5 text-violet-600" />
              Send a whisper
            </DialogTitle>
            <DialogDescription>
              Choose members of this room. Each receives a private copy in their
              Private Space.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium" htmlFor="whisper-members">
              To
            </label>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((id) => (
                <Badge
                  key={id}
                  variant="secondary"
                  className="gap-1 border-violet-200 dark:border-violet-900"
                >
                  {name(id)}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={busy || retrying}
                    aria-label={`Remove ${name(id)}`}
                    onClick={() =>
                      setSelected(selected.filter((value) => value !== id))
                    }
                  >
                    <X />
                  </Button>
                </Badge>
              ))}
            </div>
            <Input
              id="whisper-members"
              placeholder="Search members…"
              value={query}
              disabled={busy || retrying}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div
              className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-1"
              aria-label="Room members"
            >
              {candidates
                .filter((m) =>
                  name(m.userId).toLowerCase().includes(query.toLowerCase()),
                )
                .map((m) => (
                  <Button
                    type="button"
                    key={m.userId}
                    variant="ghost"
                    className="h-9 w-full justify-between text-sm"
                    aria-pressed={selected.includes(m.userId)}
                    disabled={busy || retrying}
                    onClick={() =>
                      setSelected(
                        selected.includes(m.userId)
                          ? selected.filter((id) => id !== m.userId)
                          : [...selected, m.userId],
                      )
                    }
                  >
                    <span className="truncate">{name(m.userId)}</span>
                    {selected.includes(m.userId) && (
                      <Check className="text-violet-600" />
                    )}
                  </Button>
                ))}
              {!candidates.length && (
                <p className="p-3 text-sm text-muted-foreground">
                  No other members in this room.
                </p>
              )}
            </div>
            <label htmlFor="whisper-text" className="text-sm font-medium">
              Message
            </label>
            <Textarea
              id="whisper-text"
              value={text}
              disabled={busy || retrying}
              onChange={(e) => setText(e.target.value)}
              maxLength={4000}
              rows={5}
              className="text-sm"
              placeholder="Only your selected members can read this…"
            />
            <p className="text-right text-xs text-muted-foreground">
              {text.length.toLocaleString()} / 4,000
            </p>
            {memberships.error && (
              <div role="alert" className="text-sm text-destructive">
                Could not verify room membership.{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => void memberships.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}
            {!memberships.hasLoaded && (
              <p role="status" className="text-sm text-muted-foreground">
                Checking room membership…
              </p>
            )}
            {membershipReady && !canSend && (
              <p role="status" className="text-sm text-muted-foreground">
                Sending requires you and all selected recipients to still belong
                to this room.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            {retrying && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  draftId.current = null;
                  setRetrying(false);
                  setError(null);
                }}
              >
                Edit as new whisper
              </Button>
            )}
            <Button
              type="button"
              disabled={busy || !canSend || !selected.length || !text.trim()}
              className="bg-violet-600 text-white hover:bg-violet-700"
              onClick={() => void send()}
            >
              {busy
                ? "Sending…"
                : retrying
                  ? "Retry failed deliveries"
                  : "Send whisper"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <span role="status" className="sr-only">
        {confirmation}
      </span>
    </>
  );
}
