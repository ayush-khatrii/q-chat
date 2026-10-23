"use client";

import { lazy, memo, Suspense, useMemo } from "react";
import { classifyMessage } from "@/lib/message-format";
import { MessageCodeBlock } from "./MessageCodeBlock";

const MessageMarkdown = lazy(() => import("./MessageMarkdown"));

export const MessageBody = memo(function MessageBody({
  text,
}: {
  text: string;
}) {
  const format = useMemo(() => classifyMessage(text), [text]);
  const plain = (
    <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</div>
  );
  return (
    <div className="min-w-0 max-w-full" data-message-format={format}>
      {format === "code" ? (
        <MessageCodeBlock text={text} />
      ) : format === "markdown" ? (
        <Suspense fallback={plain}>
          <MessageMarkdown text={text} />
        </Suspense>
      ) : (
        plain
      )}
    </div>
  );
});
