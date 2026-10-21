export default function ChatLoading() {
  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center px-4"
      aria-busy="true"
      aria-label="Loading chat"
    >
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
        <div className="mx-auto h-5 w-28 animate-pulse rounded bg-muted/80" />
        <div className="mx-auto mt-3 h-3.5 w-full max-w-52 animate-pulse rounded bg-muted/70" />
        <div className="mx-auto mt-2 h-3.5 w-3/5 animate-pulse rounded bg-muted/70" />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="h-9 animate-pulse rounded-md bg-muted/80" />
          <div className="h-9 animate-pulse rounded-md bg-muted/80" />
        </div>
      </div>
    </div>
  );
}
