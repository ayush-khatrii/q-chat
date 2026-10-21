"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

import { AttachmentQueue } from "@/components/chat/AttachmentQueue";
import { useAttachmentUploads } from "@/hooks/use-attachment-uploads";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_CONFIG,
  attachmentIds,
} from "@/constants/attachments";
import { attachmentRequest } from "@/lib/attachments/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

import {
  ChatMessageEventType,
  ChatMessageAction,
  MessageReactionType,
  type MessageReactionSummaryEvent,
  type ChatMessageEvent,
  type Message as AblyMessage,
} from "@ably/chat";
import { mergeMessagePage } from "@/lib/chat-messages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { useMessages, useTyping } from "@ably/chat/react";

import { authClient } from "@/lib/auth-client";
import { initFcm } from "@/lib/fcm";
import { useReadReceipts } from "@/hooks/use-read-receipts";
import {
  getRoomThemeStyle,
  useRoomTheme,
} from "@/components/chat/chat-appearance";
import { ChatBubbleMessage } from "@/components/chat/ChatBubbleMessage";
import type { RoomTheme, UserRoomMember } from "@/lib/rooms";
import { messagePreview, prepareReply } from "@/lib/message-replies";

type ChatProps = {
  roomId: string;
  roomCode: string;
  members: UserRoomMember[];
  initialTheme: RoomTheme;
};

type MessageMetadata = {
  displayName?: string;
  image?: string;
};

function getMessageMetadata(message: AblyMessage): MessageMetadata {
  if (!message.metadata || typeof message.metadata !== "object") {
    return {};
  }

  const metadata = message.metadata as Record<string, unknown>;

  return {
    displayName:
      typeof metadata.displayName === "string"
        ? metadata.displayName
        : undefined,
    image: typeof metadata.image === "string" ? metadata.image : undefined,
  };
}

