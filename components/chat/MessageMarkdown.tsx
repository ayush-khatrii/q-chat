"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Children, isValidElement } from "react";
import { MessageCodeBlock } from "./MessageCodeBlock";

const plugins = [remarkGfm];
const components: Components = {
  pre({ children }) {
    const code = Children.toArray(children).find(isValidElement);
    const text = code
      ? String((code.props as { children?: unknown }).children ?? "")
      : "";
    return <MessageCodeBlock text={text} />;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    return (
      <a
        href={typeof src === "string" ? src : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {alt || "Image"}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="max-w-full overflow-x-auto">
        <table>{children}</table>
      </div>
    );
  },
};

export default function MessageMarkdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 max-w-full [overflow-wrap:anywhere] [&_p]:whitespace-pre-wrap [&_p]:my-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-current/40 [&_blockquote]:pl-2 [&_blockquote]:my-1 [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-current/20 [&_td]:border-current/20 [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1 [&_code]:font-mono [&_p_code]:rounded [&_p_code]:bg-black/10 [&_p_code]:px-1 [&_hr]:my-2 [&_hr]:border-current/25 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
