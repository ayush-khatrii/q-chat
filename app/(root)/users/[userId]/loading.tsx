export default function UserProfileLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6"
      aria-busy="true"
    >
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />

      <div className="mt-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="size-16 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-56 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="h-20 animate-pulse rounded-2xl border bg-card" />
        <div className="h-20 animate-pulse rounded-2xl border bg-card" />
      </div>
    </div>
  );
}
