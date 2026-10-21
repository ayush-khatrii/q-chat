export default function RoomSkeleton() {
  return (
    <div
      className="flex min-h-0 w-full flex-1 flex-col bg-background/80"
      aria-busy="true"
      aria-label="Loading room"
    >
      <div className="border-b border-border/70 bg-background/60">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-3 px-3 py-2 sm:min-h-16 sm:px-4 lg:px-8">
          <div className="size-7 animate-pulse rounded-md bg-muted/80" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-28 animate-pulse rounded bg-muted/80" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted/60" />
          </div>
          <div className="size-7 animate-pulse rounded-full bg-muted/80" />
          <div className="size-7 animate-pulse rounded-md bg-muted/80" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-end gap-3 px-3 py-4 sm:px-5">
        <div className="h-12 w-44 animate-pulse rounded-2xl rounded-bl-md bg-muted/80" />
        <div className="ml-auto h-12 w-52 animate-pulse rounded-2xl rounded-br-md bg-muted/80" />
      </div>

      <div className="border-t border-border/70 px-3 py-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-5xl items-end gap-2">
          <div className="h-11 flex-1 animate-pulse rounded-2xl bg-muted/80" />
          <div className="size-11 animate-pulse rounded-full bg-muted/80" />
        </div>
      </div>
    </div>
  );
}
