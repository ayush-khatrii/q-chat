"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { inviteDestination } from "@/lib/invites";
import { Button } from "@/components/ui/button";

export default function InviteJoin({ code }: { code: string | null }) {
  const { data: session, isPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      setError("Sign-in did not complete. Please try again.");
    }
  }, []);
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
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? "Unable to join. Please try again.");
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
              {session?.user
                ? "Confirm to join this two-person room."
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
        {code && (
          <Button onClick={() => void act()} disabled={isPending || busy}>
            {busy
              ? "Please wait…"
              : session?.user
                ? "Join room"
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
