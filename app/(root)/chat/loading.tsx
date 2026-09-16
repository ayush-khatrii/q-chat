export default function ChatLoading() {
  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center px-4"
      aria-busy="true"
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-3 h-3.5 w-full max-w-64 animate-pulse rounded bg-muted/70" />
        <div className="mx-auto mt-2 h-3.5 w-3/5 animate-pulse rounded bg-muted/70" />

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