export default function Chat({
  roomId,
  roomCode,
  members,
  initialTheme,
}: ChatProps) {
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;
  const { theme } = useRoomTheme(roomId, initialTheme);

  const { currentTypers, keystroke, stop } = useTyping();

  const [editing, setEditing] = useState<AblyMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<AblyMessage | null>(null);
  const [highlightedSerial, setHighlightedSerial] = useState<string | null>(
    null,
  );
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editLock = useRef(false);
  const [reactionPending, setReactionPending] = useState<Set<string>>(
    new Set(),
  );
  const reactionLocks = useRef(new Set<string>());
  const liveSummaries = useRef(new Map<string, MessageReactionSummaryEvent>());
  const [messages, setMessages] = useState<AblyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const uploads = useAttachmentUploads(roomId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const pendingMessage = useRef<AblyMessage | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRetry, setHistoryRetry] = useState(0);
  const { readReceipts, markRead: handleMessageRead } = useReadReceipts(
    roomId,
    currentUser?.id,
  );
  const [isPageVisible, setIsPageVisible] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const loadingHistoryRef = useRef(false);
  const initialHistoryRequestRef = useRef<unknown>(undefined);
  const receivedMessageSerialsRef = useRef(new Set<string>());
  const renderedMessageSerialsRef = useRef(new Set<string>());
  const scrollAdjustmentRef = useRef<
    { type: "bottom" } | { type: "preserve"; previousHeight: number } | null
  >(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyPageRef = useRef<any>(null);

  const {
    sendMessage,
    historyBeforeSubscribe,
    deleteMessage,
    updateMessage,
    getMessage,
    sendReaction,
    deleteReaction,
  } = useMessages({
    listener: (event: ChatMessageEvent) => {
      if (event.type === ChatMessageEventType.Created) {
        receivedMessageSerialsRef.current.add(event.message.serial);
      }
      setMessages((previous) =>
        mergeMessagePage(previous, [event.message], liveSummaries.current),
      );
      if (event.type === ChatMessageEventType.Deleted) {
        setEditing((current) =>
          current?.serial === event.message.serial ? null : current,
        );
        setReplyingTo((current) =>
          current?.serial === event.message.serial ? null : current,
        );
      }
    },
    reactionsListener: (event) => {
      liveSummaries.current.set(event.messageSerial, event);
      setMessages((previous) =>
        previous.map((message) =>
          message.serial === event.messageSerial
            ? message.with(event)
            : message,
        ),
      );
    },
  });

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!currentUser?.id) return;
    const replay = () => {
      try {
        const prefix = `qchat:attachment-bind:${currentUser.id}:${roomId}:`;
        for (const key of Object.keys(localStorage).filter((key) =>
          key.startsWith(prefix),
        )) {
          const value = JSON.parse(localStorage.getItem(key) ?? "null");
          if (
            !value ||
            typeof value.serial !== "string" ||
            !Array.isArray(value.ids)
          )
            continue;
          void attachmentRequest("/api/attachments", {
            action: "resolve",
            roomId,
            serial: value.serial,
            ids: value.ids,
          })
            .then(() => localStorage.removeItem(key))
            .catch(() => {});
        }
      } catch {
        /* Attachment cards also retry binding when history is loaded. */
      }
    };
    replay();
    window.addEventListener("online", replay);
    const interval = setInterval(replay, 30_000);
    return () => {
      window.removeEventListener("online", replay);
      clearInterval(interval);
    };
  }, [currentUser?.id, roomId]);

  const getScrollViewport = useCallback(
    () =>
      scrollAreaRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      ) ?? null,
    [],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (
      !historyBeforeSubscribe ||
      initialHistoryRequestRef.current === historyBeforeSubscribe
    ) {
      return;
    }

    initialHistoryRequestRef.current = historyBeforeSubscribe;
    loadingHistoryRef.current = true;
    setLoadingHistory(true);
    setHistoryError(null);

    historyBeforeSubscribe({ limit: 20 })
      .then((page) => {
        // Realtime events can arrive while history is in flight. Merge instead of
        // replacing state so a newly received message is never briefly discarded.
        setMessages((current) =>
          mergeMessagePage(current, page.items, liveSummaries.current),
        );
        setHasMore(!page.isLast());
        historyPageRef.current = page;
        scrollAdjustmentRef.current = { type: "bottom" };
        setHistoryLoaded(true);
      })
      .catch((error) => {
        console.error("Error loading history:", error);
        setHistoryError("Messages could not be loaded. Please try again.");
        initialHistoryRequestRef.current = undefined;
      })
      .finally(() => {
        loadingHistoryRef.current = false;
        setLoadingHistory(false);
      });
  }, [historyBeforeSubscribe, historyRetry]);

  const loadMore = useCallback(async () => {
    if (!historyPageRef.current || !hasMore || loadingHistoryRef.current) {
      return;
    }

    loadingHistoryRef.current = true;
    setLoadingHistory(true);
    setHistoryError(null);

    const viewport = getScrollViewport();
    const previousHeight = viewport?.scrollHeight;

    try {
      const nextPage = await historyPageRef.current.next();

      if (!nextPage) return;

      setMessages((previous) =>
        mergeMessagePage(previous, nextPage.items, liveSummaries.current),
      );
      setHasMore(!nextPage.isLast());
      historyPageRef.current = nextPage;

      if (previousHeight !== undefined) {
        scrollAdjustmentRef.current = {
          type: "preserve",
          previousHeight,
        };
      }
    } catch (error) {
      console.error("Error loading older messages:", error);
      setHistoryError("Older messages could not be loaded. Please try again.");
    } finally {
      loadingHistoryRef.current = false;
      setLoadingHistory(false);
    }
  }, [getScrollViewport, hasMore]);

  useEffect(() => {
    if (currentUser?.id) {
      void initFcm(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const viewport = getScrollViewport();

    if (!viewport) return;

    const handleScroll = () => {
      // Only paginate a genuinely scrollable conversation. A permanently visible
      // top sentinel used to request every history page immediately on room load.
      if (
        viewport.scrollHeight > viewport.clientHeight &&
        viewport.scrollTop <= 80
      ) {
        void loadMore();
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [getScrollViewport, loadMore]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (first, second) =>
          first.timestamp.getTime() - second.timestamp.getTime(),
      ),
    [messages],
  );

  useLayoutEffect(() => {
    const adjustment = scrollAdjustmentRef.current;
    const viewport = getScrollViewport();
    const hasNewMessage = messages.some(
      (message) =>
        receivedMessageSerialsRef.current.has(message.serial) &&
        !renderedMessageSerialsRef.current.has(message.serial),
    );
    receivedMessageSerialsRef.current.clear();
    renderedMessageSerialsRef.current = new Set(
      messages.map((message) => message.serial),
    );

    if (!viewport || (!hasNewMessage && !adjustment)) return;

    // Live messages take priority even while older history is loading.
    if (hasNewMessage || adjustment?.type === "bottom") {
      viewport.scrollTop = viewport.scrollHeight;
    } else if (adjustment?.type === "preserve") {
      viewport.scrollTop += viewport.scrollHeight - adjustment.previousHeight;
    }

    scrollAdjustmentRef.current = null;
  }, [getScrollViewport, messages]);

  const typingUsers = useMemo(
    () =>
      Array.from(currentTypers)
        .filter((typer) => typer.clientId !== currentUser?.id)
        .map((typer) => {
          const member = members.find(
            (item) => item.userId === typer.clientId,
          )?.user;

          return member?.name ?? member?.email ?? typer.clientId;
        }),
    [currentTypers, currentUser?.id, members],
  );

  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing…`
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
        : typingUsers.length > 2
          ? `${typingUsers[0]} and ${typingUsers.length - 1} others are typing…`
          : null;

  const senderNameFor = useCallback(
    (clientId: string) => {
      if (clientId === currentUser?.id)
        return currentUser.name ?? currentUser.email ?? "You";
      const user = members.find((member) => member.userId === clientId)?.user;
      return user?.name ?? user?.email ?? "Unknown user";
    },
    [currentUser, members],
  );

  const handleReplyMessage = useCallback((message: AblyMessage) => {
    if (message.action === ChatMessageAction.MessageDelete) return;
    setReplyingTo(message);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const jumpToMessage = useCallback(
    async (serial: string) => {
      let target = Array.from(
        scrollAreaRef.current?.querySelectorAll<HTMLElement>(
          "[data-message-serial]",
        ) ?? [],
      ).find((element) => element.dataset.messageSerial === serial);

      if (!target) {
        try {
          const parent = await getMessage(serial);
          setMessages((current) =>
            mergeMessagePage(current, [parent], liveSummaries.current),
          );
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          target = Array.from(
            scrollAreaRef.current?.querySelectorAll<HTMLElement>(
              "[data-message-serial]",
            ) ?? [],
          ).find((element) => element.dataset.messageSerial === serial);
        } catch {
          toast.error("The original message is no longer available.");
          return;
        }
      }

      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedSerial(serial);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(
        () => setHighlightedSerial(null),
        1_600,
      );
    },
    [getMessage],
  );

  const handleCopyMessage = useCallback(async (message: AblyMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy message");
    }
  }, []);

  const handleDeleteMessage = useCallback(
    async (message: AblyMessage) => {
      try {
        await deleteMessage(message.serial, {
          description: "Deleted by user",
        });

        const ids = attachmentIds(message.metadata);
        if (ids.length)
          await attachmentRequest("/api/attachments", {
            action: "resolve",
            roomId,
            serial: message.serial,
            ids,
          });
        toast.success("Message deleted");
      } catch (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete message");
      }
    },
    [deleteMessage, roomId],
  );

  const handleEditMessage = (message: AblyMessage) => {
    if (
      message.clientId !== currentUser?.id ||
      !message.text ||
      message.action === ChatMessageAction.MessageDelete
    )
      return;
    setEditing(message);
    setEditText(message.text);
    setEditError(null);
  };
  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !editText.trim() || editLock.current) return;
    const latest = messages.find(
      (message) => message.serial === editing.serial,
    );
    if (
      !latest ||
      latest.clientId !== currentUser?.id ||
      latest.action === ChatMessageAction.MessageDelete
    ) {
      setEditing(null);
      return;
    }
    editLock.current = true;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await updateMessage(
        latest.serial,
        {
          text: editText.trim(),
          metadata: latest.metadata,
          headers: latest.headers,
        },
        { description: "Edited by sender" },
      );
      setMessages((previous) =>
        mergeMessagePage(previous, [updated], liveSummaries.current),
      );
      setEditing(null);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "Unable to save. Please try again.",
      );
    } finally {
      editLock.current = false;
      setSavingEdit(false);
    }
  };
  const toggleReaction = async (message: AblyMessage, emoji: string) => {
    const key = `${message.serial}:${emoji}`;
    if (
      !currentUser?.id ||
      message.action === ChatMessageAction.MessageDelete ||
      reactionLocks.current.has(key)
    )
      return;
    reactionLocks.current.add(key);
    setReactionPending(new Set(reactionLocks.current));
    try {
      const selected = message.reactions.distinct[emoji]?.clientIds.includes(
        currentUser.id,
      );
      if (selected)
        await deleteReaction(message.serial, {
          name: emoji,
          type: MessageReactionType.Distinct,
        });
      else
        await sendReaction(message.serial, {
          name: emoji,
          type: MessageReactionType.Distinct,
        });
    } catch {
      toast.error("Unable to change reaction. Please try again.");
    } finally {
      reactionLocks.current.delete(key);
      setReactionPending(new Set(reactionLocks.current));
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;

    setDraft(value);

    if (value.trim()) {
      void keystroke().catch(console.error);
    } else {
      void stop().catch(console.error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && replyingTo) {
      event.preventDefault();
      setReplyingTo(null);
      return;
    }
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = draft.trim();

    if (
      sendingRef.current ||
      (!text && !uploads.files.length && !pendingMessage.current) ||
      !uploads.ready
    )
      return;
    if (
      uploads.files.some(
        (file) => file.expiresAt && Date.parse(file.expiresAt) <= Date.now(),
      )
    ) {
      setSendError("An unsent upload expired. Remove it or retry the upload.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    const replyTarget = replyingTo;
    try {
      const ids = uploads.files.flatMap((file) => (file.id ? [file.id] : []));
      // Retain the sent message until binding succeeds. Retrying must not send it twice.
      const message =
        pendingMessage.current ??
        (await sendMessage({
          text,
          metadata: {
            displayName: currentUser?.name ?? currentUser?.email ?? "User",
            image: currentUser?.image ?? "",
            ...(ids.length ? { attachmentIds: ids } : {}),
            ...(replyTarget ? { reply: prepareReply(replyTarget) } : {}),
          },
        }));
      pendingMessage.current = message;
      if (ids.length) {
        const pendingKey = `qchat:attachment-bind:${currentUser?.id}:${roomId}:${message.serial}`;
        try {
          localStorage.setItem(
            pendingKey,
            JSON.stringify({ serial: message.serial, ids }),
          );
        } catch {
          /* Storage can be unavailable in private browsing. */
        }
        await attachmentRequest("/api/attachments", {
          action: "resolve",
          roomId,
          serial: message.serial,
          ids,
        });
        try {
          localStorage.removeItem(pendingKey);
        } catch {
          /* Best effort. */
        }
      }
      pendingMessage.current = null;
      uploads.clear();
      setDraft("");
      setReplyingTo(null);
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Unable to send message.",
      );
      return;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }

    void stop().catch(console.error);

    if (currentUser?.id) {
      void fetch("/api/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomCode,
          body: text || "Shared an attachment",
          kind: replyTarget ? "reply" : "message",
        }),
      }).catch(console.error);

      void initFcm(currentUser.id);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      style={getRoomThemeStyle(theme)}
    >
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !savingEdit) setEditing(null);
        }}
      >
        <DialogContent>
          <form onSubmit={saveEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit message</DialogTitle>
              <DialogDescription>
                Update your message. Attachments stay unchanged.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              aria-label="Edit message text"
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              disabled={savingEdit}
              autoFocus
            />
            {editError && (
              <p role="alert" className="text-sm text-destructive">
                {editError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={savingEdit}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  savingEdit ||
                  !editText.trim() ||
                  editText.trim() === editing?.text
                }
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ScrollArea
        ref={scrollAreaRef}
        className="
          min-h-0 min-w-0 flex-1 overflow-hidden
          [&_[data-radix-scroll-area-viewport]]:overflow-x-hidden
          [&_[data-radix-scroll-area-viewport]>div]:!block
          [&_[data-radix-scroll-area-viewport]>div]:!w-full
          [&_[data-radix-scroll-area-viewport]>div]:!min-w-0
        "
      >
        <div
          role="log"
          aria-live="polite"
          className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6"
        >
          {hasMore && !loadingHistory && (
            <div className="flex justify-center py-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void loadMore()}
                className="rounded-full text-xs"
              >
                Load older messages
              </Button>
            </div>
          )}

          {loadingHistory && (
            <div className="flex justify-center py-2">
              <span
                role="status"
                className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
              >
                {historyLoaded
                  ? "Loading older messages…"
                  : "Loading messages…"}
              </span>
            </div>
          )}

          {historyError && !loadingHistory && (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-xs text-destructive">{historyError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (historyLoaded) {
                    void loadMore();
                  } else {
                    initialHistoryRequestRef.current = undefined;
                    setHistoryRetry((value) => value + 1);
                  }
                }}
              >
                Try again
              </Button>
            </div>
          )}

          {sortedMessages.map((message) => {
            const sender = members.find(
              (member) => member.userId === message.clientId,
            )?.user;

            const metadata = getMessageMetadata(message);
            const isMe = message.clientId === currentUser?.id;

            const senderName = isMe
              ? (currentUser?.name ??
                currentUser?.email ??
                metadata.displayName ??
                "You")
              : (sender?.name ??
                sender?.email ??
                metadata.displayName ??
                message.clientId ??
                "Unknown user");

            const senderImage = isMe
              ? (currentUser?.image ?? metadata.image)
              : (sender?.image ?? metadata.image);

            return (
              <ChatBubbleMessage
                key={message.serial}
                roomId={roomId}
                message={message}
                senderName={senderName}
                senderImage={senderImage}
                isMe={isMe}
                isPageVisible={isPageVisible && Boolean(currentUser?.id)}
                readAt={isMe ? readReceipts[message.serial] : undefined}
                onRead={handleMessageRead}
                onCopy={(item) => void handleCopyMessage(item)}
                onDelete={(item) => void handleDeleteMessage(item)}
                onEdit={handleEditMessage}
                onReply={handleReplyMessage}
                onReplyJump={(serial) => void jumpToMessage(serial)}
                replySenderName={senderNameFor}
                highlighted={highlightedSerial === message.serial}
                currentUserId={currentUser?.id}
                onReact={(item, emoji) => void toggleReaction(item, emoji)}
                reactionPending={reactionPending}
              />
            );
          })}
        </div>
      </ScrollArea>

      <div className="shrink-0">
        {sendError && (
          <p className="px-4 pb-2 text-xs text-destructive">{sendError}</p>
        )}

        {typingText && (
          <div className="px-4 pb-2 text-xs text-muted-foreground">
            {typingText}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border-t border-white/10 bg-black/15 px-3 py-3 backdrop-blur-md sm:px-4"
        >
          {replyingTo && (
            <div className="mx-auto mb-2 flex w-full max-w-5xl items-center gap-3 rounded-xl border border-border/70 bg-muted/60 px-3 py-2">
              <div className="min-w-0 flex-1 border-l-2 border-primary pl-3">
                <p className="truncate text-xs font-medium text-primary">
                  Replying to {senderNameFor(replyingTo.clientId)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {messagePreview(replyingTo)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label="Cancel reply"
                disabled={sending || Boolean(pendingMessage.current)}
                onClick={() => {
                  setReplyingTo(null);
                  textareaRef.current?.focus();
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
          <AttachmentQueue
            files={uploads.files}
            remove={uploads.remove}
            retry={uploads.retry}
            disabled={sending || Boolean(pendingMessage.current)}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose attachments"
            onChange={(event) => {
              if (event.target.files) uploads.add(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="mx-auto flex w-full max-w-5xl min-w-0 items-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Add attachments"
              disabled={
                sending ||
                Boolean(pendingMessage.current) ||
                uploads.files.length >= ATTACHMENT_CONFIG.maxFilesPerMessage
              }
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip />
            </Button>
            <Textarea
              ref={textareaRef}
              value={draft}
              disabled={sending || Boolean(pendingMessage.current)}
              rows={1}
              placeholder="Type something…"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => void stop().catch(console.error)}
              className="
                min-h-11 min-w-0 flex-1 resize-none
                rounded-2xl border-border bg-muted/40 px-4 py-3
                text-sm leading-5 shadow-none focus-visible:ring-1
                [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
              "
            />

            <Button
              type="submit"
              size="icon"
              disabled={
                sending ||
                !uploads.ready ||
                (!draft.trim() &&
                  !uploads.files.length &&
                  !pendingMessage.current)
              }
              aria-label={
                pendingMessage.current
                  ? "Finish sending attachments"
                  : "Send message"
              }
              className="size-11 shrink-0 rounded-full"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
