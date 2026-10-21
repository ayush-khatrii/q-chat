"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { inviteDestination } from "@/lib/invites";
import { Button } from "@/components/ui/button";
import type { JoinRoomResult, PendingJoinRequest } from "@/lib/rooms";
import { useRoomActivity } from "@/components/room-activity-context";

export default function InviteJoin({ code }: { code: string | null }) {
  const { data: session, isPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] =
    useState<PendingJoinRequest | null>(null);
  const activity = useRoomActivity();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      setError("Sign-in did not complete. Please try again.");
    }
  }, []);
  useEffect(() => {
    if (!pendingRequest) return;
    const decision = activity?.activities.find(
      (event) =>
        (event.request?.id ?? event.id) === pendingRequest.id &&
        (event.type === "join.approved" || event.type === "join.rejected"),
    );
    if (decision?.type === "join.approved") {
      window.dispatchEvent(new Event("qchat:membership-changed"));
      window.location.assign(
        `/chat/${encodeURIComponent(pendingRequest.room.code)}`,
      );
    } else if (decision?.type === "join.rejected") {
      setPendingRequest(null);
      setError("Your join request was rejected. You can try again.");
    }
  }, [activity?.activities, pendingRequest]);
  useEffect(() => {
    if (!pendingRequest) return;
    const timer = window.setTimeout(
      () => {
        setPendingRequest(null);
        setError("Your join request expired. Submit it again to retry.");
      },
      Math.max(0, Date.parse(pendingRequest.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [pendingRequest]);
  const act = async () => {
    if (!code || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!session?.user) {
        const result = await authClient.signIn.social({
          provider: "google",
          callbackURL: inviteDestination(code),
          newUserCallbackURL: inviteDestination(code),
          errorCallbackURL: inviteDestination(code),
        });
        if (result.error)
          throw new Error(
            result.error.message ?? "Sign-in failed. Please try again.",
          );
        return;
      }
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json()) as JoinRoomResult & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Unable to join. Please try again.");
      if (payload.status === "pending") {
        setPendingRequest(payload.request);
        return;
      }
      // Reload after membership changes so room lists and Ably tokens start fresh.
      try {
        localStorage.removeItem(`qchat:rooms:${session.user.id}`);
      } catch {
        /* optional cache */
      }
      window.dispatchEvent(new Event("qchat:membership-changed"));
      window.location.assign(`/chat/${encodeURIComponent(payload.room.code)}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to continue. Please try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-6">
        <h1 className="text-xl font-semibold">QChat invitation</h1>
        {code ? (
          <>
            <p className="text-sm text-muted-foreground">
              {pendingRequest
                ? `Your request is waiting for an admin. It expires in 15 minutes.`
                : session?.user
                  ? "Send a request to join this room."
                  : "Sign in with Google, then confirm to join this room."}
            </p>
            <p className="font-mono">{code}</p>
          </>
        ) : (
          <p role="alert">
            This invite code is invalid. Ask the sender for a new link.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {code && !pendingRequest && (
          <Button onClick={() => void act()} disabled={isPending || busy}>
            {busy
              ? "Please wait…"
              : session?.user
                ? "Request to join"
                : "Sign in with Google"}
          </Button>
        )}
        <Link href="/" className="block text-sm underline">
          Back to QChat
        </Link>
      </section>
    </main>
  );
}
