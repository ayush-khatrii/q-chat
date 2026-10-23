"use client";

import { useState } from "react";

export function MessageCodeBlock({ text }: { text: string }) {
  const [status, setStatus] = useState("Copy code");
  return (
    <div className="my-1 min-w-0 max-w-full overflow-hidden rounded-md border border-current/20 bg-black/10">
      <div className="flex justify-end px-2 py-1">
        <button
          type="button"
          className="rounded px-1 text-[10px] opacity-75 hover:opacity-100 focus-visible:outline focus-visible:outline-1"
          aria-label="Copy code"
          onClick={async (event) => {
            event.stopPropagation();
            try {
              await navigator.clipboard.writeText(text);
              setStatus("Copied");
            } catch {
              setStatus("Copy failed; try again");
            }
          }}
        >
          <span aria-live="polite">{status}</span>
        </button>
      </div>
      <pre
        className="m-0 max-w-full overflow-x-auto px-2.5 pb-2.5 font-mono text-xs leading-relaxed whitespace-pre [overflow-wrap:normal] [tab-size:4]"
        tabIndex={0}
      >
        <code>{text}</code>
      </pre>
    </div>
  );
}
