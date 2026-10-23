"use client";

import { MessageBody } from "./MessageBody";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OutboxMessage } from "@/components/chat/outbox-context";

export function PendingChatBubble({
  message,
  onRetry,
}: {
  message: OutboxMessage;
  onRetry: () => void;
}) {
  return (
    <div
      className="ml-auto flex max-w-[85%] flex-col items-end gap-1"
      data-pending-message={message.id}
    >
      <div className="min-w-0 max-w-full rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground opacity-90">
        {message.text ? <MessageBody text={message.text} /> : null}
        {message.attachmentIds.length ? (
          <p className="mt-1 text-xs opacity-75">
            {message.attachmentIds.length} attachment
            {message.attachmentIds.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {message.status === "failed" ? (
          <>
            <AlertCircle className="size-3.5 text-destructive" />
            <span>{message.error ?? "Could not send"}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2"
              onClick={onRetry}
            >
              <RefreshCw className="size-3" /> Retry
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="size-3 animate-spin" />
            <span>{message.status === "queued" ? "Queued" : "Sending"}</span>
          </>
        )}
      </div>
    </div>
  );
}
