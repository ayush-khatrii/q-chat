"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWhispers } from "@/components/whisper-context";
import { sendPrivate } from "@/components/chat/WhisperDialog";
import { useRooms } from "@/hooks/use-rooms";
import { authClient } from "@/lib/auth-client";
import type { Whisper } from "@/lib/whispers";
export function PrivateSpace({ active }: { active: boolean }) {
  const inbox = useWhispers();
  const { data: session } = authClient.useSession();
  const memberships = useRooms(active, session?.user.id);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  if (!inbox) return null;
  return (
    <div
      ref={setRoot}
      className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
    >
      <p className="text-xs leading-relaxed text-muted-foreground">
        Private whispers from all your rooms · retained for 30 days
      </p>
      {!inbox.connected && (
        <p
          role="status"
          className="rounded-lg border p-3 text-sm text-muted-foreground"
        >
          Disconnected. Your inbox will reconcile when the connection returns.
        </p>
      )}
      {!inbox.ready && !inbox.error && (
        <p role="status" className="p-3 text-sm text-muted-foreground">
          Loading your complete inbox…
        </p>
      )}
      {inbox.error && (
        <div role="alert" className="rounded-lg border p-3 text-sm">
          {inbox.error}
          <Button variant="outline" className="mt-2" onClick={inbox.retry}>
            Retry
          </Button>
        </div>
      )}
      {inbox.ready && !inbox.messages.length && (
        <div className="rounded-xl border border-dashed border-violet-300/60 p-8 text-center dark:border-violet-800">
          <ShieldCheck className="mx-auto mb-3 size-8 text-violet-600 dark:text-violet-400" />
          <p className="text-sm font-medium">Your Private Space is quiet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Whispers sent to you appear here, wherever you are.
          </p>
        </div>
      )}
      {inbox.messages.map((message) => (
        <WhisperCard
          key={message.id}
          message={message}
          root={root}
          active={active && inbox.ready}
          seen={!!inbox.seen[message.id]}
          markSeen={inbox.markSeen}
          canReply={
            memberships.hasLoaded && !memberships.error
              ? memberships.rooms.some(
                  (room) =>
                    room.id === message.room.id &&
                    room.members.some(
                      (member) => member.userId === message.sender.id,
                    ),
                )
              : null
          }
        />
      ))}
    </div>
  );
}
function WhisperCard({
  message,
  root,
  active,
  seen,
  markSeen,
  canReply,
}: {
  message: Whisper;
  root: HTMLDivElement | null;
  active: boolean;
  seen: boolean;
  markSeen: (id: string) => void;
  canReply: boolean | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const id = useRef<string | null>(null);
  const long = message.text.length > 360 || message.text.split("\n").length > 6;
  const replyDisabled = unavailable || canReply !== true;
  const observe = active && (!long || expanded);
  const { ref, inView } = useInView({
    root,
    threshold: 0.5,
    skip: !observe || !root || seen,
  });
  useEffect(() => {
    if (observe && root && inView && !seen) markSeen(message.id);
  }, [observe, root, inView, seen, message.id, markSeen]);
  const reply = async () => {
    if (replyDisabled) return;
    setBusy(true);
    setError(null);
    id.current ??= crypto.randomUUID();
    try {
      const results = await sendPrivate(
        `/api/whispers/${encodeURIComponent(message.serial)}/reply`,
        { text, clientMessageId: id.current },
      );
      if (!results[0]?.delivered) {
        const detail = results[0]?.error ?? "Reply failed. Please retry.";
        if (detail.includes("still belong")) setUnavailable(true);
        throw new Error(detail);
      }
      setText("");
      setReplying(false);
      setSent(true);
      id.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reply.");
    } finally {
      setBusy(false);
    }
  };
  const exact = new Date(message.timestamp).toLocaleString();
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - message.timestamp) / 60000),
  );
  return (
    <article
      ref={!long ? ref : undefined}
      className="min-w-0 rounded-xl border border-violet-200/70 bg-card p-4 shadow-sm dark:border-violet-800/60"
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-9">
          <AvatarImage src={message.sender.image ?? undefined} alt="" />
          <AvatarFallback>
            {message.sender.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">
              {message.sender.name}
            </p>
            {!seen && (
              <span
                className="size-2 shrink-0 rounded-full bg-violet-600"
                aria-label="Unread whisper"
              />
            )}
          </div>
          <time
            dateTime={new Date(message.timestamp).toISOString()}
            title={exact}
            className="text-xs text-muted-foreground"
          >
            {minutes < 1
              ? "Just now"
              : minutes < 60
                ? `${minutes} min ago`
                : exact}
          </time>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            From: {message.room.name} · {message.room.code}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300">
            <LockKeyhole className="size-3" />
            Private whisper to you
          </p>
        </div>
      </div>
      <p
        className={`mt-4 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere] ${long && !expanded ? "line-clamp-4" : ""}`}
      >
        {long && !expanded ? (
          `${message.text.slice(0, 320)}…`
        ) : (
          <>
            <span ref={long && expanded ? ref : undefined}>
              {message.text.slice(0, 80)}
            </span>
            {message.text.slice(80)}
          </>
        )}
      </p>
      {long && (
        <Button
          variant="link"
          className="mt-2 px-0 text-violet-700 dark:text-violet-300"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse whisper" : "Read whisper"}
        </Button>
      )}
      {expanded && (
        <p className="mt-1 text-xs text-muted-foreground">{exact}</p>
      )}
      <div className="mt-3 flex justify-end">
        <Button
          variant="ghost"
          disabled={replyDisabled}
          onClick={() => {
            setReplying(!replying);
            setSent(false);
          }}
          className="text-violet-700 dark:text-violet-300"
        >
          {canReply === null
            ? "Checking membership…"
            : replyDisabled
              ? "Reply unavailable"
              : "Reply privately"}
        </Button>
      </div>
      {canReply === false && (
        <p className="mt-1 text-xs text-muted-foreground">
          Replies require both of you to still belong to this room.
        </p>
      )}
      {replying && (
        <div className="mt-3 space-y-2 border-t border-violet-200/60 pt-3 dark:border-violet-800">
          <label
            htmlFor={`reply-${message.id}`}
            className="text-sm font-medium"
          >
            Only to {message.sender.name}
          </label>
          <Textarea
            id={`reply-${message.id}`}
            rows={3}
            maxLength={4000}
            value={text}
            disabled={busy || replyDisabled}
            onChange={(e) => {
              setText(e.target.value);
              id.current = null;
            }}
            className="text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {text.length} / 4,000
            </span>
            <Button
              disabled={busy || replyDisabled || !text.trim()}
              className="bg-violet-600 text-white hover:bg-violet-700"
              onClick={() => void reply()}
            >
              {busy ? "Sending…" : "Send privately"}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {sent && (
        <p
          role="status"
          className="mt-2 text-sm text-violet-700 dark:text-violet-300"
        >
          Reply delivered privately.
        </p>
      )}
    </article>
  );
}
