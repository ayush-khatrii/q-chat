export default function ChatLoading() {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-12"
      aria-busy="true"
      aria-label="Loading your chats"
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-muted/70" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-2xl border border-border/70 p-4 sm:p-5"
            >
              <div className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                <div className="h-3 w-56 max-w-full animate-pulse rounded bg-muted/70" />
              </div>
              <div className="hidden h-9 w-24 animate-pulse rounded-lg bg-muted sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
